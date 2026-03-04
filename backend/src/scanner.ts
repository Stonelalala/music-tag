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
        INSERT INTO tracks (id, filepath, filename, extension, title, artist, album, bitrate, sample_rate, duration, size, scrape_status) 
        VALUES (@id, @filepath, @filename, @extension, @title, @artist, @album, @bitrate, @sample_rate, @duration, @size, 0)
    `);

    const updateTechnicalMeta = db.prepare(`
        UPDATE tracks SET size = @size
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

                        } catch (err: any) {
                            console.error(`❌ [Scanner] Error parsing metadata for ${fullPath}: ${err.message}`);
                        }
                    } else {
                        // For existing records, only update the file size (no-cost stat call).
                        // Re-parsing audio metadata for every known file on every scan is
                        // extremely expensive: music-metadata reads and allocates large Buffers
                        // (including embedded cover art) for each file, causing memory spikes.
                        try {
                            const stats = fs.statSync(fullPath);
                            updateTechnicalMeta.run({
                                size: stats.size,
                                filepath: fullPath
                            });
                        } catch (err) {
                            // Silent skip
                        }
                    }
                }
            }
        }
    }

    await walk(musicDir);

    console.log(`🧹 [Scanner] Cleaning up orphan records...`);
    for (const record of allKnownFiles) {
        if (!fs.existsSync(record.filepath)) {
            cleanupStmt.run(record.filepath);
        }
    }

    console.log(`✅ [Scanner] Scan complete. Found ${scannedCount} audio files, added ${addedCount} new files for future scraping.`);
}
