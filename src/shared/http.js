export const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";

export const HEADERS = {
    "User-Agent": UA,
};

export async function fetchText(url, options = {}) {
    const response = await fetch(url, {
        headers: { ...HEADERS, ...options.headers },
        ...options,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.text();
}

export async function fetchJson(url, options = {}) {
    const raw = await fetchText(url, options);
    return JSON.parse(raw);
}

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function getTitleFromTmdb(tmdbId, mediaType) {
    try {
        const endpoint = mediaType === "tv"
            ? `${TMDB_BASE_URL}/tv/${tmdbId}`
            : `${TMDB_BASE_URL}/movie/${tmdbId}`;
        const res = await fetch(`${endpoint}?language=en-US&api_key=${TMDB_API_KEY}&include_adult=true`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.title || data.name || null;
    } catch {
        return null;
    }
}

// ──────────────────────────────────────────────────────────────────────
// FUZZY TITLE MATCHING UTILITIES
// ──────────────────────────────────────────────────────────────────────

function normalizeTitle(title) {
    if (!title) return '';
    return title
        .toLowerCase()
        .replace(/\(\d{4}\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function wordOverlapScore(titleA, titleB) {
    const wordsA = new Set(normalizeTitle(titleA).split(' ').filter(w => w.length > 2));
    const wordsB = new Set(normalizeTitle(titleB).split(' ').filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let intersection = 0;
    for (const word of wordsA) {
        if (wordsB.has(word)) intersection++;
    }
    const union = new Set([...wordsA, ...wordsB]).size;
    return intersection / union;
}

function containsAllWords(shorter, longer) {
    const shortWords = normalizeTitle(shorter).split(' ').filter(w => w.length > 2);
    const longWords = new Set(normalizeTitle(longer).split(' ').filter(w => w.length > 2));
    if (shortWords.length === 0) return false;
    return shortWords.every(w => longWords.has(w));
}

export function findBestMatch(tmdbTitle, searchResults, threshold = 0.5) {
    if (!tmdbTitle || !searchResults || searchResults.length === 0) return null;
    let best = null;
    let bestScore = -1;
    const normTmdb = normalizeTitle(tmdbTitle);
    for (const result of searchResults) {
        const siteTitle = result.title || '';
        const normSite = normalizeTitle(siteTitle);
        if (normTmdb === normSite) {
            return { result, score: 1.0 };
        }
        const overlap = wordOverlapScore(tmdbTitle, siteTitle);
        const contained = containsAllWords(tmdbTitle, siteTitle);
        const reverseContained = containsAllWords(siteTitle, tmdbTitle);
        let score = overlap;
        if (contained) score += 0.15;
        if (reverseContained) score += 0.1;
        if (score > bestScore) {
            bestScore = score;
            best = result;
        }
    }
    if (bestScore >= threshold) {
        return { result: best, score: bestScore };
    }
    return null;
}

export function generateQueryVariants(title) {
    if (!title) return [];
    const variants = [title];
    const colonIdx = title.indexOf(':');
    if (colonIdx > 0) {
        variants.push(title.substring(0, colonIdx).trim());
    }
    const yearMatch = title.match(/^(.*?)(\s*\(\d{4}\))?$/);
    if (yearMatch && yearMatch[1].trim() !== title) {
        variants.push(yearMatch[1].trim());
    }
    const suffixes = ['hd', 'full movie', 'watch online', 'free', 'xxx', 'parody'];
    let cleaned = title.toLowerCase();
    for (const suffix of suffixes) {
        cleaned = cleaned.replace(new RegExp(`\s*${suffix}\s*`, 'gi'), ' ');
    }
    cleaned = cleaned.trim();
    if (cleaned !== title.toLowerCase().trim() && cleaned.length > 3) {
        variants.push(cleaned);
    }
    return [...new Set(variants)];
}
