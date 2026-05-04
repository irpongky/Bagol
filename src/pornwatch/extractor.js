import { fetchText, getMetadataFromTmdb } from '../shared/http.js';
import { extractFromUrl, isKnownEmbedHost } from '../shared/extractors.js';
import { isBlocked } from '../shared/filters.js';
import cheerio from 'cheerio-without-node-native';

const BASE_URL = 'https://pornwatch.ws';

async function searchSite(query) {
    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const results = [];

    $('div.ml-item').each((_, el) => {
        const title = $(el).find('h2').text().trim() || $(el).find('h3').text().trim();
        const href = $(el).find('a').first().attr('href');
        if (title && href && !isBlocked(title)) {
            results.push({ title, href });
        }
    });

    if (!results.length) {
        $('article, div.item, div.post, div.video-item').each((_, el) => {
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

    $('div#pettabs div.Rtable1-cell a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) links.add(href);
    });

    if (!links.size) {
        const selectors = [
            'div#pettabs a',
            '#pettabs a',
            'div.Rtable1-cell a',
            'div.Rtable1 a',
            'div.servers a',
            'div.embed-links a',
            'div.tabs a',
            'div.player-links a',
            'ul.servers-list a',
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
        if (year) {
            const yearInTitle = result.title.match(/\b(19|20)\d{2}\b/);
            if (yearInTitle && yearInTitle[0] !== year) {
                continue;
            }
        }

        const videoLinks = await getVideoLinks(result.href);
        for (const link of videoLinks) {
            const extracted = await extractFromUrl(link, BASE_URL + '/');
            if (extracted) {
                streams.push(...extracted.map(s => ({
                    ...s,
                    title: `[PornWatch] ${s.title}`
                })));
            }
        }
        if (streams.length > 0) break;
    }

    return streams;
}
