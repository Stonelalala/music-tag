import path from 'path';
import { top_playlist_highquality, top_song } from 'NeteaseCloudMusicApi';

import { db } from './db';
import { downloadAndTagNeteaseSong, fetchNeteasePlaylist, fetchNeteaseRecommendSongs } from './netease';
import { processPendingTracks } from './scraper';
import { scanLibrary } from './scanner';
import { taskManager } from './taskManager';
import { buildTrackSignature } from './utils/track_signature';

export const NETEASE_DAILY_SYNC_TASK_TYPE = 'netease_daily_sync' as const;
const DAILY_SYNC_LIMIT = 20;
const DAILY_PLAYLIST_LIMIT = 5;
const DAILY_PLAYLIST_TRACK_LIMIT = 20;
const DAILY_TOP_SONG_LIMIT = 30;
const TOP_SONG_AREA_ZH = 7;
const TOP_SONG_AREA_ALL = 0;

const inFlightGuard = { active: false };

export interface NeteaseDailyCandidate {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    coverUrl: string | null;
    source: string;
    sourceLabel: string;
}

export interface NeteaseDailySelection {
    selected: NeteaseDailyCandidate[];
    skippedExisting: number;
    skippedDuplicate: number;
}

interface NeteaseDailyRunResult extends NeteaseDailySelection {
    candidateCount: number;
    downloadedCount: number;
    failedCount: number;
}

const logWithTask = (taskId: string | undefined, message: string) => {
    if (taskId) {
        taskManager.addLog(taskId, message);
    } else {
        console.log(message);
    }
};

const toDurationSeconds = (value: unknown) => {
    const numeric = typeof value === 'string' ? Number(value) : Number(value ?? 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return 0;
    }
    return numeric > 1000 ? Math.round(numeric / 1000) : Math.round(numeric);
};

const extractArray = (body: any, keys: string[]) => {
    const candidates = [
        body,
        body?.data,
        body?.result,
        body?.songs,
        body?.list,
        body?.data?.songs,
        body?.data?.list,
        body?.playlist?.tracks,
        body?.playlists,
        body?.data?.playlists,
        body?.result?.playlists,
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    for (const key of keys) {
        const candidate = body?.[key];
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
};

const extractArtists = (song: any) => {
    if (Array.isArray(song?.ar)) {
        return song.ar.map((artist: any) => artist?.name).filter(Boolean).join(', ');
    }
    if (Array.isArray(song?.artists)) {
        return song.artists.map((artist: any) => artist?.name).filter(Boolean).join(', ');
    }
    return String(song?.artist ?? song?.artists ?? '').trim();
};

const mapCandidate = (song: any, source: string, sourceLabel: string): NeteaseDailyCandidate | null => {
    const id = song?.id;
    const title = String(song?.name ?? song?.title ?? '').trim();

    if (id === undefined || id === null || !title) {
        return null;
    }

    return {
        id: String(id),
        title,
        artist: extractArtists(song),
        album: String(song?.al?.name ?? song?.album?.name ?? song?.album ?? '').trim(),
        duration: toDurationSeconds(song?.dt ?? song?.duration),
        coverUrl: song?.al?.picUrl ?? song?.album?.picUrl ?? song?.coverUrl ?? null,
        source,
        sourceLabel,
    };
};

const loadLocalTrackSignatures = () => {
    const rows = db.prepare(`
        SELECT title, artist, duration, filename
        FROM tracks
    `).all() as Array<{
        title: string | null;
        artist: string | null;
        duration: number | null;
        filename: string;
    }>;

    const signatures = new Set<string>();

    for (const row of rows) {
        const title = row.title?.trim() || path.parse(row.filename).name;
        const signature = buildTrackSignature(title, row.artist, row.duration ?? 0);
        if (signature) {
            signatures.add(signature);
        }
    }

    return signatures;
};

const fetchTopSongs = async (areaType: number, sourceLabel: string) => {
    const response = await top_song({ type: areaType } as any);
    const songs = extractArray((response as any).body, ['songs', 'list']);
    return songs.slice(0, DAILY_TOP_SONG_LIMIT).map((song: any) => mapCandidate(song, `top_song:${sourceLabel}`, sourceLabel)).filter(Boolean) as NeteaseDailyCandidate[];
};

const fetchTopPlaylists = async (cat: string, cookie: string, sourceLabel: string) => {
    const response = await top_playlist_highquality({ cat, limit: DAILY_PLAYLIST_LIMIT } as any);
    const playlists = extractArray((response as any).body, ['playlists']).slice(0, DAILY_PLAYLIST_LIMIT);
    const candidates: NeteaseDailyCandidate[] = [];

    for (const playlist of playlists) {
        const playlistId = playlist?.id;
        if (playlistId === undefined || playlistId === null) {
            continue;
        }

        try {
            const detail = await fetchNeteasePlaylist(playlistId, cookie);
            if (!detail) {
                continue;
            }

            const tracks = (detail.tracks ?? []).slice(0, DAILY_PLAYLIST_TRACK_LIMIT);
            for (const track of tracks) {
                const candidate = mapCandidate(track, `playlist:${sourceLabel}:${playlistId}`, `${sourceLabel}歌单`);
                if (candidate) {
                    candidates.push(candidate);
                }
            }
        } catch (error: any) {
            console.warn(`[Netease Daily Sync] Failed to expand playlist ${playlistId}:`, error?.message || error);
        }
    }

    return candidates;
};

const collectCandidates = async (cookie: string, taskId: string) => {
    const candidates: NeteaseDailyCandidate[] = [];
    const seenIds = new Set<string>();
    const seenSignatures = new Set<string>();

    const addCandidate = (candidate: NeteaseDailyCandidate) => {
        const signature = buildTrackSignature(candidate.title, candidate.artist, candidate.duration);
        if (!signature || seenIds.has(candidate.id) || seenSignatures.has(signature)) {
            return false;
        }

        seenIds.add(candidate.id);
        seenSignatures.add(signature);
        candidates.push(candidate);
        return true;
    };

    const logSource = async (label: string, runner: () => Promise<NeteaseDailyCandidate[]>) => {
        try {
            const items = await runner();
            let added = 0;
            for (const item of items) {
                if (addCandidate(item)) {
                    added++;
                }
            }
            logWithTask(taskId, `[NetEase Daily] ${label}: ${items.length} candidates, ${added} unique`);
        } catch (error: any) {
            logWithTask(taskId, `[NetEase Daily] ${label} failed: ${error?.message || error}`);
        }
    };

    if (cookie.trim()) {
        await logSource('recommend_songs', async () => {
            const songs = await fetchNeteaseRecommendSongs(cookie);
            return songs.map((song: any) => mapCandidate({
                id: song.id,
                name: song.title,
                ar: song.artist ? song.artist.split(',').map((name: string) => ({ name: name.trim() })) : [],
                al: { name: song.album, picUrl: song.coverUrl },
                dt: song.duration ? song.duration * 1000 : 0,
            }, 'recommend_songs', '每日推荐')!).filter(Boolean) as NeteaseDailyCandidate[];
        });
    } else {
        logWithTask(taskId, '[NetEase Daily] recommend_songs skipped: no NetEase cookie configured');
    }

    await logSource('top_song:zh', async () => fetchTopSongs(TOP_SONG_AREA_ZH, '华语'));
    await logSource('top_song:all', async () => fetchTopSongs(TOP_SONG_AREA_ALL, '全部'));
    await logSource('top_playlist_highquality:华语', async () => fetchTopPlaylists('华语', cookie, '华语'));
    await logSource('top_playlist_highquality:民谣', async () => fetchTopPlaylists('民谣', cookie, '民谣'));

    return candidates;
};

export const selectCandidatesToDownload = (
    candidates: NeteaseDailyCandidate[],
    localSignatures: Set<string>,
    limit = DAILY_SYNC_LIMIT,
): NeteaseDailySelection => {
    const selected: NeteaseDailyCandidate[] = [];
    const seenSignatures = new Set<string>();
    let skippedExisting = 0;
    let skippedDuplicate = 0;

    for (const candidate of candidates) {
        const signature = buildTrackSignature(candidate.title, candidate.artist, candidate.duration);
        if (!signature) {
            continue;
        }

        if (localSignatures.has(signature)) {
            skippedExisting++;
            continue;
        }

        if (seenSignatures.has(signature)) {
            skippedDuplicate++;
            continue;
        }

        seenSignatures.add(signature);
        selected.push(candidate);

        if (selected.length >= limit) {
            break;
        }
    }

    return {
        selected,
        skippedExisting,
        skippedDuplicate,
    };
};

const hasDailySyncRunToday = () => {
    const row = db.prepare(`
        SELECT id
        FROM tasks
        WHERE type = ? AND date(created_at, 'localtime') = date('now', 'localtime')
        ORDER BY created_at DESC
        LIMIT 1
    `).get(NETEASE_DAILY_SYNC_TASK_TYPE) as { id: string } | undefined;

    return Boolean(row?.id);
};

export const runNeteaseDailySyncPipeline = async (musicDir: string, cookie: string) => {
    if (inFlightGuard.active) {
        console.log('[NetEase Daily] Skip: job is already running in this process.');
        return { skipped: true, reason: 'in_flight' as const };
    }

    if (hasDailySyncRunToday()) {
        console.log('[NetEase Daily] Skip: a daily sync task already exists for today.');
        return { skipped: true, reason: 'already_ran_today' as const };
    }

    inFlightGuard.active = true;
    let taskId = '';
    try {
        taskId = taskManager.createTask(
            NETEASE_DAILY_SYNC_TASK_TYPE,
            'NetEase daily hot sync',
            { date: new Date().toISOString().slice(0, 10) },
            undefined,
            1,
        );

        taskManager.updateTask(taskId, { status: 'running', progress: 0, message: 'Collecting NetEase hot songs...' });
        logWithTask(taskId, '[NetEase Daily] Starting daily sync pipeline.');

        const localSignatures = loadLocalTrackSignatures();
        logWithTask(taskId, `[NetEase Daily] Loaded ${localSignatures.size} local track signatures.`);

        const candidates = await collectCandidates(cookie, taskId);
        const selection = selectCandidatesToDownload(candidates, localSignatures, DAILY_SYNC_LIMIT);

        taskManager.updateTask(taskId, {
            progress: 25,
            message: `Collected ${candidates.length} candidates, selected ${selection.selected.length} new tracks.`,
        });

        logWithTask(
            taskId,
            `[NetEase Daily] Selected ${selection.selected.length} songs; skipped ${selection.skippedExisting} existing and ${selection.skippedDuplicate} duplicate candidates.`,
        );

        let downloadedCount = 0;
        let failedCount = 0;

        for (const [index, candidate] of selection.selected.entries()) {

            if (taskManager.isCancelled(taskId)) {
                taskManager.updateTask(taskId, {
                    status: 'cancelled',
                    message: `Cancelled after downloading ${downloadedCount} songs.`,
                });
                return {
                    skipped: false,
                    taskId,
                    candidateCount: candidates.length,
                    downloadedCount,
                    failedCount,
                    ...selection,
                };
            }

            taskManager.updateTask(taskId, {
                progress: 25 + Math.round(((index + 1) / Math.max(selection.selected.length, 1)) * 55),
                message: `Downloading ${index + 1}/${selection.selected.length}: ${candidate.title}`,
            });

            try {
                await downloadAndTagNeteaseSong(candidate.id, musicDir, db, 'exhigh', cookie, taskId);
                downloadedCount++;
            } catch (error: any) {
                if (String(error?.message || '').includes('CANCELLED')) {
                    taskManager.updateTask(taskId, {
                        status: 'cancelled',
                        message: `Cancelled after downloading ${downloadedCount} songs.`,
                    });
                    return {
                        skipped: false,
                        taskId,
                        candidateCount: candidates.length,
                        downloadedCount,
                        failedCount,
                        ...selection,
                    };
                }

                failedCount++;
                logWithTask(taskId, `[NetEase Daily] Failed to download ${candidate.title}: ${error?.message || error}`);
            }
        }

        if (taskManager.isCancelled(taskId)) {
            taskManager.updateTask(taskId, {
                status: 'cancelled',
                message: `Cancelled after downloading ${downloadedCount} songs.`,
            });
            return {
                skipped: false,
                taskId,
                candidateCount: candidates.length,
                downloadedCount,
                failedCount,
                ...selection,
            };
        }

        try {
            logWithTask(taskId, '[NetEase Daily] Refreshing library scan.');
            await scanLibrary(musicDir);
        } catch (error: any) {
            logWithTask(taskId, `[NetEase Daily] Library scan failed: ${error?.message || error}`);
        }

        if (!taskManager.isCancelled(taskId)) {
            try {
                logWithTask(taskId, '[NetEase Daily] Refreshing pending metadata scrape.');
                await processPendingTracks();
            } catch (error: any) {
                logWithTask(taskId, `[NetEase Daily] Pending scrape failed: ${error?.message || error}`);
            }
        }

        const result = {
            candidateCount: candidates.length,
            downloadedCount,
            failedCount,
            skippedExisting: selection.skippedExisting,
            skippedDuplicate: selection.skippedDuplicate,
        };

        const message = `Daily sync complete: ${downloadedCount} downloaded, ${selection.skippedExisting} existing skipped, ${selection.skippedDuplicate} duplicate candidates skipped, ${failedCount} failed.`;
        taskManager.updateTask(taskId, {
            status: 'completed',
            progress: 100,
            message,
            result: JSON.stringify(result),
        });
        logWithTask(taskId, `[NetEase Daily] ${message}`);

        return {
            skipped: false,
            taskId,
            ...result,
            ...selection,
        };
    } catch (error: any) {
        if (taskId) {
            taskManager.updateTask(taskId, { status: 'failed', message: error?.message || 'NetEase daily sync failed' });
        }
        throw error;
    } finally {
        inFlightGuard.active = false;
    }
};
