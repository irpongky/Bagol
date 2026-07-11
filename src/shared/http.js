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

export async function getTmdbMetadata(tmdbId, mediaType) {
    try {
        const endpoint = mediaType === "tv"
            ? `${TMDB_BASE_URL}/tv/${tmdbId}`
            : `${TMDB_BASE_URL}/movie/${tmdbId}`;
        const res = await fetch(`${endpoint}?append_to_response=credits&language=en-US&api_key=${TMDB_API_KEY}&include_adult=true`);
        if (!res.ok) return null;
        const data = await res.json();
        
        const director = mediaType === 'movie' 
            ? (data.credits?.crew?.filter(c => c.job === 'Director') || [])
            : (data.created_by || []);

        // Collect alternative titles for better matching
        const altTitles = [];
        if (data.original_title && data.original_title !== (data.title || data.name)) altTitles.push(data.original_title);
        if (data.original_language && data.title !== data.original_title) {
            // For FR/JP content, original titles often match better on English sites
        }
            
        return {
            tmdb: {
                title: data.title || data.name,
                altTitles,
                year: (data.release_date || data.first_air_date || '').split('-')[0],
                runtime: data.runtime || data.episode_run_time?.[0],
                genres: data.genres?.map(g => g.name) || [],
                cast: data.credits?.cast?.slice(0, 3) || [],
                director: director,
                adult: data.adult,
                rated: data.release_dates?.results?.find(r => r.iso_3166_1 === 'US')?.release_dates?.[0]?.certification
            },
            enrichment: {} // Placeholder if needed
        };
    } catch {
        return null;
    }
}

// ──────────────────────────────────────────────────────────────────────
// TITLE MATCHING (DLE-compatible isTitleMatch)
// ──────────────────────────────────────────────────────────────────────

function stripAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeVersion(t) {
    return t.toLowerCase()
        .replace(/\bii\b/g, ' 2 ')
        .replace(/\biii\b/g, ' 3 ')
        .replace(/\biv\b/g, ' 4 ')
        .replace(/\bv\b/g, ' 5 ')
        .replace(/\bvi\b/g, ' 6 ')
        .replace(/\bvii\b/g, ' 7 ')
        .replace(/\bviii\b/g, ' 8 ')
        .replace(/\bix\b/g, ' 9 ')
        .replace(/\bx\b/g, ' 10 ');
}

const NOISE_WORDS = ['vol', 'volume', 'part', 'partie', 'season', 'saison', 'ep', 'episode', 's', 'and', 'the', 'a', 'an', 'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'en', 'au', 'aux', 'il', 'je', 'tu', 'ma', 'mon', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'qui', 'que', 'dont', 'o\u00f9', 'et', 'ou', 'ne', 'pas', 'pour', 'par', 'sur', 'avec', 'sans', 'dans'];

function cleanTitleWords(t) {
    const normalized = normalizeVersion(stripAccents(t));
    return normalized.replace(/\./g, '')
        .replace(/_/g, ' ')
        .replace(/['\u2019']/g, '')
        .replace(/([a-z])([0-9])/g, '$1 $2')
        .replace(/([0-9])([a-z])/g, '$1 $2')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word && !NOISE_WORDS.includes(word));
}

function getNumbersFromWords(words) {
    return words.filter(w => /^\d+$/.test(w));
}

function isTitleMatch(refTitle, mirrorTitle) {
    if (!refTitle || !mirrorTitle) return false;
    
    const w1 = cleanTitleWords(refTitle);
    const w2 = cleanTitleWords(mirrorTitle);
    if (w1.length === 0 || w2.length === 0) return false;

    // 1. STRICT VERSIONING
    const n1 = getNumbersFromWords(w1);
    const n2 = getNumbersFromWords(w2);
    if (n1.length > 0 || n2.length > 0) {
        if (n1.length !== n2.length) return false;
        if (!n1.every((v, i) => v === n2[i])) return false;
    }

    // 2. LENGTH RATIO CHECK
    const lenDiff = Math.abs(w1.length - w2.length);
    const maxLen = Math.max(w1.length, w2.length);
    if (lenDiff / maxLen > 0.4) return false;

    // 3. WORD MATCHING (with singular normalization)
    const norm = (words) => words.map(w => w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
    const nw1 = norm(w1);
    const nw2 = norm(w2);

    const containsAll = (source, target) => target.every(word => source.includes(word));
    const shorterNw = nw1.length <= nw2.length ? nw1 : nw2;
    const longerNw = nw1.length <= nw2.length ? nw2 : nw1;
    if (containsAll(longerNw, shorterNw)) {
        if (shorterNw.length >= 3 || longerNw.length - shorterNw.length <= 1) return true;
    }
    if (containsAll(nw1, nw2) || containsAll(nw2, nw1)) {
        const sLen = Math.min(nw1.length, nw2.length);
        const lLen = Math.max(nw1.length, nw2.length);
        if (sLen >= 3 || lLen - sLen <= 1) return true;
    }

    // 4. JOINED STRING MATCH
    const joined1 = nw1.join('');
    const joined2 = nw2.join('');
    if (joined1 === joined2) return true;
    if (joined1.length > 5 && joined2.length > 5 && (joined1.startsWith(joined2) || joined2.startsWith(joined1))) return true;

    // 5. SUBSTRING MATCH (3+ words, word count close)
    if (nw1.length >= 3 && nw2.length >= 3 && Math.abs(nw1.length - nw2.length) <= 1) {
        const shorter = nw1.length <= nw2.length ? nw1 : nw2;
        const longer = nw1.length <= nw2.length ? nw2 : nw1;
        const shorterJoined = shorter.join(' ');
        const longerJoined = longer.join(' ');
        if (shorterJoined.length > 5 && longerJoined.includes(shorterJoined)) return true;
    }

    return false;
}

export function findBestMatch(tmdbTitle, searchResults, referenceYear = null, altTitles = []) {
    if (!tmdbTitle || !searchResults || searchResults.length === 0) return null;

    // Build list of reference titles to check
    const refTitles = [tmdbTitle, ...altTitles];

    for (const result of searchResults) {
        const siteTitle = result.title || '';
        
        // 1. STRICT YEAR VERIFICATION
        if (referenceYear) {
            const yearInSite = siteTitle.match(/\b(19|20)\d{2}\b/);
            if (yearInSite && yearInSite[0] !== String(referenceYear)) {
                continue;
            }
        }

        // 2. Direct title match using DLE-style isTitleMatch
        for (const ref of refTitles) {
            if (isTitleMatch(ref, siteTitle)) {
                return { result, score: 1.0 };
            }
        }
    }

    return null;
}

export function generateQueryVariants(title) {
    if (!title) return [];
    const variants = [title];
    
    // Clean year for search query
    const cleaned = title.replace(/\s*\(\d{4}\)/g, '').trim();
    if (cleaned !== title) variants.push(cleaned);

    // Strip accents for search
    const stripped = stripAccents(cleaned);
    if (stripped !== cleaned) variants.push(stripped);

    // Add hyphenated variant
    variants.push(cleaned.replace(/\s+/g, '-'));
    
    return [...new Set(variants.filter(v => v.length >= 3))];
}
