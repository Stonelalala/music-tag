import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import * as mm from 'music-metadata';
import { db } from './db';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a', '.wav', '.ogg']);

export async function scanLibrary(musicDir: string) {
    console.log(`🔍 [Scanner] Starting full library scan on: ${musicDir}`);

    let scannedCount = 0;
    let addedCount = 0;

    // Prepared statements for DB operations
    const getTrackByPath = db.prepare('SELECT id FROM tracks WHERE filepath = ?');
    const insertTrack = db.prepare(`
        INSERT INTO tracks (id, filepath, filename, extension, title, artist, album, scrape_status) 
        VALUES (@id, @filepath, @filename, @extension, @title, @artist, @album, 0)
    `);

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
                    // Check if track is already tracking in DB
                    const existing = getTrackByPath.get(fullPath);
                    if (!existing) {
                        try {
                            const metadata = await mm.parseFile(fullPath, { duration: false });
                            const common = metadata.common;

                            // Let's generate a stable ID based on path or basic info
                            const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

                            // Insert into database, mark as Pending (0)
                            insertTrack.run({
                                id,
                                filepath: fullPath,
                                filename: file.name,
                                extension: ext,
                                title: common.title || path.basename(file.name, ext),
                                artist: common.artist || common.albumartist || 'Unknown Artist',
                                album: common.album || 'Unknown Album',
                            });
                            addedCount++;

                        } catch (err: any) {
                            console.error(`❌ [Scanner] Error parsing metadata for ${fullPath}: ${err.message}`);
                        }
                    }
                }
            }
        }
    }

    await walk(musicDir);
    console.log(`✅ [Scanner] Scan complete. Found ${scannedCount} audio files, added ${addedCount} new files for future scraping.`);
}
