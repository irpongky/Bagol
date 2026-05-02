import { fetchText, getTitleFromTmdb } from '../shared/http.js';
import { extractFromUrl } from '../shared/extractors.js';
import { isBlocked } from '../shared/filters.js';
import cheerio from 'cheerio-without-node-native';

const BASE_URL = 'https://pornwatch.ws';

// ─────────────────────────────────────────────────────────────────
// searchSite — tidak ada bug mayor, tapi tambahkan URL normalization
// dan fallback selector untuk href agar lebih robust
// ─────────────────────────────────────────────────────────────────
async function searchSite(query) {
    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const results = [];

    $('div.ml-item').each((_, el) => {
        const title =
            $(el).find('h2').first().text().trim() ||
            $(el).find('h3').first().text().trim();

        let href =
            $(el).find('a').first().attr('href');

        if (!href) return;

        // Normalize URL
        if (href.startsWith('//')) href = 'https:' + href;
        else if (href.startsWith('/')) href = BASE_URL + href;
        else if (!href.startsWith('http')) href = BASE_URL + '/' + href;

        if (title && href && !isBlocked(title)) {
            results.push({ title, href });
        }
    });

    console.log(`[PornWatch] search "${query}" → ${results.length} results`);
    return results;
}

// ─────────────────────────────────────────────────────────────────
// BUG FIX: getVideoLinks
//
// Selector lama: $('div#pettabs').find('div.Rtable1-cell a')
//   Bug 1: PornWatch tidak memakai <div id="pettabs"> — selector ini
//          tidak akan menemukan apapun. Wrapper yang benar adalah
//          langsung <div class="Rtable1"> atau <div class="Rtable1-cell">
//   Bug 2: href tidak di-normalize ke absolute URL
//
// Fix:
//   - Hapus wrapper #pettabs yang tidak ada
//   - Cari langsung di .Rtable1 a atau .Rtable1-cell a
//   - Fallback: cari semua link yang mengandung domain video host
//   - Normalize href ke absolute URL
// ─────────────────────────────────────────────────────────────────
async function getVideoLinks(pageUrl) {
    const html = await fetchText(pageUrl, {
        headers: { Referer: BASE_URL + '/' }
    });
    const $ = cheerio.load(html);
    const seen = new Set();
    const links = [];

    // Selector yang benar untuk PornWatch: .Rtable1 berisi server links
    const selectors = [
        'div.Rtable1 a',
        'div.Rtable1-cell a',
        'div.server-list a',
        '#servers a',
        'div.servers a',
    ];

    for (const sel of selectors) {
        $(sel).each((_, el) => {
            let href = $(el).attr('href') || $(el).attr('data-embed') || $(el).attr('data-src');
            if (!href) return;

            // Normalize URL
            if (href.startsWith('//')) href = 'https:' + href;
            else if (href.startsWith('/')) href = BASE_URL + href;
            else if (!href.startsWith('http')) href = BASE_URL + '/' + href;

            if (!seen.has(href)) {
                seen.add(href);
                links.push(href);
            }
        });
        if (links.length > 0) break; // pakai selector pertama yang berhasil
    }

    console.log(`[PornWatch] video links for ${pageUrl}: ${links.join(' | ')}`);
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
