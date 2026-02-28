import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import NodeID3 from 'node-id3';

dotenv.config();

// Ensure config / DB path exist
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../config');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

import { db } from './db';
import { scanLibrary } from './scanner';
import { processPendingTracks, searchITunes, searchNetease, fetchNeteaseLyrics, fetchLyrics } from './scraper';

const app = express();
const PORT = process.env.PORT || 8002;
const MUSIC_DIR = process.env.MUSIC_DIR || path.join(__dirname, '../../examples'); // Default fallback for tests

const upload = multer({ storage: multer.memoryStorage() }); // Multer initialization

app.use(cors());
app.use(express.json());

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

app.post('/api/trigger-scan', async (req, res) => {
    try {
        // Do not block response for full scan
        scanLibrary(MUSIC_DIR).catch(err => console.error("Scan error:", err));
        res.json({ success: true, message: 'Scan job triggered in background.' });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/trigger-scrape', async (req, res) => {
    try {
        // Do not block response for scrape job
        processPendingTracks().catch(err => console.error("Scraper error:", err));
        res.json({ success: true, message: 'Scrape batch job triggered in background.' });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/tracks', (req, res) => {
    try {
        const folder = req.query.folder as string || '';
        const limit = 1000; // Increase limit for folder view or remove pagination

        let tracks;
        let subfolders = new Set<string>();

        // We fetch all tracks and figure out the directory structure
        // Since sqlite doesn't have a tree structure natively, we can parse relative to MUSIC_DIR
        const allTracks = db.prepare(`SELECT * FROM tracks ORDER BY filepath ASC`).all() as any[];

        const currentTracks: any[] = [];

        Object.values(allTracks).forEach(track => {
            // Get relative path from MUSIC_DIR
            const relativePath = path.relative(MUSIC_DIR, track.filepath);
            const dirName = path.dirname(relativePath).replace(/\\/g, '/');

            // Normalize requested folder
            const requestFolder = folder.replace(/\\/g, '/').replace(/^\/|\/$/g, '');
            const trackFolder = dirName === '.' ? '' : dirName;

            if (trackFolder === requestFolder || (!requestFolder && trackFolder === '')) {
                // Track is directly in this folder
                currentTracks.push(track);
            } else if (trackFolder.startsWith(requestFolder ? requestFolder + '/' : '')) {
                // Track is in a subfolder, extract the immediate subfolder name
                const remainder = trackFolder.substring(requestFolder ? requestFolder.length + 1 : 0);
                const immediateSubfolder = remainder.split('/')[0];
                if (immediateSubfolder) {
                    subfolders.add(immediateSubfolder);
                }
            }
        });

        res.json({
            success: true,
            data: {
                folders: Array.from(subfolders).sort(),
                tracks: currentTracks
            }
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Advanced: Auto reorganize
app.post('/api/tracks/organize', (req, res) => {
    try {
        const { levels } = req.body;

        const allTracks = db.prepare(`SELECT * FROM tracks ORDER BY filepath ASC`).all() as any[];
        let organizedCount = 0;

        db.transaction(() => {
            Object.values(allTracks).forEach(track => {
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
                    } catch (e) {
                        console.error(`Failed to move ${track.filepath}:`, e);
                    }
                }
            });
        })();

        res.json({ success: true, count: organizedCount });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Advanced: Batch rename feature
app.post('/api/tracks/batch-rename', (req, res) => {
    try {
        const folder = req.body.folder as string || '';

        // Find all tracks in the specified folder (non-recursive)
        const allTracks = db.prepare(`SELECT * FROM tracks ORDER BY filepath ASC`).all() as any[];
        let renamedCount = 0;

        db.transaction(() => {
            Object.values(allTracks).forEach(track => {
                const relativePath = path.relative(MUSIC_DIR, track.filepath);
                const dirName = path.dirname(relativePath).replace(/\\/g, '/');
                const requestFolder = folder.replace(/\\/g, '/').replace(/^\/|\/$/g, '');
                const trackFolder = dirName === '.' ? '' : dirName;

                if (trackFolder === requestFolder && track.scrape_status === 1) {
                    // Only rename tracks that have successful metadata (title & artist)
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
                                console.error(`Failed to rename ${track.filepath}:`, renameErr);
                            }
                        }
                    }
                }
            });
        })();

        res.json({ success: true, count: renamedCount, message: `Successfully normalized ${renamedCount} file names.` });
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
        } else {
            // Netease acts as fallback for 'netease', 'qq', 'spotify' placeholders
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

// STARTUP: Setup Cron Job
// Scrape Schedule (Default everyday at 2 AM)
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 2 * * *';
cron.schedule(CRON_SCHEDULE, async () => {
    console.log(`⏰ [Cron] Executing scheduled music scan...`);
    await scanLibrary(MUSIC_DIR);
    console.log(`⏰ [Cron] Triggering auto-scraper job...`);
    await processPendingTracks();
});

app.listen(PORT, () => {
    console.log(`🚀 Music Tag Auto-Scraper API running on port ${PORT}`);
    console.log(`📂 Music Directory watched: ${MUSIC_DIR}`);
    console.log(`🗄️ Database Directory: ${dataDir}`);
    console.log(`⏳ Auto-Scrape Schedule: ${CRON_SCHEDULE}`);
});
