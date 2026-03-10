import axios from 'axios';
import path from 'path';
import fs from 'fs';
import NodeID3 from 'node-id3';
const Metaflac = require('metaflac-js');
import { db } from './db';
import * as mm from 'music-metadata';
import { taskManager } from './taskManager';
import { scanLibrary } from './scanner';
import { processPendingTracks, searchNetease, searchQQMusic } from './scraper';
import { downloadAndTagQQMusicSong } from './qqmusic';
import { downloadAndTagNeteaseSong } from './netease';

export async function downloadAndTagKugouSong(musicDir: string, hash: string, level: string = 'exhigh', taskId?: string): Promise<string> {
    const log = (msg: string) => {
        if (taskId) taskManager.addLog(taskId, msg);
        console.log(`[Kugou] ${msg}`);
    };
    try {
        // Try original Kugou Mobile API first with Android UA
        const playUrl = `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;
        const playRes = await axios.get(playUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Android' }
        });

        const data = playRes.data;
        let downloadUrl = data?.url;
        let title = data?.songName || 'Unknown Title';
        let artist = data?.singerName || 'Unknown Artist';
        let album = data?.albumName || '';
        let coverUrl = data?.imgUrl ? data.imgUrl.replace('{size}', '400') : null;
        const safeArtist = artist.replace(/[<>:"/\\|?*]+/g, '_').trim();
        const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '_').trim();

        // If official URL is missing (VIP or restricted), attempt fallback
        if (!downloadUrl) {
            log(`Official URL missing (VIP or restricted). Attempting fallback for ${title} - ${artist}...`);
            // Attempt fallback on QQ Music
            const qqResults = await searchQQMusic(`${title} ${artist}`);
            if (qqResults.length > 0) {
                const bestMatch = qqResults[0];
                log(`[Kugou Fallback] Found match on QQ Music: ${bestMatch.id}`);
                return await downloadAndTagQQMusicSong(musicDir, bestMatch.id, level, undefined, taskId);
            }
            // Fallback on Netease
            const neteaseResults = await searchNetease(`${title} ${artist}`);
            if (neteaseResults.length > 0) {
                const bestMatch = neteaseResults[0];
                log(`[Kugou Fallback] Found match on Netease: ${bestMatch.id}`);
                // 注意：这里需要传入 db。
                await downloadAndTagNeteaseSong(bestMatch.id, musicDir, db, level, '', taskId);
                return path.join(musicDir, 'Downloads', `${safeArtist} - ${safeTitle}.mp3`);
            }
            throw new Error('酷狗资源受限（VIP），且全网平替（QQ/网易云）均未命中。');
        }
        const ext = '.mp3';
        const filename = `${safeArtist} - ${safeTitle}${ext}`;

        const downloadsDir = path.join(musicDir, 'Downloads');
        if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
        const filepath = path.join(downloadsDir, filename);

        log(`Downloading: ${filename}`);
        const audioRes = await axios.get(downloadUrl, {
            responseType: 'stream',
            timeout: 30000,
            headers: { 'User-Agent': 'Android' }
        });
        const writer = fs.createWriteStream(filepath);
        audioRes.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Tagging
        let coverBuffer: Buffer | null = null;
        if (coverUrl) {
            try {
                const imgRes = await axios.get(coverUrl, { responseType: 'arraybuffer', timeout: 8000 });
                coverBuffer = Buffer.from(imgRes.data, 'binary');
            } catch (e) { }
        }

        const tags: any = { title, artist, album };
        if (coverBuffer) {
            tags.image = {
                mime: 'image/jpeg',
                type: { id: 3, name: 'front cover' },
                description: 'Cover',
                imageBuffer: coverBuffer
            };
        }
        NodeID3.write(tags, filepath);

        // Technical metadata
        let duration = 0;
        let bitrate = 0;
        let size = 0;
        try {
            const metadata = await mm.parseFile(filepath);
            duration = metadata.format.duration || 0;
            bitrate = metadata.format.bitrate || 0;
            size = fs.statSync(filepath).size;
        } catch (e) {
            log(`Failed to parse technical metadata: ${e}`);
        }

        // DB
        const dbId = 'kugou_' + hash;
        const stmt = db.prepare(`
            INSERT INTO tracks (id, filepath, filename, extension, title, artist, album, duration, bitrate, size, scrape_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(filepath) DO UPDATE SET 
                scrape_status = 1,
                duration = excluded.duration,
                bitrate = excluded.bitrate,
                size = excluded.size
        `);
        stmt.run(dbId, filepath, filename, ext, title, artist, album, duration, bitrate, size);

        return filepath;
    } catch (e: any) {
        console.error(`[Kugou] Download failed: ${e.message}`);
        throw e;
    }
}
