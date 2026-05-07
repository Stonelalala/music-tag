import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildTrackSignature,
    normalizeTrackArtistKey,
    normalizeTrackTitleKey,
} from './track_signature';

test('normalizes common live and remix suffixes from titles', () => {
    assert.equal(
        normalizeTrackTitleKey('Love Story (Live)'),
        normalizeTrackTitleKey('Love Story'),
    );
    assert.equal(
        normalizeTrackTitleKey('爱与痛的边缘 - Remastered'),
        normalizeTrackTitleKey('爱与痛的边缘'),
    );
});

test('normalizes artist ordering and featured splits', () => {
    assert.equal(
        normalizeTrackArtistKey('A / B'),
        normalizeTrackArtistKey('B, A'),
    );
    assert.equal(
        normalizeTrackArtistKey('A feat. B'),
        normalizeTrackArtistKey('B & A'),
    );
});

test('builds stable signatures with rounded durations', () => {
    assert.equal(
        buildTrackSignature('Song', 'Artist', 240.2),
        buildTrackSignature('Song ', 'Artist', 240.4),
    );
});
