import { fetchText, getMetadataFromTmdb } from '../shared/http.js';
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
        $('div.post, div.item, div.video-item, div.ml-item').each((_, el) => {
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
            'div#pettabs a',
            '#pettabs a',
            'div.pettabs a',
            'div.tabs a',
            'div.servers a',
            'div.links a',
            'div.video-links a',
            'div.Rtable1 a',
            'div.Rtable1-cell a',
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
            if (href.startsWith('http') && isKnownEmbedHost(href)) {
                links.add(href);
            }
        });
    }

    return [...links];
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    const metadata = await getMetadataFromTmdb(tmdbId, mediaType);
    if (!metadata) return [];
    const { title, year } = metadata;
    const query = title || String(tmdbId);

    const results = await searchSite(query);
    if (!results.length) return [];

    const streams = [];

    for (const result of results.slice(0, 5)) {
        // Soft year filter: only skip if year exists and is DIFFERENT
        if (year) {
            const yearInTitle = result.title.match(/\b(19|20)\d{2}\b/);
            if (yearInTitle && yearInTitle[0] !== year) {
                continue; 
            }
        }

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
