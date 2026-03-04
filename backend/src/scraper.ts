import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import NodeID3 from 'node-id3';
import { db } from './db';

const OpenCC = require('opencc-js');
const t2s = OpenCC.Converter({ from: 't', to: 'cn' });

// LRCLIB for lyrics
export async function fetchLyrics(title: string, artist: string) {
    try {
        const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
        const res = await axios.get(url, { timeout: 10000 });
        if (res.data && res.data.length > 0) {
            // Find best match (prefer synced lyrics)
            const best = res.data.find((t: any) => t.syncedLyrics) || res.data[0];
            const lyrics = best.syncedLyrics || best.plainLyrics || null;
            return lyrics ? t2s(lyrics) : null;
        }
    } catch (e: any) {
        console.error(`[Scraper] Failed to fetch lyrics for ${title} - ${artist}: ${e.message}`);
    }
    return null;
}

// iTunes Search generic
export async function searchITunes(query: string) {
    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`;
        const res = await axios.get(url, { timeout: 10000 });
        if (res.data && res.data.results) {
            return res.data.results.map((track: any) => ({
                id: track.trackId,
                title: t2s(track.trackName || ''),
                artist: t2s(track.artistName || ''),
                album: t2s(track.collectionName || ''),
                year: track.releaseDate ? track.releaseDate.substring(0, 4) : undefined,
                coverUrl: track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : null
            }));
        }
    } catch (e: any) { return []; }
    return [];
}

// iTunes Search API for comprehensive metadata & high-res covers
export async function fetchMetadata(title: string, artist: string) {
    try {
        const term = encodeURIComponent(`${title} ${artist}`);
        const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=1`;
        const res = await axios.get(url, { timeout: 10000 });
        if (res.data && res.data.results && res.data.results.length > 0) {
            const track = res.data.results[0];
            return {
                title: t2s(track.trackName || ''),
                artist: t2s(track.artistName || ''),
                album: t2s(track.collectionName || ''),
                year: track.releaseDate ? track.releaseDate.substring(0, 4) : undefined,
                genre: t2s(track.primaryGenreName || ''),
                // Replace 100x100 with higher resolution 600x600
                coverUrl: track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '600x600bb') : null
            };
        }
    } catch (e: any) {
        console.error(`[Scraper] Failed to fetch metadata for ${title} - ${artist}: ${e.message}`);
    }
    return null;
}

// NetEase Cloud Music Search generic
export async function searchNetease(query: string) {
    try {
        const searchUrl = `https://music.163.com/api/cloudsearch/pc?type=1&limit=15&s=${encodeURIComponent(query)}`;
        const searchRes = await axios.get(searchUrl, { timeout: 10000 });
        const songs = searchRes.data?.result?.songs || [];

        return songs.map((song: any) => ({
            id: song.id,
            title: t2s(song.name || ''),
            artist: t2s(song.ar ? song.ar.map((a: any) => a.name).join(', ') : (song.artists ? song.artists.map((a: any) => a.name).join(', ') : '')),
            album: t2s(song.al?.name || song.album?.name || ''),
            year: song.publishTime ? new Date(song.publishTime).getFullYear().toString() : undefined,
            coverUrl: song.al?.picUrl || null
        }));
    } catch (e: any) { return []; }
}

// NetEase Cloud Music Fallback
export async function fetchNeteaseMetadata(title: string, artist: string) {
    try {
        const term = encodeURIComponent(`${title} ${artist}`);
        const searchUrl = `https://music.163.com/api/search/get/?type=1&limit=1&s=${term}`;
        const searchRes = await axios.get(searchUrl, { timeout: 10000 });
        const songs = searchRes.data?.result?.songs;

        if (songs && songs.length > 0) {
            const song = songs[0];
            const songId = song.id;

            // Fetch high-res cover
            let coverUrl = null;
            try {
                const detailUrl = `https://music.163.com/api/song/detail/?id=${songId}&ids=[${songId}]`;
                const detailRes = await axios.get(detailUrl, { timeout: 5000 });
                if (detailRes.data?.songs?.[0]?.album?.picUrl) {
                    coverUrl = detailRes.data.songs[0].album.picUrl;
                }
            } catch (e) { }

            return {
                title: t2s(song.name || ''),
                artist: t2s(song.artists ? song.artists.map((a: any) => a.name).join(', ') : artist),
                album: t2s(song.album?.name || ''),
                year: song.album?.publishTime ? new Date(song.album.publishTime).getFullYear().toString() : undefined,
                genre: 'Pop', // Netease API doesn't return genre directly here
                coverUrl: coverUrl,
                neteaseId: songId
            };
        }
    } catch (e: any) {
        console.error(`[Scraper] Netease fallback failed for ${title} - ${artist}: ${e.message}`);
    }
    return null;
}

export async function fetchNeteaseLyrics(songId: number) {
    try {
        const url = `https://music.163.com/api/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`;
        const res = await axios.get(url, { timeout: 5000 });
        if (res.data?.lrc?.lyric) {
            return t2s(res.data.lrc.lyric);
        }
    } catch (e) { }
    return null;
}

// QQ Music Fallback
export async function fetchQQMusicMetadata(title: string, artist: string) {
    try {
        const term = encodeURIComponent(`${title} ${artist}`);
        const searchUrl = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=1&n=1&w=${term}&format=json`;
        const searchRes = await axios.get(searchUrl, { timeout: 7000 });
        const song = searchRes.data?.data?.song?.list?.[0];

        if (song) {
            const coverUrl = song.albummid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${song.albummid}.jpg` : null;
            return {
                title: t2s(song.songname || ''),
                artist: t2s(song.singer ? song.singer.map((s: any) => s.name).join(', ') : artist),
                album: t2s(song.albumname || ''),
                year: undefined,
                genre: 'Pop',
                coverUrl: coverUrl,
                qqSongMid: song.songmid
            };
        }
    } catch (e: any) {
        console.error(`[Scraper] QQ Music fallback failed for ${title} - ${artist}: ${e.message}`);
    }
    return null;
}

export async function fetchQQMusicLyrics(songMid: string) {
    try {
        const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songMid}&format=json`;
        const res = await axios.get(url, {
            timeout: 5000,
            headers: { 'Referer': 'https://y.qq.com/' }
        });
        if (res.data?.lyric) {
            const decoded = Buffer.from(res.data.lyric, 'base64').toString('utf8');
            // QQ Music lyrics may include some weird html encodings like &#58; 
            const cleanLyric = decoded.replace(/&#(\d+);/g, (match: string, dec: string) => String.fromCharCode(Number(dec)));
            return t2s(cleanLyric);
        }
    } catch (e) { }
    return null;
}

export async function searchQQMusic(query: string) {
    try {
        const term = encodeURIComponent(query);
        const searchUrl = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=1&n=15&w=${term}&format=json`;
        const searchRes = await axios.get(searchUrl, { timeout: 7000 });
        const songs = searchRes.data?.data?.song?.list || [];

        return songs.map((song: any) => ({
            id: song.songmid,
            title: t2s(song.songname || ''),
            artist: t2s(song.singer ? song.singer.map((s: any) => s.name).join(', ') : ''),
            album: t2s(song.albumname || ''),
            year: undefined,
            coverUrl: song.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.albummid}.jpg` : null
        }));
    } catch (e: any) { return []; }
}

let isScraping = false;
export async function processPendingTracks() {
    if (isScraping) {
        console.log(`⚠️ [Scraper] Scraping job is already running. Skipping.`);
        return;
    }
    isScraping = true;

    try {
        console.log(`🚀 [Scraper] Starting to process pending tracks...`);

        const updateStatus = db.prepare('UPDATE tracks SET scrape_status = ?, last_scraped_at = CURRENT_TIMESTAMP WHERE id = ?');
        const updateMetadata = db.prepare(`
            UPDATE tracks 
            SET title = ?, artist = ?, album = ? 
            WHERE id = ?
        `);

        while (true) {
            // Fetch up to 50 pending tracks per batch
            const pendingTracks = db.prepare('SELECT * FROM tracks WHERE scrape_status = 0 LIMIT 50').all() as any[];

            if (pendingTracks.length === 0) {
                console.log(`✅ [Scraper] No pending tracks left to scrape.`);
                break;
            }

            console.log(`⏳ [Scraper] Processing batch of ${pendingTracks.length} tracks...`);

            for (const track of pendingTracks) {
                // Declare coverBuffer at loop scope so we can explicitly release it at the end
                let coverBuffer: Buffer | undefined;
                let coverMime: string | undefined;

                try {
                    // We need some initial query terms. If title is missing, fallback to filename.
                    const queryTitle = track.title || path.parse(track.filename).name;
                    // Sometimes the filename is "Artist - Title", let's try a very basic heuristic if artist is missing
                    let qTitle = queryTitle;
                    let qArtist = track.artist !== 'Unknown Artist' ? track.artist : '';

                    if (!qArtist && qTitle.includes('-')) {
                        const parts = qTitle.split('-');
                        qArtist = parts[0].trim();
                        qTitle = parts[1].trim();
                    }

                    console.log(`🔍 [Scraper] Scraping: ${qTitle} by ${qArtist}`);

                    let metadata: any = await fetchMetadata(qTitle, qArtist);

                    if (metadata) {
                        console.log(`   --> Found match on iTunes: ${metadata.title} - ${metadata.album}`);
                    } else {
                        console.log(`   --> iTunes failed, trying NetEase Cloud Music (网易云音乐)...`);
                        metadata = await fetchNeteaseMetadata(qTitle, qArtist);
                        if (metadata) {
                            console.log(`   --> Found match on NetEase: ${metadata.title} - ${metadata.album}`);
                        } else {
                            console.log(`   --> NetEase failed, trying QQ Music (QQ音乐)...`);
                            metadata = await fetchQQMusicMetadata(qTitle, qArtist);
                            if (metadata) {
                                console.log(`   --> Found match on QQ Music: ${metadata.title} - ${metadata.album}`);
                            }
                        }
                    }

                    if (metadata) {
                        let lyrics = await fetchLyrics(metadata.title, metadata.artist);

                        // Fallback lyrics retrieval chain
                        if (!lyrics && metadata.neteaseId) {
                            console.log(`   --> LRCLIB lyrics failed, trying NetEase lyrics...`);
                            lyrics = await fetchNeteaseLyrics(metadata.neteaseId);
                        }
                        if (!lyrics && metadata.qqSongMid) {
                            console.log(`   --> NetEase/LRCLIB lyrics failed or skipping, trying QQ Music lyrics...`);
                            lyrics = await fetchQQMusicLyrics(metadata.qqSongMid);
                        }

                        coverBuffer = undefined;
                        coverMime = undefined;

                        if (metadata.coverUrl) {
                            try {
                                const imgRes = await axios.get(metadata.coverUrl, { responseType: 'arraybuffer' });
                                coverBuffer = Buffer.from(imgRes.data, 'binary');
                                coverMime = imgRes.headers['content-type'];

                                // Save physical cover to disk with the same filename as the track
                                const coverPath = path.join(path.dirname(track.filepath), `${path.parse(track.filepath).name}.jpg`);
                                if (!fs.existsSync(coverPath)) {
                                    fs.writeFileSync(coverPath, coverBuffer);
                                    console.log(`   ✅ Saved physical cover to ${coverPath}`);
                                }
                            } catch (imgErr) {
                                console.error(`   --> Failed to download or save cover art.`);
                            }
                        }

                        try {
                            if (track.extension === '.mp3') {
                                const id3Tags: NodeID3.Tags = {
                                    title: metadata.title,
                                    artist: metadata.artist,
                                    album: metadata.album,
                                    year: metadata.year,
                                    genre: metadata.genre
                                };

                                if (lyrics) {
                                    id3Tags.unsynchronisedLyrics = {
                                        language: 'eng',
                                        text: lyrics
                                    };
                                }

                                if (coverBuffer) {
                                    id3Tags.image = {
                                        mime: coverMime || 'image/jpeg',
                                        type: { id: 3, name: 'front cover' },
                                        description: 'Cover',
                                        imageBuffer: coverBuffer
                                    };
                                }

                                const success = NodeID3.update(id3Tags, track.filepath);
                                if (success) {
                                    console.log(`   ✅ Successfully wrote ID3 tags to ${track.filepath}`);
                                    updateMetadata.run(metadata.title, metadata.artist, metadata.album, track.id);
                                    updateStatus.run(1, track.id); // 1 = Success
                                } else {
                                    console.log(`   ❌ Failed to write ID3 tags to ${track.filepath}`);
                                    updateStatus.run(2, track.id); // 2 = Failed
                                }
                            } else if (track.extension === '.flac') {
                                const Metaflac = require('metaflac-js');
                                const flac = new Metaflac(track.filepath);

                                if (metadata.title) { flac.removeTag('TITLE'); flac.setTag(`TITLE=${metadata.title}`); }
                                if (metadata.artist) { flac.removeTag('ARTIST'); flac.setTag(`ARTIST=${metadata.artist}`); }
                                if (metadata.album) { flac.removeTag('ALBUM'); flac.setTag(`ALBUM=${metadata.album}`); }
                                if (metadata.year) { flac.removeTag('DATE'); flac.setTag(`DATE=${metadata.year}`); }
                                if (metadata.genre) { flac.removeTag('GENRE'); flac.setTag(`GENRE=${metadata.genre}`); }
                                if (lyrics) { flac.removeTag('LYRICS'); flac.setTag(`LYRICS=${lyrics}`); }

                                if (coverBuffer) {
                                    try {
                                        flac.importPictureFromBuffer(coverBuffer);
                                    } catch (e) {
                                        console.error(`   ⚠️ Failed to set FLAC cover:`, e);
                                    }
                                }

                                flac.save();
                                console.log(`   ✅ Successfully wrote FLAC tags to ${track.filepath}`);
                                updateMetadata.run(metadata.title, metadata.artist, metadata.album, track.id);
                                updateStatus.run(1, track.id); // 1 = Success
                            } else {
                                console.log(`   ⚠️ Skipping write, extension ${track.extension} is not supported. Marked as ignored.`);
                                updateStatus.run(3, track.id); // 3 = Ignored
                            }
                        } catch (err: any) {
                            console.error(`   ❌ Critical error writing tags: ${err.message}`);
                            updateStatus.run(2, track.id); // Failed
                        }

                    } else {
                        console.log(`   ❌ No metadata found for ${qTitle}`);
                        updateStatus.run(2, track.id); // Failed
                    }
                } catch (trackErr: any) {
                    console.error(`   ❌ Unhandled error processing track ${track.filename}: ${trackErr.message}`);
                    updateStatus.run(2, track.id); // Failed
                }

                // Explicitly release cover buffer to help GC reclaim memory between tracks
                // (each cover image is ~200-600 KB; 50 concurrent tracks = up to 30 MB trapped)
                coverBuffer = undefined;

                // Wait 1 second between requests to avoid getting IP banned by LRCLIB or Apple
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        console.log(`🎉 [Scraper] All batch processing complete.`);
    } finally {
        isScraping = false;
    }
}
