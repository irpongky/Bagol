import { fetchText, resolveMetadata } from '../shared/http.js';
import { extractFromUrl, isKnownEmbedHost } from '../shared/extractors.js';
import { isBlocked } from '../shared/filters.js';
import { isMatch } from '../shared/utils.js';
import cheerio from 'cheerio-without-node-native';

const BASE_URL = 'https://pornwatch.ws';

// Paths that are nav/meta links and NOT movie pages
const NAV_PATHS = /\/(movies-2|xxxfree|most-viewed-2|most-rating-2|director|genre|casts|release-year|wp-|xmlrpc|wp-json|\?)/ ;

async function searchSite(query, expectedTitle) {
    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const results = [];
    const seen = new Set();

    // Primary: original ml-item selector (older theme)
    $('div.ml-item').each((_, el) => {
        const title = $(el).find('h2').text().trim() || $(el).find('h3').text().trim();
        const href = $(el).find('a').first().attr('href');
        if (title && href && !isBlocked(title) && !seen.has(href)) {
            if (isMatch(title, expectedTitle)) {
                seen.add(href);
                results.push({ title, href });
            }
        }
    });

    // Fallback: article / generic item selectors
    if (!results.length) {
        $('article, div.item, div.post, div.video-item').each((_, el) => {
            const title = $(el).find('h2, h3, .title').first().text().trim();
            const href = $(el).find('a').first().attr('href');
            if (title && href && href.startsWith('http') && !isBlocked(title) && !seen.has(href)) {
                if (isMatch(title, expectedTitle)) {
                    seen.add(href);
                    results.push({ title, href });
                }
            }
        });
    }

    // Last resort: scrape all unique internal links that look like movie slugs
    if (!results.length) {
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href') || '';
            if (
                href.startsWith(BASE_URL + '/') &&
                !NAV_PATHS.test(href) &&
                !seen.has(href)
            ) {
                const title = $(el).attr('title') || $(el).text().trim();
                if (title && !isBlocked(title)) {
                    if (isMatch(title, expectedTitle)) {
                        seen.add(href);
                        results.push({ title, href });
                    }
                }
            }
        });
    }

    return results;
}

async function getVideoLinks(pageUrl) {
    const html = await fetchText(pageUrl);
    const $ = cheerio.load(html);
    const links = new Set();

    // Primary: original selector
    $('div#pettabs div.Rtable1-cell a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) links.add(href);
    });

    // Fallback selectors
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

    // Last resort: scan ALL links for known streaming hosts
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
    const metadata = await resolveMetadata(tmdbId, mediaType);
    const query = metadata.title || String(tmdbId);

    const results = await searchSite(query, metadata.title);
    if (!results.length) return [];

    const streams = [];

    for (const result of results.slice(0, 3)) {
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
