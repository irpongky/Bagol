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
        const res = await fetch(`${endpoint}?language=en-US&api_key=${TMDB_API_KEY}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.title || data.name || null;
    } catch {
        return null;
    }
}

export async function getMetadataFromTmdb(tmdbId, mediaType) {
    try {
        const endpoint = mediaType === "tv"
            ? `${TMDB_BASE_URL}/tv/${tmdbId}`
            : `${TMDB_BASE_URL}/movie/${tmdbId}`;
        const res = await fetch(`${endpoint}?language=en-US&api_key=${TMDB_API_KEY}`);
        if (!res.ok) return null;
        const data = await res.json();
        const title = data.title || data.name || null;
        const releaseDate = data.release_date || data.first_air_date || null;
        const year = releaseDate ? releaseDate.split("-")[0] : null;
        return { title, year };
    } catch {
        return null;
    }
}
