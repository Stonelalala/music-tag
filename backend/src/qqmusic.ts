import axios from 'axios';
import path from 'path';
import fs from 'fs';
import NodeID3 from 'node-id3';
const Metaflac = require('metaflac-js');
import crypto from 'crypto';
import { db } from './db';

// Extract Tencent ID from link
export async function parseQQMusicUrl(url: string, level: string = 'exhigh', cookie?: string) {
    let id = '';
    let type = 'song';

    try {
        if (url.includes('song/') || url.includes('songDetail/')) {
            const match = url.match(/(?:song|songDetail)\/([a-zA-Z0-9]+)/);
            if (match) id = match[1] || '';
        } else if (url.includes('playlist/')) {
            const match = url.match(/playlist\/([0-9]+)/);
            if (match) {
                id = match[1] || '';
                type = 'playlist';
            }
        } else if (url.includes('songmid=')) {
            const match = url.match(/songmid=([a-zA-Z0-9]+)/);
            if (match) id = match[1] || '';
        } else if (url.includes('id=')) {
            const match = url.match(/[?&]id=([a-zA-Z0-9]+)/);
            if (match) {
                id = match[1] || '';
                if (url.includes('playlist')) type = 'playlist';
            }
        }

        if (!id) {
            throw new Error('未能在分享链接中提取有效的 QQ音乐 ID 或 MID');
        }

        console.log(`[QQMusic] Extracted ID: ${id}, Type: ${type}`);

        if (type === 'playlist') {
            const plRes = await axios.get(`https://api.injahow.cn/meting/?server=tencent&type=playlist&id=${id}`);
            if (!Array.isArray(plRes.data)) throw new Error('QQ音乐歌单代理接口解析崩溃');
            const trackIds = plRes.data.map((track: any) => {
                if (track.url) {
                    const match = track.url.match(/id=([^&]+)/);
                    if (match) return match[1];
                }
                return track.id || track.mid || null;
            }).filter((id: any) => id); // 去除无法提炼的非法条目
            return {
                type: 'playlist',
                playlistId: id,
                trackIds
            };
        } else {
            // Song
            const detailRes = await axios.get(`https://api.injahow.cn/meting/?server=tencent&type=song&id=${id}`);
            if (!Array.isArray(detailRes.data) || detailRes.data.length === 0) throw new Error('查无此曲');
            const song = detailRes.data[0];

            // QQ 直接用 Meting url 作为兜底预查
            return {
                type: 'song',
                data: [{
                    qqId: id, // unified id
                    title: song.name,
                    artist: (Array.isArray(song.artist) ? song.artist.join(', ') : song.artist) || 'Unknown',
                    duration: song.time || 0, // Meting often uses 'time' for duration
                    downloadable: !!song.url
                }]
            };
        }

    } catch (e: any) {
        console.error('[QQMusic Parse Error]:', e.message);
        throw e;
    }
}

export async function fetchQQMusicDownloadUrl(id: string | number, level: string = 'exhigh', cookie?: string) {
    // QQ 音乐尝试中继代理，部分节点支持通过 br 参数调节
    let br = '320';
    if (level === 'lossless' || level === 'hires') br = 'flac';
    if (level === 'standard') br = '128';

    const proxyUrl = `https://api.injahow.cn/meting/?server=tencent&type=url&id=${id}${br !== '320' ? '&br=' + br : ''}`;

    return {
        url: proxyUrl,
        type: br === 'flac' ? 'flac' : 'mp3',
        usedFallback: false
    };
}

export async function fetchQQMusicDetail(id: string | number) {
    const detailRes = await axios.get(`https://api.injahow.cn/meting/?server=tencent&type=song&id=${id}`);
    if (Array.isArray(detailRes.data) && detailRes.data.length > 0) {
        return detailRes.data[0];
    }
    return null;
}

export async function fetchQQMusicLyric(id: string | number) {
    try {
        const lrcRes = await axios.get(`https://api.injahow.cn/meting/?server=tencent&type=lrc&id=${id}`);
        return lrcRes.data;
    } catch (e) {
        return null;
    }
}

import { probeAudioQuality } from './utils/probe';

export async function downloadAndTagQQMusicSong(musicDir: string, id: string | number, level: string = 'exhigh', cookie?: string): Promise<string> {
    try {
        const detail = await fetchQQMusicDetail(id);
        if (!detail) throw new Error(`Song detail not found for ID ${id}`);

        let dlInfo = await fetchQQMusicDownloadUrl(id, level, cookie);

        if (!dlInfo || !dlInfo.url) {
            throw new Error(`已将 ${detail.name} 拦截！QQ代理节点无权抽取该源。`);
        }

        // --- 集成质量探测 (Sonar Probing) ---
        const probeResult = await probeAudioQuality(dlInfo.url, 'qq', 0);

        if (!probeResult.valid) {
            console.warn(`[QQMusic] 探针检测到体积异常 (${probeResult.size} bytes)，QQ 代理节点下发了残次源。`);
            throw new Error('截获体积过小的腾讯侧残次防盗源，拒绝入库。');
        }

        let lyricText = await fetchQQMusicLyric(id);

        let coverBuffer: Buffer | null = null;
        let coverMime = 'image/jpeg';
        if (detail.pic) {
            try {
                const imgRes = await axios.get(detail.pic, { responseType: 'arraybuffer', timeout: 8000 });
                coverBuffer = Buffer.from(imgRes.data, 'binary');
                coverMime = imgRes.headers['content-type'] || 'image/jpeg';
            } catch (ignore) { }
        }

        const safeArtist = (Array.isArray(detail.artist) ? detail.artist.join(',') : detail.artist).replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Unknown Artist';
        const safeTitle = detail.name.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Unknown Title';

        // 解析真实扩展名
        let ext = '.mp3';
        if (probeResult.mime.includes('flac') || dlInfo.type?.toLowerCase() === 'flac') {
            ext = '.flac';
        }

        const filename = `${safeArtist} - ${safeTitle}${ext}`;

        const downloadsDir = path.join(musicDir, 'Downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        const filepath = path.join(downloadsDir, filename);

        console.log(`[QQMusic] 开始向磁盘转录音频流本体... -> ${filename} (Size: ${probeResult.size})`);
        const audioRes = await axios.get(dlInfo.url, { responseType: 'stream', timeout: 30000 });
        const writer = fs.createWriteStream(filepath);
        audioRes.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Write Tags by Extension
        const titleStr = detail.name;
        const artistStr = Array.isArray(detail.artist) ? detail.artist.join(', ') : detail.artist;
        const albumStr = ''; // meting doesn't always provide album simply for qq

        try {
            if (ext === '.flac') {
                const mf = new Metaflac(filepath);
                mf.setTag('TITLE=' + titleStr);
                mf.setTag('ARTIST=' + artistStr);
                mf.setTag('ALBUM=' + albumStr);

                if (coverBuffer) {
                    // mf.importPicture(coverBuffer);
                }
                mf.save();
            } else {
                const tags: any = {
                    title: titleStr,
                    artist: artistStr,
                    album: albumStr
                };
                if (lyricText) tags.unsynchronisedLyrics = { language: 'chi', text: lyricText };
                if (coverBuffer) {
                    tags.image = {
                        mime: coverMime,
                        type: { id: 3, name: 'front cover' },
                        description: 'Cover',
                        imageBuffer: coverBuffer
                    };
                }
                NodeID3.write(tags, filepath);
            }
            console.log(`[QQMusic] Successfully encoded metadata to: ${filepath}`);
        } catch (tagErr) {
            console.error(`[QQMusic] Tagging error for ${filepath}:`, tagErr);
        }

        // Add to database
        try {
            const stmt = db.prepare(`
                INSERT INTO tracks (id, filepath, filename, extension, title, artist, album, scrape_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                ON CONFLICT(filepath) DO UPDATE SET
                    title = excluded.title,
                    artist = excluded.artist,
                    album = excluded.album,
                    scrape_status = 1
            `);
            // QQ ID usually string, so we need random ID or the QQ ID
            const dbId = 'qq_' + id;
            stmt.run(dbId, filepath, filename, ext, titleStr, artistStr, albumStr);
        } catch (dbErr) {
            console.error('[QQMusic] DB Insertion Error:', dbErr);
        }

        return filepath;
    } catch (e: any) {
        console.error(`Failed to download and tag QQMusic song ${id}: `, e.message);
        throw e;
    }
}
