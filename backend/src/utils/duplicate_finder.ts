export interface DuplicateTrackCandidate {
  id: string;
  filepath: string;
  filename: string;
  extension: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  bitrate: number;
  sampleRate: number;
  size: number;
  scrapeStatus: number;
}

export interface DuplicateTrackFile extends DuplicateTrackCandidate {
  qualityScore: number;
  isRecommendedKeep: boolean;
  recommendedDelete: boolean;
}

export interface DuplicateTrackGroup {
  title: string;
  artist: string;
  recommendedKeepId: string;
  files: DuplicateTrackFile[];
}

import {
  normalizeComparableText,
  normalizeTrackTitleKey,
} from './track_signature';

const UNKNOWN_ARTISTS = new Set([
  '',
  'unknown',
  'unknown artist',
  '未知',
  '未知艺术家',
  '未知歌手',
]);

const FORMAT_SCORES: Record<string, number> = {
  '.flac': 640,
  '.wav': 610,
  '.ape': 590,
  '.alac': 580,
  '.aiff': 560,
  '.m4a': 470,
  '.aac': 455,
  '.ogg': 430,
  '.opus': 420,
  '.mp3': 390,
  '.wma': 340,
};

const TIMESTAMP_FILENAME_PATTERN = /(?:_|-)(?:19|20)\d{6,12}(?=\.[^.]+$)/;
const COPY_FILENAME_PATTERN = /(copy|duplicate|副本|拷贝|重复)/i;
const DURATION_TOLERANCE_SECONDS = 3;

const normalizeText = (value: string | null | undefined) =>
  normalizeComparableText(value);

const normalizeTitleKey = (title: string) => normalizeTrackTitleKey(title);

const normalizeArtistToken = (token: string) =>
  token
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();

const normalizeArtistKey = (artist: string) => {
  const normalized = normalizeText(artist);
  if (UNKNOWN_ARTISTS.has(normalized)) {
    return '';
  }

  const prepared = normalized
    .replace(/\b(feat|ft|featuring|with|vs|x)\b/gi, ',')
    .replace(/[\/／、，;&+]+/g, ',');
  const tokens = prepared
    .split(',')
    .map(normalizeArtistToken)
    .filter(Boolean);

  if (tokens.length === 0) {
    return '';
  }

  return Array.from(new Set(tokens)).sort().join('|');
};

const scoreTrackForKeeping = (track: DuplicateTrackCandidate) => {
  const extension = normalizeText(track.extension);
  const sizeInMb = Math.max(track.size, 0) / (1024 * 1024);
  let score = FORMAT_SCORES[extension] ?? 320;

  score += Math.min(Math.max(track.bitrate, 0), 2000) / 4;
  score += Math.min(Math.max(track.sampleRate, 0), 192000) / 1800;
  score += Math.min(sizeInMb, 220);

  if (track.scrapeStatus === 1) {
    score += 40;
  } else if (track.scrapeStatus === 0) {
    score -= 10;
  }

  if (track.duration > 0) {
    score += 12;
  }

  if (normalizeArtistKey(track.artist) !== '') {
    score += 18;
  }

  if (TIMESTAMP_FILENAME_PATTERN.test(track.filename)) {
    score -= 30;
  }

  if (COPY_FILENAME_PATTERN.test(track.filename)) {
    score -= 18;
  }

  return Math.round(score);
};

const sortFilesByQuality = (
  left: DuplicateTrackCandidate,
  right: DuplicateTrackCandidate,
) => {
  const scoreDelta = scoreTrackForKeeping(right) - scoreTrackForKeeping(left);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const sizeDelta = right.size - left.size;
  if (sizeDelta !== 0) {
    return sizeDelta;
  }

  return left.filename.localeCompare(right.filename, 'zh-CN');
};

const clusterByDuration = (
  tracks: DuplicateTrackCandidate[],
  includeMissingDurationCluster: boolean,
) => {
  const groups: DuplicateTrackCandidate[][] = [];
  const withDuration = tracks
    .filter((track) => track.duration > 0)
    .sort((left, right) => left.duration - right.duration);
  const withoutDuration = tracks.filter((track) => track.duration <= 0);

  let currentGroup: DuplicateTrackCandidate[] = [];
  for (const track of withDuration) {
    const lastTrack = currentGroup[currentGroup.length - 1];
    if (
      currentGroup.length === 0 ||
      (lastTrack !== undefined &&
          Math.abs(track.duration - lastTrack.duration) <=
              DURATION_TOLERANCE_SECONDS)
    ) {
      currentGroup.push(track);
      continue;
    }

    if (currentGroup.length > 1) {
      groups.push(currentGroup);
    }
    currentGroup = [track];
  }

  if (currentGroup.length > 1) {
    groups.push(currentGroup);
  }

  if (includeMissingDurationCluster && withoutDuration.length > 1) {
    groups.push(withoutDuration);
  }

  return groups;
};

const getDisplayArtist = (tracks: DuplicateTrackCandidate[]) => {
  const artists = Array.from(
    new Set(
      tracks
        .map((track) => track.artist?.trim())
        .filter(
          (artist): artist is string =>
            Boolean(artist) && !UNKNOWN_ARTISTS.has(normalizeText(artist)),
        ),
    ),
  );

  if (artists.length > 0) {
    return artists.join(' / ');
  }

  return '未知艺术家';
};

const getReclaimableBytes = (files: DuplicateTrackFile[]) =>
  files
    .filter((file) => file.recommendedDelete)
    .reduce((total, file) => total + Math.max(file.size, 0), 0);

export const buildDuplicateGroups = (tracks: DuplicateTrackCandidate[]) => {
  const titleBuckets = new Map<string, DuplicateTrackCandidate[]>();

  for (const track of tracks) {
    const titleKey = normalizeTitleKey(track.title);
    if (!titleKey) {
      continue;
    }

    const current = titleBuckets.get(titleKey) ?? [];
    current.push(track);
    titleBuckets.set(titleKey, current);
  }

  const duplicateGroups: DuplicateTrackGroup[] = [];

  for (const bucket of titleBuckets.values()) {
    if (bucket.length < 2) {
      continue;
    }

    const knownArtistBuckets = new Map<string, DuplicateTrackCandidate[]>();
    const unknownArtistTracks: DuplicateTrackCandidate[] = [];

    for (const track of bucket) {
      const artistKey = normalizeArtistKey(track.artist);
      if (!artistKey) {
        unknownArtistTracks.push(track);
        continue;
      }

      const current = knownArtistBuckets.get(artistKey) ?? [];
      current.push(track);
      knownArtistBuckets.set(artistKey, current);
    }

    const candidateClusters: DuplicateTrackCandidate[][] = [];

    for (const artistBucket of knownArtistBuckets.values()) {
      candidateClusters.push(...clusterByDuration(artistBucket, true));
    }

    candidateClusters.push(
      ...clusterByDuration(
        unknownArtistTracks.filter((track) => track.duration > 0),
        false,
      ),
    );

    for (const cluster of candidateClusters) {
      if (cluster.length < 2) {
        continue;
      }

      const sortedCluster = [...cluster].sort(sortFilesByQuality);
      const bestTrack = sortedCluster[0];
      if (bestTrack === undefined) {
        continue;
      }
      const recommendedKeepId = bestTrack.id;
      const files = sortedCluster.map((track) => {
        const qualityScore = scoreTrackForKeeping(track);
        const isRecommendedKeep = track.id === recommendedKeepId;

        return {
          ...track,
          qualityScore,
          isRecommendedKeep,
          recommendedDelete: !isRecommendedKeep,
        };
      });

      duplicateGroups.push({
        title: bestTrack.title?.trim() || '未知标题',
        artist: getDisplayArtist(sortedCluster),
        recommendedKeepId,
        files,
      });
    }
  }

  duplicateGroups.sort((left, right) => {
    const reclaimableDelta =
      getReclaimableBytes(right.files) - getReclaimableBytes(left.files);
    if (reclaimableDelta !== 0) {
      return reclaimableDelta;
    }

    return left.title.localeCompare(right.title, 'zh-CN');
  });

  return duplicateGroups;
};
