import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import NodeID3 from 'node-id3';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

// Ensure config / DB path exist
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../config');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

import { db } from './db';
import { scanLibrary } from './scanner';
import { processPendingTracks, searchITunes, searchNetease, searchQQMusic, fetchNeteaseLyrics, fetchLyrics } from './scraper';

const app = express();
const PORT = process.env.PORT || 8002;
const MUSIC_DIR = process.env.MUSIC_DIR || path.join(__dirname, '../../examples'); // Default fallback for tests

const upload = multer({ storage: multer.memoryStorage() }); // Multer initialization

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'music-tag-secret-key-123';

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
    if (req.path === '/auth/login') return next();

    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1] || req.query.auth as string;

    if (!token) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        (req as any).user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
};

app.use('/api', authenticate);

// Auth Routes
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
        if (user && bcrypt.compareSync(password, user.password)) {
            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ success: true, token, user: { id: user.id, username: user.username } });
        } else {
            res.status(401).json({ success: false, error: 'Invalid username or password' });
        }
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/auth/check', (req, res) => {
    res.json({ success: true, user: (req as any).user });
});

app.get('/api/status', (req, res) => {
    // Quick overall info API
    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM tracks').get() as { count: number };
        const pending = db.prepare('SELECT COUNT(*) as count FROM tracks WHERE scrape_status = 0').get() as { count: number };
        const success = db.prepare('SELECT COUNT(*) as count FROM tracks WHERE scrape_status = 1').get() as { count: number };
        const failed = db.prepare('SELECT COUNT(*) as count FROM tracks WHERE scrape_status = 2').get() as { count: number };

        res.json({
            success: true,
            dbStatus: {
                total: total.count,
                pending: pending.count,
                success: success.count,
                failed: failed.count
            },
            musicDir: MUSIC_DIR
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

import { taskManager } from './taskManager';

app.post('/api/trigger-scan', async (req, res) => {
    try {
        const taskId = taskManager.createTask('scan', 'Library scan triggered');
        // Do not block response for full scan
        scanLibrary(MUSIC_DIR, taskId).catch(err => console.error("Scan error:", err));
        res.json({ success: true, taskId, message: 'Scan job triggered in background.' });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/trigger-scrape', async (req, res) => {
    try {
        const taskId = taskManager.createTask('scrape', 'Batch scraping triggered');
        // Do not block response for scrape job
        processPendingTracks(taskId).catch(err => console.error("Scraper error:", err));
        res.json({ success: true, taskId, message: 'Scrape batch job triggered in background.' });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/reset-scrape-status', (req, res) => {
    try {
        const result = db.prepare('UPDATE tracks SET scrape_status = 0 WHERE scrape_status = 1').run();
        res.json({ success: true, count: result.changes });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/tracks', (req, res) => {
    try {
        const folder = req.query.folder as string || '';
        const statusFilter = req.query.status !== undefined ? parseInt(req.query.status as string) : null;

        let allTracks: any[];
        if (statusFilter !== null) {
            allTracks = db.prepare(`SELECT * FROM tracks WHERE scrape_status = ? ORDER BY filepath ASC`).all(statusFilter) as any[];
        } else {
            allTracks = db.prepare(`SELECT * FROM tracks ORDER BY filepath ASC`).all() as any[];
        }

        const subfolders = new Set<string>();
        const currentTracks: any[] = [];

        const normalizedRequestFolder = folder.replace(/\\/g, '/').replace(/^\/|\/$/g, '').toLowerCase();

        allTracks.forEach(track => {
            const trackDir = path.dirname(track.filepath);
            const relativeDir = path.relative(MUSIC_DIR, trackDir).replace(/\\/g, '/');
            const trackFolder = (relativeDir === '.' || relativeDir === '') ? '' : relativeDir;
            const normalizedTrackFolder = trackFolder.toLowerCase();

            if (statusFilter !== null && !folder) {
                currentTracks.push(track);
            } else if (
                normalizedTrackFolder === normalizedRequestFolder ||
                normalizedTrackFolder.startsWith(normalizedRequestFolder ? normalizedRequestFolder + '/' : '')
            ) {
                currentTracks.push(track);

                if (normalizedTrackFolder !== normalizedRequestFolder) {
                    const relativeToRequest = normalizedRequestFolder === ''
                        ? trackFolder
                        : trackFolder.substring(normalizedRequestFolder.length + 1);

                    const immediateSubfolder = relativeToRequest.split('/')[0];
                    if (immediateSubfolder) {
                        subfolders.add(immediateSubfolder);
                    }
                }
            }
        });

        const tracksWithMeta = currentTracks.map(track => {
            const trackDir = path.dirname(track.filepath);
            const relativeDir = path.relative(MUSIC_DIR, trackDir).replace(/\\/g, '/');
            const relativePath = (relativeDir === '.' || relativeDir === '') ? '' : relativeDir;

            return {
                ...track,
                relative_path: relativePath
            };
        });

        res.json({
            success: true,
            data: {
                folders: statusFilter !== null && !folder ? [] : Array.from(subfolders).sort(),
                tracks: tracksWithMeta
            }
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Discovery: Random tracks
app.get('/api/discovery/random', (req, res) => {
    try {
        const tracks = db.prepare(`SELECT * FROM tracks ORDER BY RANDOM() LIMIT 50`).all() as any[];
        res.json({ success: true, data: tracks });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Discovery: Recently added
app.get('/api/discovery/recent', (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const tracks = db.prepare(`SELECT * FROM tracks ORDER BY id DESC LIMIT ?`).all(limit) as any[];
        res.json({ success: true, data: tracks });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Discovery: Recommended Albums
app.get('/api/discovery/albums', (req, res) => {
    try {
        // Get unique albums with a sample track and artist
        const rows = db.prepare(`
            SELECT album, artist, id 
            FROM tracks 
            GROUP BY album 
            ORDER BY RANDOM() 
            LIMIT 20
        `).all() as any[];
        res.json({ success: true, data: rows });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});
app.post('/api/tracks/organize', (req, res) => {
    try {
        const { levels } = req.body;
        const taskId = taskManager.createTask('organize', 'Library organization triggered', { levels });

        (async () => {
            try {
                taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                const allTracks = db.prepare(`SELECT * FROM tracks ORDER BY filepath ASC`).all() as any[];
                let organizedCount = 0;
                const total = allTracks.length;

                db.transaction(() => {
                    allTracks.forEach((track, index) => {
                        const dirParts = [];
                        for (const level of levels || []) {
                            if (level === 'artist') {
                                dirParts.push(track.artist ? track.artist.replace(/[<>:"/\\|?*]+/g, '_').trim() : 'Unknown Artist');
                            } else if (level === 'album') {
                                dirParts.push(track.album ? track.album.replace(/[<>:"/\\|?*]+/g, '_').trim() : 'Unknown Album');
                            } else if (level === 'title') {
                                dirParts.push(track.title ? track.title.replace(/[<>:"/\\|?*]+/g, '_').trim() : 'Unknown Title');
                            } else if (level.startsWith('custom:')) {
                                dirParts.push(level.substring(7).replace(/[<>:"/\\|?*]+/g, '_').trim());
                            }
                        }

                        if (dirParts.length === 0) return;

                        const newDir = path.join(MUSIC_DIR, ...dirParts);
                        const newFilepath = path.join(newDir, track.filename);

                        if (track.filepath !== newFilepath && fs.existsSync(track.filepath)) {
                            if (!fs.existsSync(newDir)) {
                                fs.mkdirSync(newDir, { recursive: true });
                            }
                            try {
                                fs.renameSync(track.filepath, newFilepath);
                                db.prepare('UPDATE tracks SET filepath = ? WHERE id = ?').run(newFilepath, track.id);
                                organizedCount++;
                                if (organizedCount % 50 === 0) {
                                    taskManager.updateTask(taskId, {
                                        progress: Math.round((index / total) * 100),
                                        message: `Moving files... ${organizedCount} items moved`
                                    });
                                }
                            } catch (e) {
                                taskManager.addLog(taskId, `Failed to move ${track.filepath}: ${e}`);
                            }
                        }
                    });
                });
                taskManager.updateTask(taskId, { status: 'completed', progress: 100, message: `Successfully organized ${organizedCount} files.` });
            } catch (err: any) {
                taskManager.updateTask(taskId, { status: 'failed', message: err.message });
            }
        })();

        res.json({ success: true, taskId });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Advanced: Batch delete feature
app.post('/api/tracks/delete', (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) return res.status(400).json({ success: false, error: 'Invalid ids' });

        let deletedCount = 0;
        const getStmt = db.prepare('SELECT filepath FROM tracks WHERE id = ?');
        const deleteStmt = db.prepare('DELETE FROM tracks WHERE id = ?');

        db.transaction(() => {
            for (const id of ids) {
                const track = getStmt.get(id) as any;
                if (track) {
                    try {
                        if (fs.existsSync(track.filepath)) {
                            fs.unlinkSync(track.filepath);
                        }
                        deleteStmt.run(id);
                        deletedCount++;
                    } catch (err) {
                        console.error(`Failed to delete file ${track.filepath}:`, err);
                    }
                }
            }
        })();

        res.json({ success: true, count: deletedCount });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Advanced: Deduplication finder
app.get('/api/tracks/duplicates', (req, res) => {
    try {
        const duplicates = db.prepare(`
            SELECT title, COUNT(*) as c
            FROM tracks 
            WHERE title !='' AND title IS NOT NULL
            GROUP BY title
            HAVING c > 1
        `).all() as any[];

        const result = duplicates.map(group => {
            const files = db.prepare('SELECT id, filepath, filename, extension, scrape_status, artist FROM tracks WHERE title = ?').all(group.title) as any[];
            const mappedFiles = files.map(f => {
                let size = 0;
                try { size = fs.statSync(f.filepath).size; } catch (e) { }
                return {
                    id: f.id,
                    filepath: f.filepath,
                    filename: f.filename,
                    size: size,
                    extension: f.extension,
                    status: f.scrape_status,
                    artist: f.artist || 'Unknown Artist'
                };
            });
            // sort by size descending so usually high quality is on top
            mappedFiles.sort((a, b) => b.size - a.size);

            const uniqueArtists = Array.from(new Set(mappedFiles.map(f => f.artist)));
            const displayArtist = uniqueArtists.join(' / ');

            return {
                title: group.title,
                artist: displayArtist,
                files: mappedFiles
            };
        });

        res.json({ success: true, data: result });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Advanced: Batch rename feature
app.post('/api/batch-rename', (req, res) => {
    try {
        const folder = req.body.folder as string || '';
        const taskId = taskManager.createTask('rename', 'Batch rename triggered', { folder });

        (async () => {
            try {
                taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                const allTracks = db.prepare(`SELECT * FROM tracks ORDER BY filepath ASC`).all() as any[];
                let renamedCount = 0;
                const total = allTracks.length;

                db.transaction(() => {
                    allTracks.forEach((track, index) => {
                        const relativePath = path.relative(MUSIC_DIR, track.filepath);
                        const dirName = path.dirname(relativePath).replace(/\\/g, '/');
                        const requestFolder = folder.replace(/\\/g, '/').replace(/^\/|\/$/g, '');
                        const trackFolder = dirName === '.' ? '' : dirName;

                        if (trackFolder === requestFolder && track.scrape_status === 1) {
                            if (track.title && track.artist) {
                                const safeTitle = track.title.replace(/[<>:"/\\|?*]+/g, '_').trim();
                                const safeArtist = track.artist.replace(/[<>:"/\\|?*]+/g, '_').trim();

                                const newFilename = `${safeArtist} - ${safeTitle}${track.extension}`;
                                const newFilepath = path.join(MUSIC_DIR, requestFolder, newFilename);

                                if (track.filepath !== newFilepath && !fs.existsSync(newFilepath)) {
                                    try {
                                        fs.renameSync(track.filepath, newFilepath);
                                        db.prepare('UPDATE tracks SET filepath = ?, filename = ? WHERE id = ?')
                                            .run(newFilepath, newFilename, track.id);
                                        renamedCount++;
                                    } catch (renameErr) {
                                        taskManager.addLog(taskId, `Failed to rename ${track.filepath}: ${renameErr}`);
                                    }
                                }
                            }
                        }
                    });
                });
                taskManager.updateTask(taskId, { status: 'completed', progress: 100, message: `Successfully normalized ${renamedCount} file names.` });
            } catch (err: any) {
                taskManager.updateTask(taskId, { status: 'failed', message: err.message });
            }
        })();

        res.json({ success: true, taskId });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/tracks/:id/cover', (req, res) => {
    try {
        const id = req.params.id;
        const track = db.prepare('SELECT filepath, extension FROM tracks WHERE id = ?').get(id) as any;
        if (!track) {
            return res.status(404).send('Not found');
        }

        if (track.extension === '.mp3') {
            const tags = NodeID3.read(track.filepath);
            if (tags && tags.image) {
                const img = Array.isArray(tags.image) ? tags.image[0] : tags.image;
                if (img && img.imageBuffer) {
                    res.contentType(img.mime || 'image/jpeg');
                    return res.send(img.imageBuffer);
                }
            }
        } else if (track.extension === '.flac') {
            const Metaflac = require('metaflac-js');
            const flac = new Metaflac(track.filepath);
            if (flac.picturesDatas && flac.picturesDatas.length > 0) {
                const imgSpec = flac.picturesSpecs[0];
                const imgData = flac.picturesDatas[0];
                res.contentType(imgSpec.mime || 'image/jpeg');
                return res.send(imgData);
            }
        }

        // Default transparent/empty if no cover
        res.status(404).send('No cover');
    } catch (e: any) {
        res.status(500).send('Error reading cover');
    }
});

app.get('/api/tracks/:id/stream', (req, res) => {
    try {
        const id = req.params.id;
        const track = db.prepare('SELECT filepath, extension FROM tracks WHERE id = ?').get(id) as any;
        console.log(`[Stream] Request for track ID: ${id}, filepath: ${track?.filepath}`);
        if (!track || !fs.existsSync(track.filepath)) {
            console.error(`[Stream] File not found: ${track?.filepath}`);
            return res.status(404).json({ success: false, error: 'Track not found' });
        }

        const stat = fs.statSync(track.filepath);
        const fileSize = stat.size;
        const rangeHeader = req.headers.range;

        if (rangeHeader && typeof rangeHeader === 'string') {
            const range = rangeHeader;
            const parts = range.replace(/bytes=/, "").split("-");
            const startStr = parts[0] || "0";
            const start = parseInt(startStr, 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(track.filepath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': track.extension === '.mp3' ? 'audio/mpeg' : 'audio/flac',
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': track.extension === '.mp3' ? 'audio/mpeg' : 'audio/flac',
            };
            res.writeHead(200, head);
            fs.createReadStream(track.filepath).pipe(res);
        }
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Proxy to bypass strict CDN Referer protections (e.g. NetEase default generic pictures placeholder fix)
app.get('/api/proxy-image', async (req, res) => {
    try {
        const targetUrl = req.query.url as string;
        if (!targetUrl) return res.status(400).send('No url');

        const response = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            headers: {
                'Referer': targetUrl.includes('qq.com') || targetUrl.includes('gtimg.cn') ? 'https://y.qq.com/' : 'https://music.163.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const contentType = response.headers['content-type'];
        if (contentType) res.set('Content-Type', contentType as string);
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(response.data);
    } catch (e: any) {
        res.status(404).send('Proxy failed');
    }
});

app.get('/api/tracks/:id/lyrics', (req, res) => {
    try {
        const id = req.params.id;
        const track = db.prepare('SELECT filepath, extension FROM tracks WHERE id = ?').get(id) as any;
        if (!track) return res.status(404).json({ success: false, error: 'Not found' });

        let lyricsText = '';
        if (track.extension === '.mp3') {
            const tags = NodeID3.read(track.filepath);
            if (tags && tags.unsynchronisedLyrics) {
                lyricsText = tags.unsynchronisedLyrics.text || '';
            }
        } else if (track.extension === '.flac') {
            const Metaflac = require('metaflac-js');
            const flac = new Metaflac(track.filepath);
            lyricsText = flac.getTag('LYRICS') || '';
        }

        res.json({ success: true, lyrics: lyricsText });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/search-metadata', async (req, res) => {
    try {
        const query = req.query.q as string;
        const source = req.query.source as string || 'netease';

        if (!query) {
            return res.json({ success: true, results: [] });
        }

        let results = [];
        if (source === 'itunes') {
            results = await searchITunes(query);
        } else if (source === 'qq') {
            results = await searchQQMusic(query);
        } else {
            // Netease acts as fallback for 'netease', 'spotify' placeholders
            results = await searchNetease(query);
        }

        res.json({ success: true, results });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/tracks/:id', (req, res) => {
    try {
        const { title, artist, album, lyrics } = req.body;
        const id = req.params.id;

        const track = db.prepare('SELECT filepath, extension FROM tracks WHERE id = ?').get(id) as any;
        if (!track) {
            res.status(404).json({ success: false, error: 'Track not found' });
            return;
        }

        if (track.extension === '.mp3') {
            const tags = NodeID3.read(track.filepath) || {};
            const newTags = { ...tags, title, artist, album };
            if (lyrics !== undefined) {
                newTags.unsynchronisedLyrics = {
                    language: 'eng',
                    text: lyrics
                };
            }
            NodeID3.update(newTags, track.filepath);
        } else if (track.extension === '.flac') {
            const Metaflac = require('metaflac-js');
            const flac = new Metaflac(track.filepath);

            flac.removeTag('TITLE');
            if (title) flac.setTag(`TITLE=${title}`);

            flac.removeTag('ARTIST');
            if (artist) flac.setTag(`ARTIST=${artist}`);

            flac.removeTag('ALBUM');
            if (album) flac.setTag(`ALBUM=${album}`);

            if (lyrics !== undefined) {
                flac.removeTag('LYRICS');
                if (lyrics) flac.setTag(`LYRICS=${lyrics}`);
            }

            flac.save();
        }

        db.prepare('UPDATE tracks SET title = ?, artist = ?, album = ?, scrape_status = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(title, artist, album, id);

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

import {
    parseNeteaseUrl,
    fetchNeteaseSongDetail,
    fetchNeteasePlaylist,
    fetchNeteaseDownloadUrl,
    downloadAndTagNeteaseSong,
    fetchNeteaseRecommendPlaylists,
    fetchNeteaseRecommendSongs
} from './netease';

const getStoredConfig = () => {
    try {
        const configPath = path.join(dataDir, 'settings.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to read config file', e);
    }
    return {};
};

app.get('/api/netease/recommend/playlists', async (req, res) => {
    try {
        let cookie = req.query.cookie as string || '';
        if (!cookie) {
            cookie = getStoredConfig().neteaseCookie || '';
        }

        if (!cookie) return res.status(400).json({ success: false, error: 'Cookie is required' });
        const playlists = await fetchNeteaseRecommendPlaylists(cookie);
        res.json({ success: true, data: playlists });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/netease/recommend/songs', async (req, res) => {
    try {
        let cookie = req.query.cookie as string || '';
        if (!cookie) {
            cookie = getStoredConfig().neteaseCookie || '';
        }

        if (!cookie) return res.status(400).json({ success: false, error: 'Cookie is required' });
        const songs = await fetchNeteaseRecommendSongs(cookie);
        res.json({ success: true, data: songs });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/netease/playlist/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = await fetchNeteasePlaylist(id);
        if (data) {
            res.json({ success: true, data });
        } else {
            res.status(404).json({ success: false, error: 'Playlist not found' });
        }
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/netease/parse', async (req, res) => {
    try {
        const { url, level = 'exhigh', cookie = '' } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'No URL provided' });

        const parsed = await parseNeteaseUrl(url);

        if (parsed.type === 'song') {
            const detail = await fetchNeteaseSongDetail(parsed.id);
            if (!detail) return res.status(404).json({ success: false, error: 'Song not found' });

            const dl = await fetchNeteaseDownloadUrl(parsed.id, level, cookie);

            let quality = null;
            if (dl && dl.url) {
                const { probeAudioQuality } = await import('./utils/probe.js');
                quality = await probeAudioQuality(dl.url, 'netease', (detail as any).duration || 0);
            }

            let downloadable = !!(dl && dl.url && quality?.valid);

            if (!downloadable) {
                const netease: any = await import('./netease.js');
                let fallbackUrl = await netease.fetchFallbackFromMetingTencent(detail.title, detail.artist, level);
                if (!fallbackUrl) fallbackUrl = await netease.fetchFallbackFromKugou(detail.title, detail.artist);
                if (!fallbackUrl) fallbackUrl = await netease.fetchFallbackFromBilibili(detail.title, detail.artist);

                if (fallbackUrl) {
                    const { probeAudioQuality } = await import('./utils/probe.js');
                    const fallbackQuality = await probeAudioQuality(fallbackUrl, 'tencent', (detail as any).duration || 0);
                    if (fallbackQuality.valid) {
                        downloadable = true;
                        quality = fallbackQuality;
                    }
                }
            }

            res.json({
                success: true,
                type: 'song',
                data: [{
                    ...detail,
                    downloadable,
                    quality,
                    neteaseId: parsed.id
                }]
            });
        } else if (parsed.type === 'playlist') {
            const playlist = await fetchNeteasePlaylist(parsed.id);
            if (!playlist) return res.status(404).json({ success: false, error: 'Playlist not found' });

            res.json({
                success: true,
                type: 'playlist',
                id: parsed.id,
                name: playlist.name,
                coverUrl: playlist.coverUrl,
                trackIds: playlist.trackIds
            });
        } else {
            res.status(400).json({ success: false, error: 'URL could not be parsed' });
        }
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message || 'Unknown Server Error' });
    }
});

app.post('/api/netease/download', async (req, res) => {
    try {
        const { id, level = 'exhigh', cookie = '', isPlaylist = false, name = '', trackIds = [] } = req.body;
        if (!id && (!isPlaylist || trackIds.length === 0)) {
            return res.status(400).json({ success: false, error: 'ID or trackIds list is required' });
        }

        if (isPlaylist) {
            const mainTaskId = taskManager.createTask('playlist_import', `Importing playlist: ${name || id || 'Custom List'}`, { id, level });
            (async () => {
                try {
                    taskManager.updateTask(mainTaskId, { status: 'running', progress: 0 });
                    let finalTrackIds = trackIds;
                    if (finalTrackIds.length === 0) {
                        const playlist = await fetchNeteasePlaylist(id);
                        if (!playlist || !playlist.trackIds) throw new Error('Could not fetch playlist details');
                        finalTrackIds = playlist.trackIds;
                    }

                    const total = finalTrackIds.length;
                    for (let i = 0; i < total; i++) {
                        if (taskManager.isCancelled(mainTaskId)) {
                            taskManager.updateTask(mainTaskId, { status: 'cancelled' });
                            return;
                        }
                        const songId = finalTrackIds[i];
                        const childTaskId = taskManager.createTask('download_netease', `[Track ${i + 1}/${total}] ID: ${songId}`, { id: songId, level }, mainTaskId);
                        try {
                            taskManager.updateTask(childTaskId, { status: 'running', progress: 10 });
                            await downloadAndTagNeteaseSong(songId, MUSIC_DIR, db, level, cookie, childTaskId);
                            taskManager.updateTask(childTaskId, { status: 'completed', progress: 100 });
                        } catch (childErr: any) {
                            taskManager.updateTask(childTaskId, { status: 'failed', message: childErr.message });
                        }
                        taskManager.updateTask(mainTaskId, { progress: Math.round(((i + 1) / total) * 100) });
                    }
                    taskManager.updateTask(mainTaskId, { status: 'completed', progress: 100 });
                } catch (err: any) {
                    taskManager.updateTask(mainTaskId, { status: 'failed', message: err.message });
                }
            })();
            res.json({ success: true, taskId: mainTaskId });
        } else {
            const taskId = taskManager.createTask('download_netease', `Downloading ID: ${id}`, { id, level });
            (async () => {
                try {
                    taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                    await downloadAndTagNeteaseSong(id, MUSIC_DIR, db, level, cookie, taskId);
                    taskManager.updateTask(taskId, { status: 'completed', progress: 100 });
                } catch (err: any) {
                    taskManager.updateTask(taskId, { status: 'failed', message: err.message });
                }
            })();
            res.json({ success: true, taskId });
        }
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

import { parseQQMusicUrl, downloadAndTagQQMusicSong } from './qqmusic';

app.post('/api/qq/parse', async (req, res) => {
    try {
        const { url, level = 'exhigh', cookie = '' } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'No URL provided' });
        const parsed = await parseQQMusicUrl(url, level, cookie);
        res.json({ success: true, ...parsed });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/qq/download', async (req, res) => {
    try {
        const { id, level = 'exhigh', cookie = '' } = req.body;
        const taskId = taskManager.createTask('download_qq', `Downloading QQMusic song ${id}`, { id, level });
        (async () => {
            try {
                taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                await downloadAndTagQQMusicSong(MUSIC_DIR, id, level, cookie);
                taskManager.updateTask(taskId, { status: 'completed', progress: 100 });
            } catch (err: any) {
                taskManager.updateTask(taskId, { status: 'failed', message: err.message });
            }
        })();
        res.json({ success: true, taskId });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/settings/config', (req, res) => {
    const configPath = path.join(dataDir, 'settings.json');
    let config = {};
    if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json({ success: true, data: config });
});

app.post('/api/settings/config', (req, res) => {
    const configPath = path.join(dataDir, 'settings.json');
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true });
});

const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const indexPath = path.join(frontendDist, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).json({ success: false, error: 'Frontend not built.' });
});

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 2 * * *';
cron.schedule(CRON_SCHEDULE, async () => {
    await scanLibrary(MUSIC_DIR);
    await processPendingTracks();
});

app.get('/api/tasks', (req, res) => res.json({ success: true, data: taskManager.getRecentTasks(50) }));
app.post('/api/tasks/:id/cancel', (req, res) => {
    taskManager.cancelTask(req.params.id);
    res.json({ success: true });
});
app.get('/api/tasks/:id', (req, res) => {
    const task = taskManager.getTask(req.params.id);
    if (task) res.json({ success: true, data: task });
    else res.status(404).json({ success: false, error: 'Task not found' });
});
app.post('/api/tasks/cleanup', (req, res) => {
    taskManager.cleanupOldTasks();
    res.json({ success: true });
});

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 API running on http://0.0.0.0:${PORT}`);
});
