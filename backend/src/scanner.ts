import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import * as mm from 'music-metadata';
import { db } from './db';

import { taskManager } from './taskManager';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a', '.wav', '.ogg']);

export async function scanLibrary(musicDir: string, taskId?: string) {
    const log = (msg: string) => {
        if (taskId) {
            taskManager.addLog(taskId, msg);
        } else {
            console.log(msg);
        }
    };

    log(`🔍 [Scanner] Starting full library scan on: ${musicDir}`);
    if (taskId) taskManager.updateTask(taskId, { status: 'running', progress: 0 });

    let scannedCount = 0;
    let addedCount = 0;

    // Prepared statements for DB operations
    const getTrackByPath = db.prepare('SELECT id FROM tracks WHERE filepath = ?');
    const insertTrack = db.prepare(`
        INSERT INTO tracks (id, filepath, filename, extension, title, artist, album, bitrate, sample_rate, duration, size, scrape_status) 
        VALUES (@id, @filepath, @filename, @extension, @title, @artist, @album, @bitrate, @sample_rate, @duration, @size, 0)
    `);

    const updateTechnicalMeta = db.prepare(`
        UPDATE tracks SET size = @size, bitrate = @bitrate, sample_rate = @sample_rate, duration = @duration
        WHERE filepath = @filepath
    `);

    const cleanupStmt = db.prepare('DELETE FROM tracks WHERE filepath = ?');
    const allKnownFiles = db.prepare('SELECT filepath FROM tracks').all() as { filepath: string }[];

    async function walk(currentDir: string) {
        if (!fs.existsSync(currentDir)) return;

        const files = await fs.promises.readdir(currentDir, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(currentDir, file.name);

            if (file.isDirectory()) {
                await walk(fullPath);
            } else {
                const ext = path.extname(file.name).toLowerCase();

                if (AUDIO_EXTENSIONS.has(ext)) {
                    scannedCount++;
                    const existing = getTrackByPath.get(fullPath);
                    if (!existing) {
                        try {
                            const metadata = await mm.parseFile(fullPath);
                            const common = metadata.common;
                            const format = metadata.format;
                            const stats = fs.statSync(fullPath);

                            const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

                            insertTrack.run({
                                id,
                                filepath: fullPath,
                                filename: file.name,
                                extension: ext,
                                title: common.title || path.basename(file.name, ext),
                                artist: common.artist || common.albumartist || 'Unknown Artist',
                                album: common.album || 'Unknown Album',
                                bitrate: format.bitrate || 0,
                                sample_rate: format.sampleRate || 0,
                                duration: format.duration || 0,
                                size: stats.size,
                            });
                            addedCount++;
                            if (addedCount % 10 === 0 && taskId) {
                                taskManager.updateTask(taskId, { message: `Scanning... found ${addedCount} new tracks` });
                            }

                        } catch (err: any) {
                            log(`❌ [Scanner] Error parsing metadata for ${fullPath}: ${err.message}`);
                        }
                    } else {
                        try {
                            const stats = fs.statSync(fullPath);
                            // Only re-parse metadata if essential technical info is missing
                            const trackInfo = db.prepare('SELECT duration, bitrate, size FROM tracks WHERE filepath = ?').get(fullPath) as any;

                            if (!trackInfo || !trackInfo.duration || !trackInfo.bitrate || trackInfo.size !== stats.size) {
                                const metadata = await mm.parseFile(fullPath);
                                updateTechnicalMeta.run({
                                    size: stats.size,
                                    bitrate: metadata.format.bitrate || 0,
                                    sample_rate: metadata.format.sampleRate || 0,
                                    duration: metadata.format.duration || 0,
                                    filepath: fullPath
                                });
                            }
                        } catch (err) {
                            // Silent skip
                        }
                    }
                }
            }
        }
    }

    await walk(musicDir);

    log(`🧹 [Scanner] Cleaning up orphan records...`);
    let cleanupCount = 0;
    for (const record of allKnownFiles) {
        if (!fs.existsSync(record.filepath)) {
            cleanupStmt.run(record.filepath);
            cleanupCount++;
        }
    }

    const resultMsg = `✅ [Scanner] Scan complete. Found ${scannedCount} files, added ${addedCount} new, removed ${cleanupCount} orphans.`;
    log(resultMsg);

    if (taskId) {
        taskManager.updateTask(taskId, {
            status: 'completed',
            progress: 100,
            message: resultMsg,
            result: JSON.stringify({ scannedCount, addedCount, cleanupCount })
        });
    }
}
