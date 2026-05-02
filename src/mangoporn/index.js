import { extractStreams } from './extractor.js';

// ─────────────────────────────────────────────────────────────────
// BUG FIX: mixed module system
// Kode lama pakai `import` di extractor.js tapi `module.exports` di index.js
// → tidak konsisten ESM vs CJS, bisa gagal di runtime Nuvio tergantung loader
// Fix: gunakan export default (ESM) agar konsisten dengan file lain
// ─────────────────────────────────────────────────────────────────
export async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[Mangoporn] Request: ${mediaType} ${tmdbId}`);
        const streams = await extractStreams(tmdbId, mediaType, season, episode);
        return streams;
    } catch (error) {
        console.error(`[Mangoporn] Error: ${error.message}`);
        return [];
    }
}
