export const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";

export const HEADERS = {
    "User-Agent": UA,
};

const DEFAULT_TIMEOUT_MS = 6000;

export async function fetchText(url, options = {}) {
    const controller = new AbortController();
    // [FIX] Extract timeout before spreading options — prevents options.signal from overriding our controller
    const { timeout, signal: _ignored, headers: optHeaders, ...restOpts } = options;
    const timer = setTimeout(() => controller.abort(), timeout || DEFAULT_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            ...restOpts,
            headers: { ...HEADERS, ...optHeaders },
            signal: controller.signal,  // Always use our controller — never allow override
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return response.text();
    } finally {
        clearTimeout(timer);
    }
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
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(`${endpoint}?language=en-US&api_key=${TMDB_API_KEY}`, { signal: controller.signal });
            if (!res.ok) return null;
            const data = await res.json();
            return data.title || data.name || null;
        } finally {
            clearTimeout(timer);
        }
    } catch {
        return null;
    }
}
