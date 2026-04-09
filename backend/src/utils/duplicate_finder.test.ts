import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDuplicateGroups,
  type DuplicateTrackCandidate,
} from './duplicate_finder';

const createTrack = (
  overrides: Partial<DuplicateTrackCandidate>,
): DuplicateTrackCandidate => ({
  id: 'track',
  filepath: '/music/track.mp3',
  filename: 'track.mp3',
  extension: '.mp3',
  title: 'AI',
  artist: '薛之谦',
  album: '未知专辑',
  duration: 240,
  bitrate: 320,
  sampleRate: 44100,
  size: 12 * 1024 * 1024,
  scrapeStatus: 1,
  ...overrides,
});

test('groups only confident duplicates and keeps the best quality file', () => {
  const groups = buildDuplicateGroups([
    createTrack({
      id: 'keep-flac',
      filepath: '/music/ai.flac',
      filename: 'AI.flac',
      extension: '.flac',
      bitrate: 980,
      size: 31 * 1024 * 1024,
    }),
    createTrack({
      id: 'delete-mp3',
      filepath: '/music/ai-copy.mp3',
      filename: 'AI_20260228.mp3',
      duration: 241.2,
    }),
    createTrack({
      id: 'other-artist',
      filepath: '/music/other.mp3',
      filename: 'AI-chenyi.mp3',
      artist: '陈奕迅',
    }),
    createTrack({
      id: 'other-version',
      filepath: '/music/ai-live.mp3',
      filename: 'AI-live.mp3',
      duration: 312,
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.title, 'AI');
  assert.equal(groups[0]?.artist, '薛之谦');
  assert.deepEqual(
    groups[0]?.files.map((file) => file.id),
    ['keep-flac', 'delete-mp3'],
  );
  assert.equal(groups[0]?.recommendedKeepId, 'keep-flac');
  assert.equal(groups[0]?.files[0]?.isRecommendedKeep, true);
  assert.equal(groups[0]?.files[1]?.recommendedDelete, true);
  assert.ok(
    (groups[0]?.files[0]?.qualityScore ?? 0) >
      (groups[0]?.files[1]?.qualityScore ?? 0),
  );
});

test('splits tracks with the same title into separate duration clusters', () => {
  const groups = buildDuplicateGroups([
    createTrack({
      id: 'mix-a1',
      filepath: '/music/mix-a1.mp3',
      filename: 'MixA-1.mp3',
      title: '@CHENYU - 11.11 Bounce MixSet [变速,流行,多元素]',
      artist: 'CHENYU',
      duration: 694,
    }),
    createTrack({
      id: 'mix-a2',
      filepath: '/music/mix-a2.mp3',
      filename: 'MixA-2.mp3',
      title: '@CHENYU - 11.11 Bounce MixSet [变速,流行,多元素]',
      artist: 'CHENYU',
      duration: 695,
      size: 25 * 1024 * 1024,
    }),
    createTrack({
      id: 'mix-b1',
      filepath: '/music/mix-b1.mp3',
      filename: 'MixB-1.mp3',
      title: '@CHENYU - 11.11 Bounce MixSet [变速,流行,多元素]',
      artist: 'CHENYU',
      duration: 240,
    }),
    createTrack({
      id: 'mix-b2',
      filepath: '/music/mix-b2.mp3',
      filename: 'MixB-2.mp3',
      title: '@CHENYU - 11.11 Bounce MixSet [变速,流行,多元素]',
      artist: 'CHENYU',
      duration: 241,
      size: 9 * 1024 * 1024,
    }),
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => group.files.map((file) => file.id)),
    [
      ['mix-a2', 'mix-a1'],
      ['mix-b1', 'mix-b2'],
    ],
  );
});

test('skips low-confidence matches when only the title is the same', () => {
  const groups = buildDuplicateGroups([
    createTrack({
      id: 'unknown-a',
      filepath: '/music/track-a.mp3',
      filename: '队长.mp3',
      title: 'Cloudy Day',
      artist: 'Unknown Artist',
      duration: 0,
      scrapeStatus: 0,
    }),
    createTrack({
      id: 'unknown-b',
      filepath: '/music/track-b.mp3',
      filename: '阴天快乐.mp3',
      title: 'Cloudy Day',
      artist: 'Unknown Artist',
      duration: 0,
      scrapeStatus: 0,
    }),
  ]);

  assert.equal(groups.length, 0);
});
