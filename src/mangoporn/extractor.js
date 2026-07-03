import { fetchText, getTitleFromTmdb, findBestMatch, generateQueryVariants } from '../shared/http.js';
import { extractFromUrl, isKnownEmbedHost } from '../shared/extractors.js';
import { isBlocked } from '../shared/filters.js';
import cheerio from 'cheerio-without-node-native';

const BASE_URL = 'https://mangoporn.net';

async function searchSite(query) {
    const url = `${BASE_URL}/page/1/?s=${encodeURIComponent(query)}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const results = [];

    $('article').each((_, el) => {
        const title = $(el).find('div.details a').first().text().trim()
            || $(el).find('div h3').text().trim()
            || $(el).find('h2').text().trim();
        const href = $(el).find('div.image a').attr('href')
            || $(el).find('div.details a').attr('href')
            || $(el).find('h3 a').attr('href')
            || $(el).find('a').first().attr('href');
        if (title && href && !isBlocked(title)) {
            results.push({ title, href });
        }
    });

    if (!results.length) {
        $('div.ml-item, article, div.item, div.post, div.video-item').each((_, el) => {
            const title = $(el).find('h2, h3, .title').first().text().trim();
            const href = $(el).find('a').first().attr('href');
            if (title && href && href.startsWith('http') && !isBlocked(title)) {
                results.push({ title, href });
            }
        });
    }

    return results;
}

async function getVideoLinks(pageUrl) {
    const html = await fetchText(pageUrl);
    const $ = cheerio.load(html);
    const links = new Set();

    $('div#pettabs > ul a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) links.add(href);
    });

    if (!links.size) {
        const selectors = [
            'div#pettabs a', '#pettabs a', 'div.Rtable1-cell a',
            'div.Rtable1 a', 'div.servers a', 'div.embed-links a',
            'div.tabs a', 'div.player-links a', 'ul.servers-list a',
        ];
        for (const sel of selectors) {
            $(sel).each((_, el) => {
                const href = $(el).attr('href');
                if (href && href.startsWith('http')) links.add(href);
            });
            if (links.size) break;
        }
    }

    if (!links.size) {
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href') || '';
            if (href.startsWith('http') && isKnownEmbedHost(href)) links.add(href);
        });
    }

    return [...links];
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    const tmdbTitle = await getTitleFromTmdb(tmdbId, mediaType);

    const queries = generateQueryVariants(tmdbTitle || String(tmdbId));

    let allResults = [];

    for (const query of queries) {
        const results = await searchSite(query);
        if (results.length) {
            allResults = results;
            break;
        }
    }

    if (!allResults.length) return [];

    let bestResult = null;

    if (tmdbTitle) {
        const match = findBestMatch(tmdbTitle, allResults, 0.4);
        if (match) {
            bestResult = match.result;
            console.log(`[Mangoporn] Best match: "${bestResult.title}" (score: ${match.score.toFixed(2)})`);
        }
    }

    if (!bestResult) {
        bestResult = allResults[0];
        console.log(`[Mangoporn] Fallback to first result: "${bestResult.title}"`);
    }

    const videoLinks = await getVideoLinks(bestResult.href);
    const streams = [];

    for (const link of videoLinks) {
        const extracted = await extractFromUrl(link, BASE_URL + '/');
        if (extracted) {
            streams.push(...extracted.map(s => ({
                ...s,
                title: `[Mangoporn] ${s.title}`
            })));
        }
    }

    return streams;
}
