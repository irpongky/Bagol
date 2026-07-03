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
    if (!tmdbId) return null;
    try {
        const type = mediaType === "tv" ? "tv" : "movie";
        const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?language=en-US&api_key=${TMDB_API_KEY}`;
        
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(url, { signal: controller.signal });
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

/**
 * Resolves metadata (title and potentially true ID) from various ID formats.
 * Supported formats:
 * - IMDb ID: tt1234567
 * - Prefixed TMDB: tmdb:123 or tmdb:movie:123 or tmdb:tv:123
 * - Raw TMDB ID: 123
 */
export async function resolveMetadata(id, mediaType) {
    if (!id) return { title: null, id: null };

    const idStr = String(id);
    
    // 1. Handle IMDb ID (e.g., tt1234567)
    if (idStr.startsWith("tt")) {
        try {
            const url = `${TMDB_BASE_URL}/find/${idStr}?external_source=imdb_id&api_key=${TMDB_API_KEY}`;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            try {
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok) return { title: null, id: idStr };
                const data = await res.json();
                
                // Try movie first, then tv
                const movie = data.movie_results?.[0];
                const tv = data.tv_results?.[0];
                
                if (movie) return { title: movie.title, id: movie.id, type: "movie" };
                if (tv) return { title: tv.name, id: tv.id, type: "tv" };
                
                return { title: null, id: idStr };
            } finally {
                clearTimeout(timer);
            }
        } catch {
            return { title: null, id: idStr };
        }
    }

    // 2. Handle Prefixed TMDB ID (e.g., tmdb:123, tmdb:movie:123, tmdb:tv:123)
    if (idStr.startsWith("tmdb:")) {
        const parts = idStr.split(":");
        let tmdbId = parts[parts.length - 1];
        let type = mediaType;
        
        if (parts.length === 3) {
            type = parts[1]; // movie or tv
        }
        
        const title = await getTitleFromTmdb(tmdbId, type);
        return { title, id: tmdbId, type };
    }

    // 3. Fallback: Raw TMDB ID
    const title = await getTitleFromTmdb(idStr, mediaType);
    return { title, id: idStr, type: mediaType };
}
