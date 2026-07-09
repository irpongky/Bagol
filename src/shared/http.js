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
            
        return {
            tmdb: {
                title: data.title || data.name,
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
// FUZZY TITLE MATCHING UTILITIES
// ──────────────────────────────────────────────────────────────────────

function normalizeTitle(title) {
    if (!title) return '';
    const noiseWords = ['vol', 'volume', 'part', 'season', 's', 'and', 'the', 'a', 'an'];
    return title
        .toLowerCase()
        .replace(/([a-z])([0-9])/g, '$1 $2')
        .replace(/([0-9])([a-z])/g, '$1 $2')
        // DONT remove year anymore, we need it for verification
        .replace(/\[.*?\]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word && !noiseWords.includes(word))
        .join(' ')
        .trim();
}

function getNumbers(title) {
    const norm = normalizeTitle(title);
    return new Set(norm.split(' ').filter(w => /^\d+$/.test(w)));
}

function wordOverlapScore(titleA, titleB) {
    const isNum = (w) => /^\d+$/.test(w);
    const wordsA = new Set(normalizeTitle(titleA).split(' ').filter(w => w.length > 2 || isNum(w)));
    const wordsB = new Set(normalizeTitle(titleB).split(' ').filter(w => w.length > 2 || isNum(w)));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let intersection = 0;
    for (const word of wordsA) {
        if (wordsB.has(word)) intersection++;
    }
    const union = new Set([...wordsA, ...wordsB]).size;
    return intersection / union;
}

export function findBestMatch(tmdbTitle, searchResults, threshold = 0.5, referenceYear = null) {
    if (!tmdbTitle || !searchResults || searchResults.length === 0) return null;
    let best = null;
    let bestScore = -1;
    const normTmdb = normalizeTitle(tmdbTitle);
    const tmdbNums = getNumbers(tmdbTitle);
    
    for (const result of searchResults) {
        const siteTitle = result.title || '';
        const normSite = normalizeTitle(siteTitle);
        
        // 1. STRICT YEAR VERIFICATION
        if (referenceYear) {
            const yearInSite = siteTitle.match(/\b(19|20)\d{2}\b/);
            if (yearInSite && yearInSite[0] !== String(referenceYear)) {
                continue; // Wrong year, discard
            }
        }

        if (normTmdb === normSite) return { result, score: 1.0 };
        
        const siteNums = getNumbers(siteTitle);
        let numMismatch = false;
        if (tmdbNums.size > 0 && siteNums.size > 0) {
            const intersect = new Set([...tmdbNums].filter(n => siteNums.has(n)));
            if (intersect.size === 0) numMismatch = true;
        }

        const overlap = wordOverlapScore(tmdbTitle, siteTitle);
        let score = overlap;
        if (numMismatch) score -= 0.3;
        
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
    
    // Clean year for search query
    const cleaned = title.replace(/\s*\(\d{4}\)/g, '').trim();
    if (cleaned !== title) variants.push(cleaned);

    const suffixes = ['hd', 'full movie', 'watch online', 'free', 'xxx', 'parody'];
    let slug = cleaned.toLowerCase();
    for (const suffix of suffixes) {
        slug = slug.replace(new RegExp(`\\s*${suffix}\\s*`, 'gi'), ' ');
    }
    slug = slug.trim();
    if (slug !== cleaned.toLowerCase() && slug.length > 3) {
        variants.push(slug);
    }
    
    // Add variations for common separators
    variants.push(cleaned.replace(/\s+/g, '-'));
    
    return [...new Set(variants.filter(v => v.length >= 3))];
}
