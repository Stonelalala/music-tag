import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTrackSignature } from './utils/track_signature';
import { selectCandidatesToDownload, type NeteaseDailyCandidate } from './netease_daily_sync';

const createCandidate = (
    overrides: Partial<NeteaseDailyCandidate> & { id: string; title: string; artist: string; duration: number },
): NeteaseDailyCandidate => ({
    id: overrides.id,
    title: overrides.title,
    artist: overrides.artist,
    album: overrides.album ?? 'Album',
    duration: overrides.duration,
    coverUrl: overrides.coverUrl ?? null,
    source: overrides.source ?? 'source',
    sourceLabel: overrides.sourceLabel ?? 'source',
});

test('selects up to twenty new candidates and skips local or duplicate signatures', () => {
    const candidates: NeteaseDailyCandidate[] = [
        createCandidate({ id: '1', title: 'Song A', artist: 'Artist A', duration: 240 }),
        createCandidate({ id: '2', title: 'Song A (Live)', artist: 'Artist A', duration: 240 }),
        createCandidate({ id: '3', title: 'Song B', artist: 'Artist B', duration: 215 }),
        ...Array.from({ length: 25 }, (_, index) =>
            createCandidate({
                id: String(index + 4),
                title: `Song ${index + 4}`,
                artist: `Artist ${index + 4}`,
                duration: 200 + index,
            }),
        ),
    ];

    const localSignatures = new Set<string>([
        buildTrackSignature('Song B', 'Artist B', 215),
    ]);

    const result = selectCandidatesToDownload(candidates, localSignatures, 20);

    assert.equal(result.selected.length, 20);
    assert.equal(result.skippedExisting, 1);
    assert.equal(result.skippedDuplicate, 1);
    assert.equal(result.selected[0]?.id, '1');
    assert.equal(result.selected[1]?.id, '4');
});
