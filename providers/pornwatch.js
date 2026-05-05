/**
 * PROVIDER: PORNWATCH.WS
 * FIX: AJAX Handshake + No-Node-Modules (Nuvio Safe)
 */

const BASE_URL = "https://pornwatch.ws";

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        // 1. Ambil Judul & Year pake helper global Nuvio
        const title = await getTitleFromTmdb(tmdbId, mediaType);
        const year = await getYearFromTmdb(tmdbId, mediaType);
        
        // 2. Search ke situs
        const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
        const searchHtml = await fetchText(searchUrl);
        const $search = cheerio.load(searchHtml);
        
        const movieHref = $search(".result-item .title a").first().attr("href");
        if (!movieHref) return [];

        // 3. Masuk ke halaman film buat ambil Post ID (Ini yang lo lewatkan kemarin)
        const pageHtml = await fetchText(movieHref);
        const $page = cheerio.load(pageHtml);
        const postId = $page("#player").attr("data-post");
        if (!postId) return [];

        const streams = [];
        const options = [];

        // 4. Cari semua opsi server di list
        $page(".dooplay_player_option").each((_, el) => {
            options.push({
                nume: $page(el).attr("data-nume"),
                type: $page(el).attr("data-type"),
                post: $page(el).attr("data-post") || postId,
                label: $page(el).find(".server").text().trim() || "Server"
            });
        });

        // 5. Handshake AJAX: Ambil link asli dari database mereka
        for (const opt of options) {
            try {
                // Pake string body biasa biar gak butuh URLSearchParams
                const body = `action=doo_player_ajax&post=${opt.post}&nume=${opt.nume}&type=${opt.type}`;
                
                const res = await fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "X-Requested-With": "XMLHttpRequest",
                        "Referer": movieHref
                    },
                    body: body
                });

                const data = await res.json();

                if (data && data.embed_url) {
                    // Bersihin tag <iframe> kalau ada
                    let embedUrl = data.embed_url;
                    if (embedUrl.includes('src="')) {
                        const match = embedUrl.match(/src="([^"]+)"/);
                        if (match) embedUrl = match[1];
                    }
                    
                    const finalUrl = embedUrl.startsWith('//') ? `https:${embedUrl}` : embedUrl;

                    // 6. SERAHKAN KE EXTRACTOR GLOBAL (Biar Nuvio yang jamin Playable)
                    const extracted = await extractFromUrl(finalUrl, movieHref);
                    if (extracted && extracted.length > 0) {
                        streams.push(...extracted.map(s => ({
                            ...s,
                            title: `[PornWatch] ${opt.label} - ${s.title || ''}`
                        })));
                    }
                }
            } catch (srvErr) { /* Skip server yang error */ }
        }

        return streams;

    } catch (error) {
        console.error("[PornWatch] Fatal Error:", error);
        return [];
    }
}

module.exports = { getStreams };
