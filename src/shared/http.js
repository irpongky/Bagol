// src/shared/http.js

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";
const HEADERS = { "User-Agent": UA };
const DEFAULT_TIMEOUT_MS = 10000;

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function fetchWithRetry(url, options = {}, retries = 3) {
  const controller = new AbortController();
  const { timeout, signal: _ignored, headers: optHeaders, ...restOpts } = options;
  const timer = setTimeout(() => controller.abort(), timeout || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...restOpts,
      headers: { ...HEADERS, ...optHeaders },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response;
  } catch (e) {
    if (retries > 0 && (e.name === 'AbortError' || e.message.includes('HTTP 429'))) {
      await new Promise(r => setTimeout(r, 1000 * (4 - retries)));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, options = {}) {
  const response = await fetchWithRetry(url, options);
  return response.text();
}

async function fetchJson(url, options = {}) {
  const raw = await fetchText(url, options);
  return JSON.parse(raw);
}

async function getTitleFromTmdb(tmdbId, mediaType) {
  if (!tmdbId) return null;

  const types = mediaType === "tv" ? ["tv", "movie"] : ["movie", "tv"];

  for (const type of types) {
    try {
      const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?language=en-US&api_key=${TMDB_API_KEY}&include_adult=true`;
      const res = await fetchWithRetry(url, { timeout: 8000 }, 2);
      const data = await res.json();
      const title = data.title || data.name || null;
      if (title) return { title, type, data };
    } catch (e) {
      // Continue to next type
    }
  }
  return null;
}

async function resolveMetadata(id, mediaType) {
  if (!id) return { title: null, id: null };

  const idStr = String(id);

  if (idStr.startsWith("tt")) {
    try {
      const url = `${TMDB_BASE_URL}/find/${idStr}?external_source=imdb_id&api_key=${TMDB_API_KEY}&include_adult=true`;
      const res = await fetchWithRetry(url, { timeout: 8000 }, 2);
      const data = await res.json();

      const movieResults = data.movie_results || [];
      const tvResults = data.tv_results || [];

      if (mediaType === "tv" && tvResults.length > 0) {
        const tv = tvResults[0];
        return { title: tv.name, id: tv.id, type: "tv" };
      }
      if (movieResults.length > 0) {
        const movie = movieResults[0];
        return { title: movie.title, id: movie.id, type: "movie" };
      }
      if (tvResults.length > 0) {
        const tv = tvResults[0];
        return { title: tv.name, id: tv.id, type: "tv" };
      }

      return { title: idStr, id: idStr, type: mediaType || "movie" };
    } catch (e) {
      return { title: idStr, id: idStr, type: mediaType || "movie" };
    }
  }

  if (idStr.startsWith("tmdb:")) {
    const parts = idStr.split(":");
    let tmdbId = parts[parts.length - 1];
    let type = mediaType;

    if (parts.length >= 3) {
      type = parts[1];
    }

    const result = await getTitleFromTmdb(tmdbId, type);
    if (result) {
      return { title: result.title, id: tmdbId, type: result.type };
    }
    return { title: null, id: tmdbId, type: type || "movie" };
  }

  const result = await getTitleFromTmdb(idStr, mediaType);
  if (result) {
    return { title: result.title, id: idStr, type: result.type };
  }
  return { title: null, id: idStr, type: mediaType || "movie" };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchText, fetchJson, getTitleFromTmdb, resolveMetadata, TMDB_API_KEY, TMDB_BASE_URL };
}
