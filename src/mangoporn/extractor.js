import { fetchText, getTitleFromTmdb } from '../shared/http.js';
import { extractFromUrl } from '../shared/extractors.js';
import { isBlocked } from '../shared/filters.js';
import cheerio from 'cheerio-without-node-native';

const BASE_URL = 'https://mangoporn.net';

async function searchSite(query) {
    const url = `${BASE_URL}/page/1/?s=${encodeURIComponent(query)}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const results = [];

    $('article').each((_, el) => {
        const title = $(el).find('div h3').text().trim();
        const href = $(el).find('div h3 a').attr('href');
        if (title && href && !isBlocked(title)) {
            results.push({ title, href });
        }
    });

    return results;
}

async function getVideoLinks(pageUrl) {
    const html = await fetchText(pageUrl);
    const $ = cheerio.load(html);
    const links = [];

    $('div#pettabs > ul a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) links.push(href);
    });

    return links;
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    const title = await getTitleFromTmdb(tmdbId, mediaType);
    const query = title || String(tmdbId);

    const results = await searchSite(query);
    if (!results.length) return [];

    const streams = [];

    for (const result of results.slice(0, 3)) {
        const videoLinks = await getVideoLinks(result.href);

        for (const link of videoLinks) {
            const extracted = await extractFromUrl(link, result.href);
            if (extracted) {
                streams.push(...extracted.map(s => ({
                    ...s,
                    title: `[Mangoporn] ${s.title}`
                })));
            }
        }

        if (streams.length > 0) break;
    }

    return streams;
}
