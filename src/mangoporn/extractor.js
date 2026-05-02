import { fetchText, getTitleFromTmdb } from '../shared/http.js';
import { extractFromUrl } from '../shared/extractors.js';
import { isBlocked } from '../shared/filters.js';
import cheerio from 'cheerio-without-node-native';

const BASE_URL = 'https://mangoporn.net';

// ─────────────────────────────────────────────────────────────────
// BUG FIX: searchSite
//
// Selector lama: $(el).find('div h3') dan $(el).find('div h3 a')
//   → terlalu generik, bisa nangkap elemen yang bukan judul/link utama
//   → link yang didapat kadang bukan link ke halaman video
//
// Mangoporn article structure (berdasarkan pola umum wp-theme):
//   <article>
//     <div class="image">
//       <a href="...video-page..."><img .../></a>
//     </div>
//     <div class="details">
//       <a href="...video-page...">Judul Film</a>
//     </div>
//   </article>
//
// Fix:
//   - Ambil href dari div.image > a  (lebih reliable, selalu ada)
//   - Ambil title dari div.details a atau h2/h3 di dalam article
//   - Fallback: coba berbagai selector umum sampai dapat keduanya
//   - Pastikan href adalah absolute URL
// ─────────────────────────────────────────────────────────────────
async function searchSite(query) {
    const url = `${BASE_URL}/page/1/?s=${encodeURIComponent(query)}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const results = [];

    $('article').each((_, el) => {
        // Coba berbagai selector untuk title
        const title =
            $(el).find('div.details a').first().text().trim() ||
            $(el).find('h2 a').first().text().trim() ||
            $(el).find('h3 a').first().text().trim() ||
            $(el).find('h2').first().text().trim() ||
            $(el).find('h3').first().text().trim();

        // Ambil href dari image link (paling konsisten) atau fallback ke any a[href]
        let href =
            $(el).find('div.image a').first().attr('href') ||
            $(el).find('div.details a').first().attr('href') ||
            $(el).find('a').first().attr('href');

        if (!href) return;

        // Pastikan absolute URL
        if (href.startsWith('/')) href = BASE_URL + href;
        else if (!href.startsWith('http')) href = BASE_URL + '/' + href;

        if (title && href && !isBlocked(title)) {
            results.push({ title, href });
        }
    });

    console.log(`[Mangoporn] search "${query}" → ${results.length} results`);
    return results;
}

// ─────────────────────────────────────────────────────────────────
// BUG FIX: getVideoLinks
//
// Selector lama: $('div#pettabs > ul a')
//   → Ini sudah benar strukturnya, tapi href bisa relatif dan tidak di-fix.
//
// Fix:
//   - Normalize href ke absolute URL
//   - Deduplicate link
// ─────────────────────────────────────────────────────────────────
async function getVideoLinks(pageUrl) {
    const html = await fetchText(pageUrl, {
        headers: { Referer: BASE_URL + '/' }
    });
    const $ = cheerio.load(html);
    const seen = new Set();
    const links = [];

    $('div#pettabs > ul a').each((_, el) => {
        let href = $(el).attr('href');
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

    console.log(`[Mangoporn] video links for ${pageUrl}: ${links.join(' | ')}`);
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
