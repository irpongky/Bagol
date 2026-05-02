import { fetchText, getTitleFromTmdb } from '../shared/http.js';
import { extractFromUrl } from '../shared/extractors.js';
import { isBlocked } from '../shared/filters.js';
import cheerio from 'cheerio-without-node-native';

const BASE_URL = 'https://xxxparodyhd.net';

// ─────────────────────────────────────────────────────────────────
// searchSite — robust selector + URL normalization
// ─────────────────────────────────────────────────────────────────
async function searchSite(query) {
    const url = `${BASE_URL}/search/${encodeURIComponent(query)}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const results = [];

    $('div.movies-list div.ml-item').each((_, el) => {
        const title =
            $(el).find('h2').first().text().trim() ||
            $(el).find('h3').first().text().trim();

        let href = $(el).find('a').first().attr('href');
        if (!href) return;

        // Normalize URL
        if (href.startsWith('//')) href = 'https:' + href;
        else if (href.startsWith('/')) href = BASE_URL + href;
        else if (!href.startsWith('http')) href = BASE_URL + '/' + href;

        if (title && href && !isBlocked(title)) {
            results.push({ title, href });
        }
    });

    console.log(`[XXXParodyHD] search "${query}" → ${results.length} results`);
    return results;
}

// ─────────────────────────────────────────────────────────────────
// BUG FIX: getVideoLinks — CRITICAL
//
// Selector lama: $('div.Rtable1 a[id="#iframe"]')
//
// Ini TIDAK VALID dan selalu mengembalikan 0 hasil karena:
//   1. CSS attribute selector [id="value"] mencocokkan literal nilai
//      atribut id. Sebuah id TIDAK MUNGKIN mengandung karakter "#"
//      secara valid di HTML — tapi bahkan kalau mengandungnya,
//      selector CSS [id="#iframe"] harus ditulis [id="\#iframe"]
//   2. Cheerio mengikuti aturan CSS standar, jadi selector ini
//      tidak pernah match elemen apapun
//
// Dari kode Kotlin (Cloudstream) yang asli, link server biasanya
// disimpan di:
//   - <a href="..." data-id="..."> di dalam div.Rtable1
//   - atau <a href="..." id="tab-X"> untuk tiap server tab
//   - atribut yang dicari adalah href (URL embed), bukan id
//
// Fix:
//   - Cari semua <a> di dalam div.Rtable1 yang punya href valid
//   - Filter: hanya ambil yang href-nya mengarah ke video host
//     (bukan navigasi internal situs)
//   - Fallback selectors untuk jaga-jaga struktur berubah
//   - Normalize URL
// ─────────────────────────────────────────────────────────────────
async function getVideoLinks(pageUrl) {
    const html = await fetchText(pageUrl, {
        headers: { Referer: BASE_URL + '/' }
    });
    const $ = cheerio.load(html);
    const seen = new Set();
    const links = [];

    // Selector fallback chain
    const selectors = [
        'div.Rtable1 a',
        'div.Rtable1-cell a',
        'div.server-list a',
        '#servers a',
        'div.tab-content a[data-embed]',
        'div.tabs-content a',
    ];

    for (const sel of selectors) {
        $(sel).each((_, el) => {
            // Ambil href atau data-embed (beberapa site simpan URL di sini)
            let href =
                $(el).attr('data-embed') ||
                $(el).attr('data-src') ||
                $(el).attr('href');

            if (!href) return;
            // Skip anchor internal (#...) dan javascript:
            if (href.startsWith('#') || href.startsWith('javascript')) return;
            // Skip link yang mengarah ke situs itu sendiri (navigasi)
            if (href.startsWith(BASE_URL) && !href.includes('/e/') && !href.includes('/embed')) return;

            // Normalize URL
            if (href.startsWith('//')) href = 'https:' + href;
            else if (href.startsWith('/')) href = BASE_URL + href;
            else if (!href.startsWith('http')) href = BASE_URL + '/' + href;

            if (!seen.has(href)) {
                seen.add(href);
                links.push(href);
            }
        });
        if (links.length > 0) break;
    }

    console.log(`[XXXParodyHD] video links for ${pageUrl}: ${links.join(' | ')}`);
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
                    title: `[XXXParodyHD] ${s.title}`
                })));
            }
        }

        if (streams.length > 0) break;
    }

    return streams;
}
