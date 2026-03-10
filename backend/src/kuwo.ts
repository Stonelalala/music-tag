import axios from 'axios';
import path from 'path';
import fs from 'fs';
import NodeID3 from 'node-id3';
const Metaflac = require('metaflac-js');
import { db } from './db';
import * as mm from 'music-metadata';
import { taskManager } from './taskManager';
import { scanLibrary } from './scanner';
import { processPendingTracks } from './scraper';

export async function downloadAndTagKuwoSong(musicDir: string, rid: string, level: string = 'exhigh', taskId?: string): Promise<string> {
    const log = (msg: string) => {
        if (taskId) taskManager.addLog(taskId, msg);
        console.log(`[Kuwo] ${msg}`);
    };
    try {
        // Kuwo play info
        const playUrl = `http://antiserver.kuwo.cn/anti.s?response=url&rid=MUSIC_${rid}&format=mp3&type=convert_url`;
        const playRes = await axios.get(playUrl, { timeout: 10000 });
        const downloadUrl = playRes.data;
        if (!downloadUrl || !downloadUrl.startsWith('http')) throw new Error('Kuwo download URL not found');

        // Kuwo detail (to get title/artist)
        const detailUrl = `http://search.kuwo.cn/r.s?client=kt&all=MUSIC_${rid}&pn=0&rn=1&rformat=json&encoding=utf8`;
        const detailRes = await axios.get(detailUrl, { timeout: 10000 });
        const dataStr = detailRes.data.replace(/'/g, '"').replace(/&nbsp;/g, ' ');
        const data = JSON.parse(dataStr);
        const song = data.abslist?.[0] || {};

        const title = song.SONGNAME || 'Unknown Title';
        const artist = song.ARTIST || 'Unknown Artist';
        const album = song.ALBUM || '';
        const coverUrl = song.web_albumpic_short ? `http://img1.kuwo.cn/star/albumcover/${song.web_albumpic_short}` : null;

        const safeArtist = artist.replace(/[<>:"/\\|?*]+/g, '_').trim();
        const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '_').trim();
        const ext = '.mp3';
        const filename = `${safeArtist} - ${safeTitle}${ext}`;

        const downloadsDir = path.join(musicDir, 'Downloads');
        if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });
        const filepath = path.join(downloadsDir, filename);

        log(`Downloading: ${filename}`);
        const audioRes = await axios.get(downloadUrl, { responseType: 'stream', timeout: 30000 });
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
        const dbId = 'kuwo_' + rid;
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
        console.error(`[Kuwo] Download failed: ${e.message}`);
        throw e;
    }
}
