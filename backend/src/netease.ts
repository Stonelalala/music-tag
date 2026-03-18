import { song_detail, song_url_v1, playlist_detail, lyric, recommend_resource, recommend_songs, personalized } from 'NeteaseCloudMusicApi';
const OpenCC = require('opencc-js');
const converter = OpenCC.Converter({ from: 't', to: 'cn' });
const t2s = (text: string | undefined | null) => text ? converter(text) : '';

const formatNeteaseCookie = (cookie: string) => {
    if (!cookie) return '';
    const cleaned = cookie.trim();

    // Split into segments by semicolon or newline to handle various copy-paste formats
    const segments = cleaned.split(/[\n;]/).map(s => s.trim()).filter(s => s);
    const pairs: string[] = [];
    const seenKeys = new Set<string>();

    segments.forEach(seg => {
        // Try to match Key=Value, Key: Value, or Key Value (common in browser tables)
        const match = seg.match(/^([a-zA-Z0-9_%-]+)[:=\s]+(.+)$/);
        if (match && match[1] && match[2]) {
            const key = match[1].trim().replace(/:$/, '');
            const value = match[2].trim();

            if (!seenKeys.has(key)) {
                pairs.push(`${key}=${value}`);
                seenKeys.add(key);
            }
        }
    });

    if (pairs.length > 0) {
        return pairs.join('; ') + ';';
    }

    // Fallback for single long hex token (just MUSIC_U)
    if (cleaned.length > 64 && !cleaned.includes('=') && !cleaned.includes(' ')) {
        return `MUSIC_U=${cleaned};`;
    }

    // Final ensuring of semicolon
    let final = cleaned;
    if (!final.includes('MUSIC_U=') && !final.includes('=')) {
        final = `MUSIC_U=${final}`;
    }
    if (!final.endsWith(';')) {
        final += ';';
    }
    return final;
};

export async function fetchNeteaseRecommendPlaylists(cookie: string) {
    const formattedCookie = formatNeteaseCookie(cookie);
    let items: any[] = [];
    try {
        // 1. Try Personalized (usually returns ~30 items, works even with guest/partial cookie)
        const resP = await personalized({ cookie: formattedCookie, limit: 30 });
        if (resP.status === 200 && (resP.body as any).result) {
            items = (resP.body as any).result.map((r: any) => ({
                id: r.id,
                name: r.name,
                coverUrl: r.picUrl,
                trackCount: r.trackCount || 0,
                playCount: r.playCount || 0
            }));
        }

        // 2. Try Recommend Resource (official daily recommendation, requires strict music_u login)
        const resR = await recommend_resource({ cookie: formattedCookie });
        if (resR.status === 200 && (resR.body as any).recommend) {
            const dailies = (resR.body as any).recommend.map((r: any) => ({
                id: r.id,
                name: r.name,
                coverUrl: r.picUrl,
                trackCount: r.trackCount || 0,
                playCount: r.playCount || 0
            }));
            // Merge and put daily ones at the front
            dailies.forEach((d: any) => {
                if (!items.find(i => i.id === d.id)) items.unshift(d);
            });
        }
    } catch (e: any) {
        console.error('Fetch netease recommend playlists failed:', e.message);
    }
    return items;
}

export async function fetchNeteaseRecommendSongs(cookie: string) {
    const formattedCookie = formatNeteaseCookie(cookie);
    try {
        const res = await recommend_songs({ cookie: formattedCookie });
        const data = (res.body as any).data;
        if (res.status === 200 && data && data.dailySongs) {
            return data.dailySongs.map((song: any) => ({
                id: song.id,
                title: t2s(song.name || ''),
                artist: t2s(song.ar ? song.ar.map((a: any) => a.name).join(', ') : ''),
                album: t2s(song.al?.name || ''),
                coverUrl: song.al?.picUrl || null,
                duration: song.dt ? song.dt / 1000 : 0,
            }));
        }
    } catch (e: any) {
        console.error('Fetch netease recommend songs failed:', e);
    }
    return [];
}

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as mm from 'music-metadata';
import NodeID3 from 'node-id3';
import crypto from 'crypto';
import type { Database } from 'better-sqlite3';


export async function parseNeteaseUrl(url: string) {
    let type = '';
    let id = '';

    const songMatch = url.match(/song[\?\&]id=(\d+)/) || url.match(/\/song\/(\d+)/);
    if (songMatch && songMatch[1]) {
        type = 'song';
        id = songMatch[1];
    }

    const playlistMatch = url.match(/playlist[\?\&]id=(\d+)/) || url.match(/\/playlist\/(\d+)/);
    if (playlistMatch && playlistMatch[1]) {
        type = 'playlist';
        id = playlistMatch[1];
    }

    if (!type || !id) {
        throw new Error('Invalid Netease URL');
    }

    return { type, id };
}

export async function fetchNeteaseSongDetail(id: number | string) {
    try {
        const res = await song_detail({ ids: id.toString() });
        const songs = (res.body as any).songs;
        if (res.status === 200 && songs && Array.isArray(songs) && songs.length > 0) {
            const song = songs[0];
            return {
                id: song.id,
                title: t2s(song.name || ''),
                artist: t2s(song.ar ? song.ar.map((a: any) => a.name).join(', ') : ''),
                album: t2s(song.al?.name || ''),
                year: song.publishTime ? new Date(song.publishTime).getFullYear().toString() : undefined,
                coverUrl: song.al?.picUrl || null,
                duration: song.dt ? song.dt / 1000 : 0, // Convert ms to s
            };
        }
    } catch (e: any) {
        console.error('Fetch netease song detail failed:', e);
    }
    return null;
}

export async function fetchNeteasePlaylist(id: number | string, cookie: string = '') {
    const formattedCookie = formatNeteaseCookie(cookie);
    try {
        const res = await playlist_detail({ id: id.toString(), cookie: formattedCookie });
        const playlist = (res.body as any).playlist;
        if (res.status === 200 && playlist) {
            return {
                name: playlist.name,
                coverUrl: playlist.coverImgUrl,
                trackIds: playlist.trackIds ? playlist.trackIds.map((t: any) => t.id) : [],
                tracks: playlist.tracks ? playlist.tracks.map((t: any) => ({
                    id: t.id,
                    title: t2s(t.name || ''),
                    artist: t2s(t.ar ? t.ar.map((a: any) => a.name).join(', ') : ''),
                    album: t2s(t.al?.name || ''),
                    coverUrl: t.al?.picUrl || null
                })) : []
            };
        }
    } catch (e: any) {
        console.error('Fetch netease playlist failed:', e);
    }
    return null;
}

/*
 * 跨平台聚合降级劫持 (Fallback Unblocker)
 * 当主要高解析度通道因为 VIP 或无版权墙拦截时，进行音源替换提取
 * 目前实装：网易云遗留的外链直通车获取完整的标准音质代替 30s 残废品。
 * （可以依据相同原理拓展为 Bilibili 或酷狗解析器接入点）
 */
async function fetchFallbackAudioUrl(id: number | string, title: string, artist: string): Promise<{ url: string, type: string, source: string } | null> {
    console.warn(`[Unblocker] 正在启动备用音源劫持替换 -> 代理检索: ${title} - ${artist}`);

    // 终极方案二：利用第三方强解析代理服务器 (Meting API网关)
    // 这个接口自动汇集了破解通道，即使是要求 VIP 和有版权限制的，大几率会下发 320k 真实跳转
    const fallbackUrl = `https://api.injahow.cn/meting/?server=netease&type=url&id=${id}`;

    console.warn(`[Unblocker] ✨ 代理连接注入成功，音源准备接收 (Meting Server Proxying)`);
    return {
        url: fallbackUrl,
        type: 'mp3',
        source: 'Meting Proxy'
    };
}


export async function fetchNeteaseDownloadUrl(id: number | string, level: string = 'exhigh', cookie: string = '') {
    const formattedCookie = formatNeteaseCookie(cookie);
    console.log(`[Netease API] Target ID: ${id}, Cookie present in args: ${!!cookie}, Formatted length: ${formattedCookie.length}`);
    if (formattedCookie) {
        const keysFound = formattedCookie.match(/([a-zA-Z0-9_%-]+)=/g)?.map(k => k.replace('=', '')) || [];
        const fingerprint = formattedCookie.substring(0, 15) + '...';
        console.log(`[Netease API] Cookie Keys: ${keysFound.join(', ')} | Fingerprint: ${fingerprint}`);
    }

    const levels = ['jymaster', 'hires', 'lossless', 'exhigh', 'higher', 'standard'];
    let startIndex = levels.indexOf(level);
    if (startIndex === -1) startIndex = 3; // default exhigh

    // 尝试阶梯式降级请求，直到拿到真实的 URL
    for (let i = startIndex; i < levels.length; i++) {
        const currentLevel = levels[i];
        // Rotate platforms: Some VIP songs require PC, others work on Linux/Android
        const platforms = ['pc', 'android', 'linux'];

        for (const platform of platforms) {
            try {
                const params: any = {
                    id: id.toString(),
                    level: currentLevel as any,
                    os: platform as any,
                    realIP: '116.25.146.177' // China SZ IP to avoid region block
                };
                if (formattedCookie) params.cookie = formattedCookie;

                const res = await song_url_v1(params);
                if (res.status === 200 && (res.body as any).data && Array.isArray((res.body as any).data)) {
                    const data = (res.body as any).data[0];
                    if (!data.url) {
                        console.log(`[Netease API] No URL for ID:${id} [${platform}/${currentLevel}]. Code:${data.code} Fee:${data.fee}`);
                    }

                    if (data.url && !data.freeTrialInfo && data.code !== 404) {
                        console.log(`[Netease API] Success! [${platform}/${currentLevel}] Fee:${data.fee} Code:${data.code}`);
                        return {
                            url: data.url,
                            size: data.size,
                            type: data.type || 'mp3',
                            level: data.level
                        };
                    }
                }
            } catch (ignore) { }
        }
    }

    console.warn(`[Netease API] Song ${id} authorized check failed on all platforms/levels. (Cookie might be invalid or restricted)`);
    // Fallback to basic proxy channel (will return 320k if possible)
    console.warn(`[Netease: Safe-Proxy] Triggering Mirror Node fallback for ID:${id}`);
    return {
        url: `https://api.injahow.cn/meting/?server=netease&type=url&id=${id}&br=320`,
        size: 0,
        type: 'mp3',
        level: 'exhigh',
        usedFallback: true
    };
}

export async function fetchNeteaseLyric(id: number | string) {
    try {
        const res = await lyric({ id: id.toString() });
        if (res.status === 200 && (res.body as any).lrc) {
            return t2s((res.body as any).lrc.lyric || '');
        }
    } catch (e: any) {
        console.error('Fetch netease lyric failed:', e);
    }
    return null;
}

export async function fetchFallbackFromMetingTencent(songName: string, singerName: string, level: string = 'exhigh'): Promise<string | null> {
    try {
        const rawSinger = ((singerName || '').split(/[,、&]+/)[0] || '').trim();
        const keyword = encodeURIComponent(`${rawSinger} ${songName}`);

        // 尝试从 injahow 检索 ID (相比 i-meto 更稳定且支持更多码率劫持)
        const searchUrl = `https://api.injahow.cn/meting/?server=tencent&type=search&id=${keyword}`;
        const res = await axios.get(searchUrl, { timeout: 10000 });

        if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
            const matches = res.data.filter((s: any) =>
                s.author?.includes(rawSinger) || s.title?.includes(songName)
            );
            const target = matches[0] || res.data[0];

            if (target && target.id) {
                // 不要盲目用 target.url (通常是 128k)，尝试在无需鉴权的 injahow 节点上开启码率提级
                const br = (level === 'lossless' || level === 'hires') ? 'flac' : '320';
                console.log(`[Tencent: Quality-Up] ⏫ 尝试在镜像节点请求 ${br} 档位...`);
                return `https://api.injahow.cn/meting/?server=tencent&type=url&id=${target.id}&br=${br}`;
            }
        }
    } catch (e) {
        console.error('[Tencent Fallback Error]', e);
    }
    return null;
}

export async function fetchFallbackFromBilibili(songName: string, singerName: string): Promise<string | null> {
    try {
        const rawSinger = ((singerName || '').split(/[,、&]+/)[0] || '').trim();
        const keyword = encodeURIComponent(`${rawSinger} ${songName}`);

        // Note: Standard Meting usually doesn't support bilibili search via the same endpoint
        // Using netease search as a final fallback for different editions/regions if needed
        // but here we just try to use a more reliable netease fallback if tencent fails
        const searchUrl = `https://api.injahow.cn/meting/?server=netease&type=search&id=${keyword}`;
        const res = await axios.get(searchUrl, { timeout: 10000 });

        if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
            const target = res.data[0];
            if (target && target.id) {
                console.log(`[Fallback: Search-Hit] ✔️ 命中外部节点: ${target.title}`);
                return `https://api.injahow.cn/meting/?server=netease&type=url&id=${target.id}&br=320`;
            }
        }
    } catch (e) {
        console.error('[Bilibili Fallback Error]', e);
    }
    return null;
}

export async function fetchFallbackFromKugou(songName: string, singerName: string): Promise<string | null> {
    try {
        const rawSinger = ((singerName || '').split(/[,、&]+/)[0] || '').trim();
        const keyword = encodeURIComponent(`${rawSinger} ${songName}`);
        const searchUrl = `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${keyword}&page=1&pagesize=1&showtype=1`;
        const searchRes = await axios.get(searchUrl, { timeout: 8000 });
        const info = searchRes.data?.data?.info;
        if (!info || !Array.isArray(info) || info.length === 0) return null;

        const song = info[0];
        if (song) {
            const hash = (song.hash as string);
            if (!hash) return null;

            const playUrl = `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;
            const playRes = await axios.get(playUrl, { timeout: 8000 });
            if (playRes.data && playRes.data.url) {
                return (playRes.data.url as string);
            }
        }
    } catch (e) {
        console.error('[Kugou Fallback Error]', e);
    }
    return null;
}

import { probeAudioQuality } from './utils/probe';
import { taskManager } from './taskManager';

export async function downloadAndTagNeteaseSong(id: number | string, musicDir: string, db: Database, level: string = 'exhigh', cookie: string = '', taskId?: string) {
    const log = (msg: string) => {
        if (taskId) taskManager.addLog(taskId, msg);
        console.log(`[Netease:${id}] ${msg}`);
    };
    const warn = (msg: string) => {
        if (taskId) taskManager.addLog(taskId, `⚠️ ${msg}`);
        console.warn(`[Netease:${id}] ${msg}`);
    };
    const error = (msg: string) => {
        if (taskId) taskManager.addLog(taskId, `❌ ${msg}`);
        console.error(`[Netease:${id}] ${msg}`);
    };

    try {
        const detail = await fetchNeteaseSongDetail(id);
        if (!detail) throw new Error(`Song detail not found for ID ${id}`);

        let dlInfo = await fetchNeteaseDownloadUrl(id, level, cookie);
        let finalHitUrl = '';
        let probeResult: any = { valid: false, mime: 'audio/mpeg', size: 0, bitrate: 0 };
        let requiresFallback = false;

        if (!dlInfo || !dlInfo.url) {
            console.warn(`[Netease: Direct-Fail] 原生和基础代理通道地址获取失败，强制切换至全网平替模式 ID:${id}`);
            requiresFallback = true;
        } else {
            // 原生或基础代理存在，先探测一下
            finalHitUrl = dlInfo.url;
            probeResult = await probeAudioQuality(finalHitUrl, 'netease', (detail as any).duration || 0);

            if (!probeResult.valid) {
                console.warn(`[Netease] 探针检测到原始链接无效 (格式: ${probeResult.mime})，尝试全网搜索补天...`);
                requiresFallback = true;
            }

            // --- 核心升级：如果用户要无损，但目前只给 MP3，尝试全网“提级”寻找！ ---
            if (level === 'lossless' && !probeResult.mime.includes('flac')) {
                console.warn(`[Quality-Up] ⏫ 用户请求无损，但原生通道仅下发了 MP3，正在尝试全网提级至 FLAC...`);
                requiresFallback = true;
            }
        }

        let isFatalAbsence = false;

        if (requiresFallback) {
            warn(`正在执行全网搜索 (腾讯/酷狗/B站/i-meto)...`);
            const netease: any = await import('./netease.js');

            let fallbackUrl = await netease.fetchFallbackFromMetingTencent(detail.title, detail.artist, level);
            if (!fallbackUrl) {
                warn(`腾讯节点未命中，尝试酷狗节点...`);
                fallbackUrl = await netease.fetchFallbackFromKugou(detail.title, detail.artist);
            }
            if (!fallbackUrl) {
                warn(`酷狗节点亦失效，尝试镜像节点搜索...`);
                fallbackUrl = await netease.fetchFallbackFromBilibili(detail.title, detail.artist);
            }

            if (fallbackUrl) {
                log(`✔️ 截获平替源链接！执行校验...`);
                finalHitUrl = fallbackUrl;
                // 对平替源再次进行兜底探测 (必须保证是完整内容)
                const fallbackProbe = await probeAudioQuality(finalHitUrl, 'tencent', (detail as any).duration || 0);
                if (!fallbackProbe.valid) {
                    error(`平替源探针校验失败。`);
                    isFatalAbsence = true;
                } else {
                    probeResult = fallbackProbe;
                    log(`探针复核通过: ${probeResult.mime} - ${probeResult.bitrate}kbps`);
                }
            } else {
                error(`所有平替方案均未检索到有效资源。`);
                isFatalAbsence = true;
            }
        }

        if (isFatalAbsence) {
            throw new Error(`[Netease: Purge] 您请求的歌曲已全网封锁！平替方案已耗尽，为避免下载损坏文件，操作已强行终止。`);
        }

        let lyricText = await fetchNeteaseLyric(id);

        let coverBuffer: Buffer | null = null;
        let coverMime = 'image/jpeg';
        if (detail.coverUrl) {
            try {
                const imgRes = await axios.get(detail.coverUrl, { responseType: 'arraybuffer', timeout: 8000 });
                coverBuffer = Buffer.from(imgRes.data, 'binary');
                coverMime = imgRes.headers['content-type'] || 'image/jpeg';
            } catch (ignore) { }
        }

        const safeArtist = (detail.artist || '').replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Unknown Artist';
        const safeTitle = (detail.title || '').replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Unknown Title';

        // 动态检测后缀
        const ext = (probeResult.mime || '').includes('flac') ? '.flac' : '.mp3';
        const filename = `${safeArtist} - ${safeTitle}${ext}`;

        const downloadsDir = path.join(musicDir, 'Downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        const filepath = path.join(downloadsDir, filename);

        // 安全写入管线
        log(`正在向磁盘写入音频流: ${filename}`);
        const audioRes = await axios.get(finalHitUrl, { responseType: 'stream', timeout: 30000 });
        const writer = fs.createWriteStream(filepath);
        audioRes.data.pipe(writer);

        await new Promise((resolve, reject) => {
            const ck = setInterval(() => {
                if (taskId && taskManager.isCancelled(taskId)) {
                    audioRes.data.destroy();
                    writer.destroy();
                    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
                    clearInterval(ck);
                    reject(new Error('CANCELLED'));
                }
            }, 1000);
            writer.on('finish', () => { clearInterval(ck); resolve(true); });
            writer.on('error', (err) => { clearInterval(ck); reject(err); });
        });

        // 终极检测修复：确保落地文件体积不是试听碎流
        const finalStats = fs.statSync(filepath);
        if (finalStats.size < 1000000) { // 对于平替源，阈值可以稍微低一点点，但 1MB 是底线
            console.warn(`[Netease: Purge] 高度危险：物理落底文件 (${finalStats.size} bytes) 疑似仍为残片！执行物理清洗。`);
            fs.unlinkSync(filepath);
            throw new Error(`资源残次（不足1MB）。防毒清理判定已生效，拒绝入库！`);
        }

        // Write Tags by Extension
        let scrapeStatus = 1;
        let detectedYear: string | null = detail.year ?? null;
        try {
            if (ext === '.mp3') {
                const tags: NodeID3.Tags = {
                    title: detail.title,
                    artist: detail.artist,
                    album: detail.album,
                };
                if (detail.year) {
                    tags.year = detail.year;
                }
                if (lyricText) tags.unsynchronisedLyrics = { language: 'eng', text: lyricText };
                if (coverBuffer) {
                    tags.image = { mime: coverMime, type: { id: 3, name: 'front cover' }, description: 'Cover', imageBuffer: coverBuffer };
                }
                NodeID3.update(tags, filepath);
            } else if (ext === '.flac') {
                const Metaflac = require('metaflac-js');
                const flac = new Metaflac(filepath);
                if (detail.title) { flac.removeTag('TITLE'); flac.setTag(`TITLE=${detail.title}`); }
                if (detail.artist) { flac.removeTag('ARTIST'); flac.setTag(`ARTIST=${detail.artist}`); }
                if (detail.album) { flac.removeTag('ALBUM'); flac.setTag(`ALBUM=${detail.album}`); }
                if (detail.year) { flac.removeTag('DATE'); flac.setTag(`DATE=${detail.year}`); }
                if (lyricText) { flac.removeTag('LYRICS'); flac.setTag(`LYRICS=${lyricText}`); }
                if (coverBuffer) { try { flac.importPictureFromBuffer(coverBuffer); } catch (e) { } }
                flac.save();
            }
        } catch (e) {
            console.error(`[Netease] Metadata error for ${filepath}`, e);
            scrapeStatus = 2;
        }

        try {
            const metadata = await mm.parseFile(filepath);
            detectedYear = metadata.common.year?.toString() ?? detectedYear;
        } catch (e) {
            console.error(`[Netease] Failed to parse year for ${filepath}`, e);
        }

        // Insert into Database
        const existing = db.prepare('SELECT id FROM tracks WHERE filepath = ?').get(filepath);
        if (!existing) {
            const crypto = require('crypto');
            const trackId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
            db.prepare(`
                 INSERT INTO tracks (id, filepath, filename, extension, title, artist, album, year, bitrate, duration, size, scrape_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             `).run(
                trackId,
                filepath,
                filename,
                ext,
                detail.title,
                detail.artist,
                detail.album,
                detectedYear,
                probeResult.bitrate || 0,
                detail.duration || 0,
                finalStats.size,
                scrapeStatus
            );
        } else {
            db.prepare('UPDATE tracks SET title=?, artist=?, album=?, year=?, bitrate=?, duration=?, size=?, scrape_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
                .run(
                    detail.title,
                    detail.artist,
                    detail.album,
                    detectedYear,
                    probeResult.bitrate || 0,
                    detail.duration || 0,
                    finalStats.size,
                    scrapeStatus,
                    (existing as any).id
                );
        }

        return { success: true, filepath, detail, ext };

    } catch (e: any) {
        console.error(`Failed to download and tag netease song ${id}:`, e.message);
        throw e;
    }
}
