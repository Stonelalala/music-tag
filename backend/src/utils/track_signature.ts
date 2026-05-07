const COMMON_TRACK_SUFFIX_PATTERNS = [
    /\s*[-–—]\s*(live|remaster(?:ed)?|edit|version|demo|acoustic|radio edit|mono|stereo)\s*$/i,
    /\s*[\[(（【]\s*(live|remaster(?:ed)?|edit|version|demo|acoustic|radio edit|mono|stereo)\s*[\])）】]\s*$/i,
];

const ARTIST_SPLIT_PATTERN = /[\/|,&+;、，／·•]+/u;
const ARTIST_FEAT_PATTERN = /\b(feat|ft|featuring|with|vs|x)\b/gi;

export const normalizeComparableText = (value: string | null | undefined) =>
    (value ?? '')
        .normalize('NFKC')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

export const stripCommonTrackSuffixes = (value: string | null | undefined) => {
    let result = normalizeComparableText(value);

    for (const pattern of COMMON_TRACK_SUFFIX_PATTERNS) {
        result = result.replace(pattern, '');
    }

    return result.trim();
};

export const normalizeTrackTitleKey = (title: string | null | undefined) =>
    stripCommonTrackSuffixes(title)
        .normalize('NFKC')
        .replace(/[\s\p{P}\p{S}]+/gu, '');

const normalizeArtistToken = (token: string) =>
    token
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .trim();

export const normalizeTrackArtistKey = (artist: string | null | undefined) => {
    const normalized = normalizeComparableText(artist);
    if (!normalized) {
        return '';
    }

    const prepared = normalized
        .replace(ARTIST_FEAT_PATTERN, ',')
        .replace(ARTIST_SPLIT_PATTERN, ',');

    const tokens = prepared
        .split(',')
        .map(normalizeArtistToken)
        .filter(Boolean);

    if (tokens.length === 0) {
        return '';
    }

    return Array.from(new Set(tokens)).sort().join('|');
};

export const normalizeTrackDuration = (duration: number | null | undefined) => {
    if (!Number.isFinite(duration ?? Number.NaN) || (duration ?? 0) <= 0) {
        return 0;
    }

    return Math.round(duration as number);
};

export const buildTrackSignature = (
    title: string | null | undefined,
    artist: string | null | undefined,
    duration: number | null | undefined,
) => {
    const titleKey = normalizeTrackTitleKey(title);
    if (!titleKey) {
        return '';
    }

    const artistKey = normalizeTrackArtistKey(artist);
    const durationKey = normalizeTrackDuration(duration);
    return `${titleKey}::${artistKey}::${durationKey}`;
};

export const buildTrackSignatureParts = (
    title: string | null | undefined,
    artist: string | null | undefined,
    duration: number | null | undefined,
) => {
    const titleKey = normalizeTrackTitleKey(title);
    const artistKey = normalizeTrackArtistKey(artist);
    const durationKey = normalizeTrackDuration(duration);

    return {
        titleKey,
        artistKey,
        durationKey,
        signature: titleKey ? `${titleKey}::${artistKey}::${durationKey}` : '',
    };
};
