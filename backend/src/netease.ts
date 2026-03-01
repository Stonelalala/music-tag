import { song_detail, song_url_v1, playlist_detail, lyric } from 'NeteaseCloudMusicApi';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import NodeID3 from 'node-id3';
import crypto from 'crypto';
import type { Database } from 'better-sqlite3';

const OpenCC = require('opencc-js');
const t2s = OpenCC.Converter({ from: 't', to: 'cn' });

export async function parseNeteaseUrl(url: string) {
    let type = '';
    let id = '';

    const songMatch = url.match(/song[\?\&]id=(\d+)/) || url.match(/\/song\/(\d+)/);
    if (songMatch) {
        type = 'song';
        id = songMatch[1];
    }

    const playlistMatch = url.match(/playlist[\?\&]id=(\d+)/) || url.match(/\/playlist\/(\d+)/);
    if (playlistMatch) {
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
        if (res.status === 200 && (res.body as any).songs && Array.isArray((res.body as any).songs)) {
            const song = (res.body as any).songs[0];
            return {
                id: song.id,
                title: t2s(song.name || ''),
                artist: t2s(song.ar ? song.ar.map((a: any) => a.name).join(', ') : ''),
                album: t2s(song.al?.name || ''),
                coverUrl: song.al?.picUrl || null,
            };
        }
    } catch (e: any) {
        console.error('Fetch netease song detail failed:', e);
    }
    return null;
}

export async function fetchNeteasePlaylist(id: number | string) {
    try {
        const res = await playlist_detail({ id: id.toString() });
        if (res.status === 200 && (res.body as any).playlist) {
            const playlist = (res.body as any).playlist;
            return {
                name: playlist.name,
                coverUrl: playlist.coverImgUrl,
                trackIds: playlist.trackIds.map((t: any) => t.id)
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
    try {
        // level: standard, higher, exhigh, lossless, hires
        const params: any = { id: id.toString(), level: level as any };
        if (cookie) params.cookie = cookie;

        const res = await song_url_v1(params);
        if (res.status === 200 && (res.body as any).data && Array.isArray((res.body as any).data)) {
            const data = (res.body as any).data[0];

            // 剔除 30s 试听版本，或者由于防盗链查不到 url 都可以视为被网易封杀！
            if (data.freeTrialInfo || data.freeTimeTrialPrivilege?.resConsumable === false || !data.url) {
                console.warn(`[Netease] 主链接 ID:${id} 被 VIP/防盗链墙阻挡！启用 Meting 音源代理替换...`);
                // 触发狸猫换太子，向前端伪造其可被拉取，并在下发时自动导到代理网关
                return {
                    url: `https://api.injahow.cn/meting/?server=netease&type=url&id=${id}`,
                    size: 0,
                    type: 'mp3',
                    level: 'standard',
                    usedFallback: true
                };
            }

            return {
                url: data.url,
                size: data.size,
                type: data.type || 'mp3',
                level: data.level // 实际上平台给的音质
            };
        }
    } catch (e: any) {
        console.error('Fetch netease song url failed:', e);
    }

    // 如果全挂了，最终强制兜底
    return {
        url: `https://api.injahow.cn/meting/?server=netease&type=url&id=${id}`,
        size: 0,
        type: 'mp3',
        level: 'standard',
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

async function fetchFallbackFromMetingTencent(songName: string, singerName: string): Promise<string | null> {
    try {
        const rawSinger = singerName.split(/[,、&]+/)[0].trim();
        const keyword = encodeURIComponent(`${rawSinger} ${songName}`);
        const res = await axios.get(`https://api.injahow.cn/meting/?server=tencent&type=search&name=${keyword}`, { timeout: 8000 });
        if (Array.isArray(res.data) && res.data.length > 0) {
            const first = res.data[0];
            if (first.url) return first.url; // Meting 接口有些时候直接在 search 返回 url!
            if (first.id) return `https://api.injahow.cn/meting/?server=tencent&type=url&id=${first.id}`;
        }
    } catch (e) {
        console.error('[Tencent Fallback Error]', e);
    }
    return null;
}

async function fetchFallbackFromKugou(songName: string, singerName: string): Promise<string | null> {
    try {
        const rawSinger = singerName.split(/[,、&]+/)[0].trim();
        const keyword = encodeURIComponent(`${rawSinger} ${songName}`);
        const searchUrl = `http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${keyword}&page=1&pagesize=1&showtype=1`;
        const searchRes = await axios.get(searchUrl, { timeout: 8000 });
        const info = searchRes.data?.data?.info;
        if (!info || info.length === 0) return null;

        const hash = info[0].hash;
        if (!hash) return null;

        const playUrl = `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;
        const playRes = await axios.get(playUrl, { timeout: 8000 });
        if (playRes.data && playRes.data.url) {
            return playRes.data.url;
        }
    } catch (e) {
        console.error('[Kugou Fallback Error]', e);
    }
    return null;
}

export async function downloadAndTagNeteaseSong(id: number | string, musicDir: string, db: Database, level: string = 'exhigh', cookie: string = '') {
    try {
        const detail = await fetchNeteaseSongDetail(id);
        if (!detail) throw new Error(`Song detail not found for ID ${id}`);

        let dlInfo = await fetchNeteaseDownloadUrl(id, level, cookie);

        if (!dlInfo || !dlInfo.url) {
            throw new Error(`已将 ${detail.title} 拦截！极度异常状态，Meting 解析代理彻底失效。`);
        }

        // 如果我们请求无损，但平台发回来的并不是无损
        if (!(dlInfo as any).usedFallback && level === 'lossless' && dlInfo.type.toLowerCase() === 'mp3') {
            console.warn(`[Netease] 警告：请求无损，但返回了 mp3 格式 (由于无 Cookie 权限降级)`);
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

        const safeArtist = detail.artist.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Unknown Artist';
        const safeTitle = detail.title.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Unknown Title';
        const ext = dlInfo.type.toLowerCase() === 'flac' ? '.flac' : '.mp3';
        const filename = `${safeArtist} - ${safeTitle}${ext}`;

        const downloadsDir = path.join(musicDir, 'Downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        const filepath = path.join(downloadsDir, filename);

        // 预检查流状态，彻底阻断落地硬盘冲突！
        let finalHitUrl = dlInfo.url;
        let requiresFallback = false;

        console.log(`[Netease] 调用声呐探针嗅探原生/首级代理管线体积...`);
        try {
            const probeRes = await axios.get(dlInfo.url, { responseType: 'stream', timeout: 8000 });
            const pLen = parseInt(probeRes.headers['content-length'] || '0');
            if (pLen > 0 && pLen < 2000000) { // < 2.0MB 确认为阉割神曲 (30s或60s极高音质VIP碎流)
                requiresFallback = true;
            }
            probeRes.data.destroy(); // 掐断管线，不产生实际落盘流量
        } catch (e) {
            // 如果探针失败，我们信任原链接并继续在后端下载，在最终落地时接受防爆门检测
        }

        let isFatalAbsence = false;

        if (requiresFallback) {
            console.warn(`[Netease: Fallback] 被原辖区权限（VIP单曲/残次防盗截断）阻击！停止接收本管线残片！进入高级双保险平替重路由！`);
            let fallbackUrl = await fetchFallbackFromMetingTencent(detail.title, detail.artist);
            if (!fallbackUrl) {
                console.warn(`[Netease: Fallback] 腾讯节点阵亡告破，重试酷狗核心...`);
                fallbackUrl = await fetchFallbackFromKugou(detail.title, detail.artist);
            }
            if (fallbackUrl) {
                console.log(`[Netease: Fallback] ✔️ 截获高保真完全版同宗音轨链接！执行主轴重接...`);
                finalHitUrl = fallbackUrl;
            } else {
                console.warn(`[Netease: Fallback Error] 🚨 全网同名单曲资源荡然无存！本VIP曲库已被彻底封死！已宣判此曲绝迹。`);
                isFatalAbsence = true;
            }
        }

        if (isFatalAbsence) {
            throw new Error(`全网搜捕瘫痪，绝密VIP/防盗源无可平替。为保持曲库纯净，彻底舍弃试听版残片！`);
        }

        // 安全一维写入管线：确保系统仅进行一次单向无阻塞写盘，彻底粉碎 EBUSY 悬锁隐患。
        console.log(`[Netease] 正在向终端磁盘转录音频流本体... -> ${filename}`);
        const audioRes = await axios.get(finalHitUrl, { responseType: 'stream', timeout: 30000 });
        const writer = fs.createWriteStream(filepath);
        audioRes.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // 终极把关检查：不管伪装得多好，在最后落地如果小于 2MB （对于普通完整歌极难）或是残留被查！
        const finalStats = fs.statSync(filepath);
        if (finalStats.size < 2000000) {
            console.warn(`[Netease: Purge] 高度危险：物理落底文件极小 (${finalStats.size} bytes)，强烈怀疑为残次截断试听版！立即施行物理清洗。`);
            fs.unlinkSync(filepath);
            throw new Error(`资源残次/体积奇小（不足2MB）。防毒清理判定已生效，拒绝入库！`);
        } else {
            console.log(`[Netease] 音轨全尺寸落地完成(Bytes: ${finalStats.size})，完美提取！`);
        }

        // Write Tags by Extension
        let scrapeStatus = 1;
        try {
            if (ext === '.mp3') {
                const tags: NodeID3.Tags = { title: detail.title, artist: detail.artist, album: detail.album };
                if (lyricText) tags.unsynchronisedLyrics = { language: 'eng', text: lyricText };
                if (coverBuffer) {
                    tags.image = { mime: coverMime, type: { id: 3, name: 'front cover' }, description: 'Cover', imageBuffer: coverBuffer };
                }
                const success = NodeID3.update(tags, filepath);
                if (!success) console.error(`[Netease] Failed to write ID3 for ${filepath}`);
            } else if (ext === '.flac') {
                const Metaflac = require('metaflac-js');
                const flac = new Metaflac(filepath);

                if (detail.title) { flac.removeTag('TITLE'); flac.setTag(`TITLE=${detail.title}`); }
                if (detail.artist) { flac.removeTag('ARTIST'); flac.setTag(`ARTIST=${detail.artist}`); }
                if (detail.album) { flac.removeTag('ALBUM'); flac.setTag(`ALBUM=${detail.album}`); }
                if (lyricText) { flac.removeTag('LYRICS'); flac.setTag(`LYRICS=${lyricText}`); }
                if (coverBuffer) {
                    try { flac.importPictureFromBuffer(coverBuffer); } catch (e) { }
                }
                flac.save();
            }
            console.log(`[Netease] Successfully encoded metadata to: ${filepath}`);
        } catch (e) {
            console.error(`[Netease] Metadata error for ${filepath}`, e);
            scrapeStatus = 2; // failed but downloaded
        }

        // Insert into Database
        const existing = db.prepare('SELECT id FROM tracks WHERE filepath = ?').get(filepath);
        if (!existing) {
            const trackId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
            db.prepare(`
                 INSERT INTO tracks (id, filepath, filename, extension, title, artist, album, scrape_status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             `).run(trackId, filepath, filename, ext, detail.title, detail.artist, detail.album, scrapeStatus);
            console.log(`[Netease] Database track record integrated for ${trackId}`);
        } else {
            db.prepare('UPDATE tracks SET title=?, artist=?, album=?, scrape_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
                .run(detail.title, detail.artist, detail.album, scrapeStatus, (existing as any).id);
        }

        return { success: true, filepath, detail, ext };

    } catch (e: any) {
        console.error(`Failed to download and tag netease song ${id}:`, e.message);
        throw e;
    }
}
