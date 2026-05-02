import { extractStreams } from './extractor.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[Mangoporn] Request: ${mediaType} ${tmdbId}`);
        const streams = await extractStreams(tmdbId, mediaType, season, episode);
        return streams;
    } catch (error) {
        console.error(`[Mangoporn] Error: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
