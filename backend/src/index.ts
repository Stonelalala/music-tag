import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import NodeID3 from 'node-id3';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

// Ensure config / DB path exist
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../config');
console.log(`[Config] Data directory: ${dataDir}`);
if (!fs.existsSync(dataDir)) {
    console.log(`[Config] Creating data directory: ${dataDir}`);
    fs.mkdirSync(dataDir, { recursive: true });
}

import { db } from './db';
import { scanLibrary } from './scanner';
import {
    processPendingTracks,
    searchNetease,
    searchITunes,
    searchQQMusic,
    searchKugou,
    searchKuwo,
    fetchNeteaseLyrics,
    fetchLyrics,
    fetchQQMusicLyrics
} from './scraper';
import { downloadAndTagKugouSong } from './kugou';
import { downloadAndTagKuwoSong } from './kuwo';
import {
    buildDuplicateGroups,
    type DuplicateTrackCandidate
} from './utils/duplicate_finder';
import { runNeteaseDailySyncPipeline } from './netease_daily_sync';
import {
    getUserPreferences,
    isNeteaseDailySyncEnabled
} from './user_preferences';

const app = express();

app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

const PORT = process.env.PORT || 8002;
const MUSIC_DIR = process.env.MUSIC_DIR || path.join(__dirname, '../../examples');

const upload = multer({ storage: multer.memoryStorage() });

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

const getUserId = (req: any) => (req as any).user?.id as string;

const ensureTrackExists = (trackId: string) => {
    return db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId) as any;
};

const uniqueTrackIds = (trackIds: unknown): string[] => {
    if (!Array.isArray(trackIds)) {
        return [];
    }
    return Array.from(
        new Set(
            trackIds
                .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
                .map((item) => item.trim())
        )
    );
};

const insertPlaylistTrack = db.prepare(`
    INSERT INTO playlist_tracks (playlist_id, track_id, sort_order)
    SELECT ?, ?, ?
    WHERE NOT EXISTS (
        SELECT 1
        FROM playlist_tracks
        WHERE playlist_id = ? AND track_id = ?
    )
`);

const upsertUserPreference = db.prepare(`
    INSERT INTO user_preferences (user_id, preference_key, preference_value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        updated_at = CURRENT_TIMESTAMP
`);

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
        const taskId = taskManager.createTask('scan', 'Library scan triggered', undefined, undefined, 0);
        // Do not block response for full scan
        scanLibrary(MUSIC_DIR, taskId).catch(err => console.error("Scan error:", err));
        res.json({ success: true, taskId, message: 'Scan job triggered in background.' });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/trigger-scrape', async (req, res) => {
    try {
        const taskId = taskManager.createTask('scrape', 'Batch scraping triggered', undefined, undefined, 0);
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

app.post('/api/tracks/:id/play', (req, res) => {
    try {
        const trackId = req.params.id;
        const userId = getUserId(req);
        const track = ensureTrackExists(trackId);
        if (!track) {
            return res.status(404).json({ success: false, error: 'Track not found' });
        }

        db.prepare(
            'INSERT INTO play_history (user_id, track_id) VALUES (?, ?)'
        ).run(userId, trackId);

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/history', (req, res) => {
    try {
        const userId = getUserId(req);
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const rows = db.prepare(`
            SELECT t.*, h.played_at as last_played_at
            FROM play_history h
            JOIN tracks t ON t.id = h.track_id
            WHERE h.user_id = ?
              AND h.id IN (
                SELECT MAX(id)
                FROM play_history
                WHERE user_id = ?
                GROUP BY track_id
              )
            ORDER BY h.played_at DESC
            LIMIT ?
        `).all(userId, userId, limit) as any[];
        res.json({ success: true, data: rows });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/play-stats', (req, res) => {
    try {
        const userId = getUserId(req);
        const totalPlays = (db.prepare(
            'SELECT COUNT(*) as count FROM play_history WHERE user_id = ?'
        ).get(userId) as any).count as number;
        const uniqueTracks = (db.prepare(
            'SELECT COUNT(DISTINCT track_id) as count FROM play_history WHERE user_id = ?'
        ).get(userId) as any).count as number;
        const favoriteTracks = (db.prepare(
            'SELECT COUNT(*) as count FROM favorites WHERE user_id = ?'
        ).get(userId) as any).count as number;
        const playlists = (db.prepare(
            'SELECT COUNT(*) as count FROM playlists WHERE user_id = ?'
        ).get(userId) as any).count as number;

        const topTracks = db.prepare(`
            SELECT t.*, COUNT(h.id) as play_count, MAX(h.played_at) as last_played_at
            FROM play_history h
            JOIN tracks t ON t.id = h.track_id
            WHERE h.user_id = ?
            GROUP BY h.track_id
            ORDER BY play_count DESC, last_played_at DESC
            LIMIT 10
        `).all(userId) as any[];

        res.json({
            success: true,
            data: {
                totalPlays,
                uniqueTracks,
                favoriteTracks,
                playlists,
                topTracks,
            }
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/favorites', (req, res) => {
    try {
        const userId = getUserId(req);
        const rows = db.prepare(`
            SELECT t.*, f.created_at as favorited_at
            FROM favorites f
            JOIN tracks t ON t.id = f.track_id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        `).all(userId) as any[];
        res.json({ success: true, data: rows });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/favorites/:trackId/status', (req, res) => {
    try {
        const userId = getUserId(req);
        const trackId = req.params.trackId;
        const favorite = db.prepare(
            'SELECT 1 FROM favorites WHERE user_id = ? AND track_id = ?'
        ).get(userId, trackId);
        res.json({ success: true, data: { isFavorite: !!favorite } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/favorites/:trackId', (req, res) => {
    try {
        const userId = getUserId(req);
        const trackId = req.params.trackId;
        const track = ensureTrackExists(trackId);
        if (!track) {
            return res.status(404).json({ success: false, error: 'Track not found' });
        }

        db.prepare(
            'INSERT OR IGNORE INTO favorites (user_id, track_id) VALUES (?, ?)'
        ).run(userId, trackId);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/favorites/:trackId', (req, res) => {
    try {
        const userId = getUserId(req);
        const trackId = req.params.trackId;
        db.prepare(
            'DELETE FROM favorites WHERE user_id = ? AND track_id = ?'
        ).run(userId, trackId);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/playlists', (req, res) => {
    try {
        const userId = getUserId(req);
        const rows = db.prepare(`
            SELECT
                p.*,
                COUNT(pt.track_id) as track_count,
                COALESCE(
                    (
                    SELECT pt_cover.track_id
                    FROM playlist_tracks pt_cover
                    WHERE pt_cover.playlist_id = p.id
                      AND pt_cover.track_id = NULLIF(p.cover, '')
                    LIMIT 1
                    ),
                    (
                    SELECT pt2.track_id
                    FROM playlist_tracks pt2
                    WHERE pt2.playlist_id = p.id
                    ORDER BY pt2.sort_order ASC, pt2.created_at ASC
                    LIMIT 1
                    )
                ) as cover_track_id
            FROM playlists p
            LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
            WHERE p.user_id = ?
            GROUP BY p.id
            ORDER BY p.updated_at DESC, p.created_at DESC
        `).all(userId) as any[];
        res.json({ success: true, data: rows });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/playlists', (req, res) => {
    try {
        const userId = getUserId(req);
        const name = String(req.body?.name || '').trim();
        const trackIds = uniqueTrackIds(req.body?.trackIds);
        const coverTrackId = typeof req.body?.coverTrackId === 'string'
            ? req.body.coverTrackId.trim()
            : '';
        if (!name) {
            return res.status(400).json({ success: false, error: 'Playlist name is required' });
        }

        const id = crypto.randomUUID();
        db.transaction(() => {
            db.prepare(
                'INSERT INTO playlists (id, user_id, name, cover) VALUES (?, ?, ?, ?)'
            ).run(id, userId, name, coverTrackId || null);

            trackIds.forEach((trackId, index) => {
                if (!ensureTrackExists(trackId)) {
                    return;
                }
                insertPlaylistTrack.run(id, trackId, index, id, trackId);
            });
        })();

        const playlist = db.prepare(
            'SELECT *, COALESCE(NULLIF(cover, \'\'), NULL) as cover_track_id FROM playlists WHERE id = ?'
        ).get(id) as any;
        res.json({ success: true, data: { ...playlist, track_count: trackIds.length } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch('/api/playlists/:id', (req, res) => {
    try {
        const userId = getUserId(req);
        const id = req.params.id;
        const name = String(req.body?.name || '').trim();
        const coverTrackId = typeof req.body?.coverTrackId === 'string'
            ? req.body.coverTrackId.trim()
            : null;
        const updates: string[] = [];
        const params: unknown[] = [];

        if (name.length > 0) {
            updates.push('name = ?');
            params.push(name);
        }
        if (coverTrackId != null) {
            updates.push('cover = ?');
            params.push(coverTrackId.length == 0 ? null : coverTrackId);
        }
        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'Nothing to update' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id, userId);

        const result = db.prepare(
            `UPDATE playlists SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
        ).run(...params);
        if (!result.changes) {
            return res.status(404).json({ success: false, error: 'Playlist not found' });
        }
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/playlists/:id', (req, res) => {
    try {
        const userId = getUserId(req);
        const id = req.params.id;
        db.transaction(() => {
            db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(id);
            db.prepare('DELETE FROM playlists WHERE id = ? AND user_id = ?').run(id, userId);
        })();
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/playlists/smart', (req, res) => {
    try {
        const playlists = [
            {
                id: 'smart:most-played',
                name: '最常播放',
                description: '根据播放次数自动生成',
            },
            {
                id: 'smart:recent-added',
                name: '最近添加',
                description: '优先展示最近入库的歌曲',
            },
            {
                id: 'smart:rediscover',
                name: '重新发现',
                description: '把很久没听的歌重新带回来',
            },
        ];
        res.json({ success: true, data: playlists });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/playlists/smart/:key', (req, res) => {
    try {
        const userId = getUserId(req);
        const key = req.params.key;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        let name = '';
        let tracks: any[] = [];

        if (key === 'most-played') {
            name = '最常播放';
            tracks = db.prepare(`
                SELECT t.*, COUNT(h.id) as play_count, MAX(h.played_at) as last_played_at
                FROM play_history h
                JOIN tracks t ON t.id = h.track_id
                WHERE h.user_id = ?
                GROUP BY h.track_id
                ORDER BY play_count DESC, last_played_at DESC
                LIMIT ?
            `).all(userId, limit) as any[];
        } else if (key === 'recent-added') {
            name = '最近添加';
            tracks = db.prepare(`
                SELECT *
                FROM tracks
                ORDER BY created_at DESC, id DESC
                LIMIT ?
            `).all(limit) as any[];
        } else if (key === 'rediscover') {
            name = '重新发现';
            tracks = db.prepare(`
                SELECT
                    t.*,
                    MAX(h.played_at) as last_played_at
                FROM tracks t
                LEFT JOIN play_history h
                    ON h.track_id = t.id AND h.user_id = ?
                GROUP BY t.id
                ORDER BY
                    CASE WHEN last_played_at IS NULL THEN 0 ELSE 1 END ASC,
                    last_played_at ASC,
                    t.created_at DESC
                LIMIT ?
            `).all(userId, limit) as any[];
        } else {
            return res.status(404).json({ success: false, error: 'Smart playlist not found' });
        }

        res.json({
            success: true,
            data: {
                id: `smart:${key}`,
                name,
                track_count: tracks.length,
                tracks,
            }
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/playlists/:id', (req, res) => {
    try {
        const userId = getUserId(req);
        const id = req.params.id;
        const playlist = db.prepare(`
            SELECT
                p.*,
                COUNT(pt.track_id) as track_count,
                COALESCE(
                    (
                    SELECT pt_cover.track_id
                    FROM playlist_tracks pt_cover
                    WHERE pt_cover.playlist_id = p.id
                      AND pt_cover.track_id = NULLIF(p.cover, '')
                    LIMIT 1
                    ),
                    (
                    SELECT pt2.track_id
                    FROM playlist_tracks pt2
                    WHERE pt2.playlist_id = p.id
                    ORDER BY pt2.sort_order ASC, pt2.created_at ASC
                    LIMIT 1
                    )
                ) as cover_track_id
            FROM playlists p
            LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
            WHERE p.id = ? AND p.user_id = ?
            GROUP BY p.id
        `).get(id, userId) as any;
        if (!playlist) {
            return res.status(404).json({ success: false, error: 'Playlist not found' });
        }

        const tracks = db.prepare(`
            SELECT t.*, pt.sort_order, pt.created_at as added_at
            FROM playlist_tracks pt
            JOIN tracks t ON t.id = pt.track_id
            WHERE pt.playlist_id = ?
            ORDER BY pt.sort_order ASC, pt.created_at ASC
        `).all(id) as any[];

        res.json({ success: true, data: { ...playlist, tracks } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/playlists/:id/tracks', (req, res) => {
    try {
        const userId = getUserId(req);
        const playlistId = req.params.id;
        const playlist = db.prepare(
            'SELECT * FROM playlists WHERE id = ? AND user_id = ?'
        ).get(playlistId, userId) as any;
        if (!playlist) {
            return res.status(404).json({ success: false, error: 'Playlist not found' });
        }

        const trackIds = Array.isArray(req.body?.trackIds)
            ? req.body.trackIds
            : req.body?.trackId
                ? [req.body.trackId]
                : [];
        if (!trackIds.length) {
            return res.status(400).json({ success: false, error: 'Track id is required' });
        }

        const maxSort = (db.prepare(
            'SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM playlist_tracks WHERE playlist_id = ?'
        ).get(playlistId) as any).max_sort as number;

        db.transaction(() => {
            trackIds.forEach((trackId: string, index: number) => {
                if (!ensureTrackExists(trackId)) {
                    return;
                }
                db.prepare(`
                    INSERT INTO playlist_tracks (playlist_id, track_id, sort_order)
                    SELECT ?, ?, ?
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM playlist_tracks
                        WHERE playlist_id = ? AND track_id = ?
                    )
                `).run(
                    playlistId,
                    trackId,
                    maxSort + index + 1,
                    playlistId,
                    trackId
                );
            });
            db.prepare(
                'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).run(playlistId);
        })();

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/playlists/:id/tracks/:trackId', (req, res) => {
    try {
        const userId = getUserId(req);
        const playlistId = req.params.id;
        const trackId = req.params.trackId;
        const playlist = db.prepare(
            'SELECT * FROM playlists WHERE id = ? AND user_id = ?'
        ).get(playlistId, userId) as any;
        if (!playlist) {
            return res.status(404).json({ success: false, error: 'Playlist not found' });
        }

        db.transaction(() => {
            db.prepare(
                'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?'
            ).run(playlistId, trackId);
            db.prepare(
                'UPDATE playlists SET cover = NULL WHERE id = ? AND cover = ?'
            ).run(playlistId, trackId);
            db.prepare(
                'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).run(playlistId);
        })();
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.put('/api/playlists/:id/tracks/reorder', (req, res) => {
    try {
        const userId = getUserId(req);
        const playlistId = req.params.id;
        const playlist = db.prepare(
            'SELECT * FROM playlists WHERE id = ? AND user_id = ?'
        ).get(playlistId, userId) as any;
        if (!playlist) {
            return res.status(404).json({ success: false, error: 'Playlist not found' });
        }

        const trackIds = uniqueTrackIds(req.body?.trackIds);
        const coverTrackId = typeof req.body?.coverTrackId === 'string'
            ? req.body.coverTrackId.trim()
            : null;
        if (trackIds.length === 0) {
            return res.status(400).json({ success: false, error: 'Track ids are required' });
        }

        db.transaction(() => {
            trackIds.forEach((trackId, index) => {
                db.prepare(`
                    UPDATE playlist_tracks
                    SET sort_order = ?
                    WHERE playlist_id = ? AND track_id = ?
                `).run(index, playlistId, trackId);
            });

            if (coverTrackId != null) {
                const normalizedCoverTrackId = trackIds.includes(coverTrackId)
                    ? coverTrackId
                    : '';
                db.prepare(
                    'UPDATE playlists SET cover = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
                ).run(normalizedCoverTrackId.length === 0 ? null : normalizedCoverTrackId, playlistId);
            } else {
                db.prepare(
                    'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
                ).run(playlistId);
            }
        })();

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/data/export', (req, res) => {
    try {
        const userId = getUserId(req);

        const favorites = db.prepare(`
            SELECT track_id
            FROM favorites
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).all(userId) as Array<{ track_id: string }>;

        const playlists = db.prepare(`
            SELECT id, name, cover, created_at, updated_at
            FROM playlists
            WHERE user_id = ?
            ORDER BY updated_at DESC, created_at DESC
        `).all(userId) as any[];

        const playlistPayload = playlists.map((playlist) => ({
            ...playlist,
            tracks: (db.prepare(`
                SELECT track_id
                FROM playlist_tracks
                WHERE playlist_id = ?
                ORDER BY sort_order ASC, created_at ASC
            `).all(playlist.id) as Array<{ track_id: string }>).map((item) => item.track_id),
        }));

        const history = db.prepare(`
            SELECT track_id, played_at
            FROM play_history
            WHERE user_id = ?
            ORDER BY played_at DESC
            LIMIT 500
        `).all(userId) as Array<{ track_id: string; played_at: string }>;

        const preferences = getUserPreferences(userId).map((item) => ({
            key: item.preference_key,
            value: item.preference_value,
            updated_at: item.updated_at,
        }));

        res.json({
            success: true,
            data: {
                exported_at: new Date().toISOString(),
                favorites: favorites.map((item) => item.track_id),
                playlists: playlistPayload,
                history,
                preferences,
            },
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/data/import', (req, res) => {
    try {
        const userId = getUserId(req);
        const payload = req.body?.data ?? req.body ?? {};
        const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
        const favorites = uniqueTrackIds(payload.favorites);
        const playlists = Array.isArray(payload.playlists) ? payload.playlists : [];
        const history = Array.isArray(payload.history) ? payload.history : [];
        const preferences = Array.isArray(payload.preferences) ? payload.preferences : [];

        db.transaction(() => {
            if (mode === 'replace') {
                db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
                const playlistIds = (db.prepare(
                    'SELECT id FROM playlists WHERE user_id = ?'
                ).all(userId) as Array<{ id: string }>);
                playlistIds.forEach(({ id }) => {
                    db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(id);
                });
                db.prepare('DELETE FROM playlists WHERE user_id = ?').run(userId);
                db.prepare('DELETE FROM play_history WHERE user_id = ?').run(userId);
                db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(userId);
            }

            favorites.forEach((trackId) => {
                if (!ensureTrackExists(trackId)) {
                    return;
                }
                db.prepare(
                    'INSERT OR IGNORE INTO favorites (user_id, track_id) VALUES (?, ?)'
                ).run(userId, trackId);
            });

            playlists.forEach((playlist: any) => {
                const name = String(playlist?.name || '').trim();
                if (!name) {
                    return;
                }
                const playlistId = crypto.randomUUID();
                const coverTrackId = typeof playlist?.cover === 'string' && playlist.cover.trim().length > 0
                    ? playlist.cover.trim()
                    : null;
                db.prepare(
                    'INSERT INTO playlists (id, user_id, name, cover) VALUES (?, ?, ?, ?)'
                ).run(playlistId, userId, name, coverTrackId);

                uniqueTrackIds(playlist?.tracks).forEach((trackId, index) => {
                    if (!ensureTrackExists(trackId)) {
                        return;
                    }
                    insertPlaylistTrack.run(playlistId, trackId, index, playlistId, trackId);
                });
            });

            history.forEach((item: any) => {
                const trackId = typeof item?.track_id === 'string'
                    ? item.track_id
                    : typeof item?.trackId === 'string'
                        ? item.trackId
                        : '';
                if (!trackId || !ensureTrackExists(trackId)) {
                    return;
                }
                db.prepare(
                    'INSERT INTO play_history (user_id, track_id, played_at) VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP))'
                ).run(userId, trackId, item?.played_at ?? item?.playedAt ?? null);
            });

            preferences.forEach((item: any) => {
                const key = typeof item?.key === 'string' ? item.key.trim() : '';
                if (!key) {
                    return;
                }
                upsertUserPreference.run(userId, key, item?.value == null ? null : JSON.stringify(item.value));
            });
        })();

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/preferences', (req, res) => {
    try {
        const userId = getUserId(req);
        const preferences = getUserPreferences(userId).reduce<Record<string, unknown>>((acc, item) => {
            if (item.preference_value == null) {
                acc[item.preference_key] = null;
                return acc;
            }
            try {
                acc[item.preference_key] = JSON.parse(item.preference_value);
            } catch (_) {
                acc[item.preference_key] = item.preference_value;
            }
            return acc;
        }, {});
        res.json({ success: true, data: preferences });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.put('/api/preferences/:key', (req, res) => {
    try {
        const userId = getUserId(req);
        const key = String(req.params.key || '').trim();
        if (!key) {
            return res.status(400).json({ success: false, error: 'Preference key is required' });
        }
        upsertUserPreference.run(userId, key, req.body?.value == null ? null : JSON.stringify(req.body.value));
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Discovery: Random tracks
app.get('/api/discovery/random', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
        const tracks = db.prepare(`SELECT * FROM tracks ORDER BY RANDOM() LIMIT ?`).all(limit) as any[];
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
        const rows = db.prepare(`
            SELECT
                album,
                COALESCE(NULLIF(TRIM(artist), ''), 'Unknown Artist') AS artist,
                MIN(id) AS id
            FROM tracks 
            WHERE album IS NOT NULL
              AND TRIM(album) <> ''
            GROUP BY album, COALESCE(NULLIF(TRIM(artist), ''), 'Unknown Artist')
            ORDER BY RANDOM() 
            LIMIT 20
        `).all() as any[];
        res.json({ success: true, data: rows });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/discovery/album-tracks', (req, res) => {
    try {
        const album = String(req.query.album || '').trim();
        const artist = String(req.query.artist || '').trim();
        if (!album) {
            return res.status(400).json({ success: false, error: 'Album is required' });
        }

        const conditions = ['album = ?'];
        const values: string[] = [album];
        if (artist) {
            conditions.push(`COALESCE(NULLIF(TRIM(artist), ''), 'Unknown Artist') = ?`);
            values.push(artist);
        }

        const tracks = db.prepare(`
            SELECT *
            FROM tracks
            WHERE ${conditions.join(' AND ')}
            ORDER BY filepath ASC, title COLLATE NOCASE ASC
        `).all(...values) as any[];

        res.json({ success: true, data: tracks });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});
app.post('/api/tracks/organize', (req, res) => {
    try {
        const { levels } = req.body;
        const taskId = taskManager.createTask('organize', 'Library organization triggered', { levels }, undefined, 0);

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
        const deleteFavoritesStmt = db.prepare('DELETE FROM favorites WHERE track_id = ?');
        const deleteHistoryStmt = db.prepare('DELETE FROM play_history WHERE track_id = ?');
        const deletePlaylistTracksStmt = db.prepare('DELETE FROM playlist_tracks WHERE track_id = ?');

        db.transaction(() => {
            for (const id of ids) {
                const track = getStmt.get(id) as any;
                if (track) {
                    try {
                        if (fs.existsSync(track.filepath)) {
                            fs.unlinkSync(track.filepath);
                        }
                        deleteFavoritesStmt.run(id);
                        deleteHistoryStmt.run(id);
                        deletePlaylistTracksStmt.run(id);
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
        const tracks = db.prepare(`
            SELECT
                t.id,
                t.filepath,
                t.filename,
                t.extension,
                t.title,
                COALESCE(t.artist, '') as artist,
                COALESCE(t.album, '') as album,
                COALESCE(t.duration, 0) as duration,
                COALESCE(t.bitrate, 0) as bitrate,
                COALESCE(t.sample_rate, 0) as sample_rate,
                COALESCE(t.size, 0) as size,
                COALESCE(t.scrape_status, 0) as scrape_status
            FROM tracks t
            INNER JOIN (
                SELECT title
                FROM tracks
                WHERE title != '' AND title IS NOT NULL
                GROUP BY title
                HAVING COUNT(*) > 1
            ) dup ON dup.title = t.title
            WHERE t.title != '' AND t.title IS NOT NULL
            ORDER BY t.title ASC, t.artist ASC, t.duration ASC
        `).all() as Array<{
            id: string;
            filepath: string;
            filename: string;
            extension: string;
            title: string;
            artist: string;
            album: string;
            duration: number;
            bitrate: number;
            sample_rate: number;
            size: number;
            scrape_status: number;
        }>;

        const candidates: DuplicateTrackCandidate[] = tracks.map(track => {
            let size = Number(track.size) || 0;
            if (size <= 0) {
                try {
                    size = fs.statSync(track.filepath).size;
                } catch (e) { }
            }

            return {
                id: track.id,
                filepath: track.filepath,
                filename: track.filename,
                extension: track.extension,
                title: track.title,
                artist: track.artist || 'Unknown Artist',
                album: track.album || 'Unknown Album',
                duration: Number(track.duration) || 0,
                bitrate: Number(track.bitrate) || 0,
                sampleRate: Number(track.sample_rate) || 0,
                size,
                scrapeStatus: Number(track.scrape_status) || 0
            };
        });

        const result = buildDuplicateGroups(candidates).map(group => ({
            title: group.title,
            artist: group.artist,
            recommendedKeepId: group.recommendedKeepId,
            files: group.files.map(file => ({
                id: file.id,
                filepath: file.filepath,
                filename: file.filename,
                size: file.size,
                extension: file.extension,
                status: file.scrapeStatus,
                artist: file.artist || 'Unknown Artist',
                album: file.album || 'Unknown Album',
                duration: file.duration,
                bitrate: file.bitrate,
                sampleRate: file.sampleRate,
                qualityScore: file.qualityScore,
                isRecommendedKeep: file.isRecommendedKeep,
                recommendedDelete: file.recommendedDelete
            }))
        }));

        res.json({ success: true, data: result });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Advanced: Batch rename feature
app.post('/api/batch-rename', (req, res) => {
    try {
        const folder = req.body.folder as string || '';
        const taskId = taskManager.createTask('rename', 'Batch rename triggered', { folder }, undefined, 0);

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
        } else if (source === 'kugou') {
            results = await searchKugou(query);
        } else if (source === 'kuwo') {
            results = await searchKuwo(query);
        } else {
            // Netease acts as fallback for 'netease', 'spotify' placeholders
            results = await searchNetease(query);
        }

        res.json({ success: true, results });
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/lyrics/search-web', async (req, res) => {
    try {
        const title = req.query.title as string;
        const artist = req.query.artist as string || '';
        const source = req.query.source as string;
        const id = req.query.id as string;

        console.log(`[Lyrics] Web search requested: source=${source}, id=${id}, title=${title}`);

        let lyrics: string | null = null;

        // Try specific source first if ID is provided
        if (id && source === 'netease') {
            const { fetchNeteaseLyric } = await import('./netease.js');
            lyrics = await fetchNeteaseLyric(id);
        } else if (id && source === 'qq') {
            lyrics = await fetchQQMusicLyrics(id);
        }

        // Fallback to generic LRCLIB search
        if (!lyrics && title) {
            console.log(`[Lyrics] Source-specific fetch failed or not applicable, falling back to LRCLIB: ${title}`);
            lyrics = await fetchLyrics(title, artist);
        }

        console.log(`[Lyrics] Result: ${lyrics ? 'Found (' + lyrics.substring(0, 30) + '...)' : 'Not found'}`);
        res.json({ success: true, lyrics });
    } catch (e: any) {
        console.error(`[Lyrics] Search failed:`, e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/tracks/:id', (req, res) => {
    try {
        const { title, artist, album, year, lyrics } = req.body;
        const id = req.params.id;

        const track = db.prepare('SELECT filepath, extension FROM tracks WHERE id = ?').get(id) as any;
        if (!track) {
            res.status(404).json({ success: false, error: 'Track not found' });
            return;
        }

        if (track.extension === '.mp3') {
            const tags = NodeID3.read(track.filepath) || {};
            const newTags = { ...tags, title, artist, album, year };
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

            if (year !== undefined) {
                flac.removeTag('DATE');
                if (year) flac.setTag(`DATE=${year}`);
            }

            if (lyrics !== undefined) {
                flac.removeTag('LYRICS');
                if (lyrics) flac.setTag(`LYRICS=${lyrics}`);
            }

            flac.save();
        }

        db.prepare('UPDATE tracks SET title = ?, artist = ?, album = ?, year = ?, scrape_status = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(title, artist, album, year ?? null, id);

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
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return config;
        }
    } catch (e) {
        console.error('[Config] Failed to read config file', e);
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
        const cookie = req.query.cookie as string || getStoredConfig().neteaseCookie || '';
        const data = await fetchNeteasePlaylist(id, cookie);
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
        let { url, level = 'exhigh', cookie = '' } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'No URL provided' });

        if (!cookie) {
            cookie = getStoredConfig().neteaseCookie || '';
        }

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
            const playlist = await fetchNeteasePlaylist(parsed.id, cookie);
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
        let { id, level = 'exhigh', cookie = '', isPlaylist = false, name = '', trackIds = [] } = req.body;
        if (!cookie) {
            cookie = getStoredConfig().neteaseCookie || '';
        }
        if (!id && (!isPlaylist || trackIds.length === 0)) {
            return res.status(400).json({ success: false, error: 'ID or trackIds list is required' });
        }

        if (isPlaylist) {
            const mainTaskId = taskManager.createTask('playlist_import', `Importing playlist: ${name || id || 'Custom List'}`, { id, level }, undefined, 1);
            (async () => {
                try {
                    taskManager.updateTask(mainTaskId, { status: 'running', progress: 0 });
                    let finalTrackIds = trackIds;
                    if (finalTrackIds.length === 0) {
                        const playlist = await fetchNeteasePlaylist(id, cookie);
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
                        const childTaskId = taskManager.createTask('download_netease', `[Track ${i + 1}/${total}] ID: ${songId}`, { id: songId, level }, mainTaskId, 2);
                        try {
                            taskManager.updateTask(childTaskId, { status: 'running', progress: 10 });
                            await downloadAndTagNeteaseSong(songId, MUSIC_DIR, db, level, cookie, childTaskId);
                            taskManager.updateTask(childTaskId, { status: 'completed', progress: 100 });
                        } catch (childErr: any) {
                            taskManager.updateTask(childTaskId, { status: 'failed', message: childErr.message });
                        }
                        taskManager.updateTask(mainTaskId, { progress: Math.round(((i + 1) / total) * 100) });
                    }
                    try { await scanLibrary(MUSIC_DIR, mainTaskId); } catch (e) { console.error('Auto scan failed:', e); }
                    try { await processPendingTracks(mainTaskId); } catch (e) { console.error('Auto scrape failed:', e); }
                    taskManager.updateTask(mainTaskId, { status: 'completed', progress: 100 });
                } catch (err: any) {
                    taskManager.updateTask(mainTaskId, { status: 'failed', message: err.message });
                }
            })();
            res.json({ success: true, taskId: mainTaskId });
        } else {
            const taskId = taskManager.createTask('download_netease', `Downloading ID: ${id}`, { id, level }, undefined, 2);
            (async () => {
                try {
                    taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                    await downloadAndTagNeteaseSong(id, MUSIC_DIR, db, level, cookie, taskId);
                    try { await scanLibrary(MUSIC_DIR, taskId); } catch (e) { console.error('Auto scan failed:', e); }
                    try { await processPendingTracks(taskId); } catch (e) { console.error('Auto scrape failed:', e); }
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
        const taskId = taskManager.createTask('download_qq', `Downloading QQMusic song ${id}`, { id, level }, undefined, 2);
        (async () => {
            try {
                taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                await downloadAndTagQQMusicSong(MUSIC_DIR, id, level, cookie, taskId);
                try { await scanLibrary(MUSIC_DIR, taskId); } catch (e) { console.error('Auto scan failed:', e); }
                try { await processPendingTracks(taskId); } catch (e) { console.error('Auto scrape failed:', e); }
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

app.post('/api/kugou/download', async (req, res) => {
    try {
        const { id, level = 'exhigh' } = req.body;
        const taskId = taskManager.createTask('download_kugou', `Downloading Kugou song ${id}`, { id, level }, undefined, 2);
        (async () => {
            try {
                taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                await downloadAndTagKugouSong(MUSIC_DIR, id, level, taskId);
                try { await scanLibrary(MUSIC_DIR, taskId); } catch (e) { console.error('Auto scan failed:', e); }
                try { await processPendingTracks(taskId); } catch (e) { console.error('Auto scrape failed:', e); }
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

app.post('/api/kuwo/download', async (req, res) => {
    try {
        const { id, level = 'exhigh' } = req.body;
        const taskId = taskManager.createTask('download_kuwo', `Downloading Kuwo song ${id}`, { id, level }, undefined, 2);
        (async () => {
            try {
                taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                await downloadAndTagKuwoSong(MUSIC_DIR, id, level, taskId);
                try { await scanLibrary(MUSIC_DIR, taskId); } catch (e) { console.error('Auto scan failed:', e); }
                try { await processPendingTracks(taskId); } catch (e) { console.error('Auto scrape failed:', e); }
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

const finishDownloadTask = async (taskId: string) => {
    try { await scanLibrary(MUSIC_DIR, taskId); } catch (e) { console.error('Auto scan failed:', e); }
    try { await processPendingTracks(taskId); } catch (e) { console.error('Auto scrape failed:', e); }
};

const retryTaskByType = (task: any) => {
    const payload = task?.payload ? JSON.parse(task.payload) : {};

    if (task.type === 'scan') {
        const taskId = taskManager.createTask('scan', 'Library scan retried', undefined, undefined, 1);
        scanLibrary(MUSIC_DIR, taskId).catch((err) => console.error('Scan retry error:', err));
        return taskId;
    }

    if (task.type === 'scrape') {
        const taskId = taskManager.createTask('scrape', 'Batch scraping retried', undefined, undefined, 1);
        processPendingTracks(taskId).catch((err) => console.error('Scrape retry error:', err));
        return taskId;
    }

    if (task.type === 'download_netease') {
        const { id, level = 'exhigh' } = payload;
        const cookie = getStoredConfig().neteaseCookie || '';
        const taskId = taskManager.createTask('download_netease', `Retrying ID: ${id}`, { id, level }, undefined, 3);
        (async () => {
            try {
                taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                await downloadAndTagNeteaseSong(id, MUSIC_DIR, db, level, cookie, taskId);
                await finishDownloadTask(taskId);
                taskManager.updateTask(taskId, { status: 'completed', progress: 100 });
            } catch (err: any) {
                taskManager.updateTask(taskId, { status: 'failed', message: err.message });
            }
        })();
        return taskId;
    }

    if (task.type === 'download_qq') {
        const { id, level = 'exhigh', cookie = '' } = payload;
        const taskId = taskManager.createTask('download_qq', `Retrying QQMusic song ${id}`, { id, level }, undefined, 3);
        (async () => {
            try {
                taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                await downloadAndTagQQMusicSong(MUSIC_DIR, id, level, cookie, taskId);
                await finishDownloadTask(taskId);
                taskManager.updateTask(taskId, { status: 'completed', progress: 100 });
            } catch (err: any) {
                taskManager.updateTask(taskId, { status: 'failed', message: err.message });
            }
        })();
        return taskId;
    }

    if (task.type === 'download_kugou') {
        const { id, level = 'exhigh' } = payload;
        const taskId = taskManager.createTask('download_kugou', `Retrying Kugou song ${id}`, { id, level }, undefined, 3);
        (async () => {
            try {
                taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                await downloadAndTagKugouSong(MUSIC_DIR, id, level, taskId);
                await finishDownloadTask(taskId);
                taskManager.updateTask(taskId, { status: 'completed', progress: 100 });
            } catch (err: any) {
                taskManager.updateTask(taskId, { status: 'failed', message: err.message });
            }
        })();
        return taskId;
    }

    if (task.type === 'download_kuwo') {
        const { id, level = 'exhigh' } = payload;
        const taskId = taskManager.createTask('download_kuwo', `Retrying Kuwo song ${id}`, { id, level }, undefined, 3);
        (async () => {
            try {
                taskManager.updateTask(taskId, { status: 'running', progress: 10 });
                await downloadAndTagKuwoSong(MUSIC_DIR, id, level, taskId);
                await finishDownloadTask(taskId);
                taskManager.updateTask(taskId, { status: 'completed', progress: 100 });
            } catch (err: any) {
                taskManager.updateTask(taskId, { status: 'failed', message: err.message });
            }
        })();
        return taskId;
    }

    throw new Error('Retry is not supported for this task type');
};

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
    try {
        if (!isNeteaseDailySyncEnabled()) {
            console.log('[Cron] NetEase daily sync skipped because it is disabled.');
            return;
        }
        await runNeteaseDailySyncPipeline(MUSIC_DIR, getStoredConfig().neteaseCookie || '');
    } catch (error) {
        console.error('[Cron] NetEase daily sync failed:', error);
    }
});

app.get('/api/tasks', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    res.json({ success: true, data: taskManager.getRecentTasks(limit) });
});
app.post('/api/tasks/:id/cancel', (req, res) => {
    taskManager.cancelTask(req.params.id);
    res.json({ success: true });
});
app.get('/api/tasks/:id', (req, res) => {
    const task = taskManager.getTask(req.params.id);
    if (task) res.json({ success: true, data: task });
    else res.status(404).json({ success: false, error: 'Task not found' });
});
app.post('/api/tasks/:id/retry', (req, res) => {
    try {
        const task = taskManager.getTask(req.params.id);
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }
        const taskId = retryTaskByType(task);
        res.json({ success: true, taskId });
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});
app.post('/api/tasks/:id/priority', (req, res) => {
    try {
        const task = taskManager.getTask(req.params.id);
        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }
        const priority = Number(req.body?.priority);
        if (Number.isNaN(priority)) {
            return res.status(400).json({ success: false, error: 'Priority must be a number' });
        }
        taskManager.setPriority(req.params.id, priority);
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ success: false, error: e.message });
    }
});
app.post('/api/tasks/cleanup', (req, res) => {
    taskManager.cleanupOldTasks();
    res.json({ success: true });
});

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 API running on http://0.0.0.0:${PORT}`);
});
