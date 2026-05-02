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

export async function getTitleFromTmdb(tmdbId, mediaType) {
    try {
        const endpoint = mediaType === "tv"
            ? `https://api.themoviedb.org/3/tv/${tmdbId}`
            : `https://api.themoviedb.org/3/movie/${tmdbId}`;
        const res = await fetch(`${endpoint}?language=en-US`, {
            headers: { Authorization: `Bearer ${typeof TMDB_READ_TOKEN !== "undefined" ? TMDB_READ_TOKEN : ""}` }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.title || data.name || null;
    } catch {
        return null;
    }
}
