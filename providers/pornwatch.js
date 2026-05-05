const BASE_URL = "https://pornwatch.ws";

/**
 * PROVIDER: PORNWATCH.WS
 * Logika: AJAX Handshake menggunakan helper internal Nuvio
 */
async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        // 1. Ambil data film via TMDB Helper
        const title = await getTitleFromTmdb(tmdbId, mediaType);
        
        // 2. Search ke situs target
        const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
        const searchHtml = await fetchText(searchUrl);
        const $search = cheerio.load(searchHtml);
        
        const movieHref = $search(".result-item .title a").first().attr("href");
        if (!movieHref) return [];

        // 3. Ambil Post ID dari halaman film
        const pageHtml = await fetchText(movieHref);
        const $page = cheerio.load(pageHtml);
        const postId = $page("#player").attr("data-post");
        if (!postId) return [];

        const streams = [];
        const serverOptions = [];

        // 4. Kumpulkan data server (DooPlay Options)
        $page(".dooplay_player_option").each((_, el) => {
            serverOptions.push({
                nume: $page(el).attr("data-nume"),
                type: $page(el).attr("data-type"),
                label: $page(el).find(".server").text().trim() || "Server"
            });
        });

        // 5. Handshake AJAX: Tembak endpoint tersembunyi
        for (const opt of serverOptions) {
            try {
                // Body manual (paling aman untuk sandbox JS)
                const body = `action=doo_player_ajax&post=${postId}&nume=${opt.nume}&type=${opt.type}`;
                
                // Gunakan fetchText dengan method POST
                const response = await fetchText(`${BASE_URL}/wp-admin/admin-ajax.php`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "X-Requested-With": "XMLHttpRequest",
                        "Referer": movieHref
                    },
                    body: body
                });

                const data = JSON.parse(response);

                if (data && data.embed_url) {
                    let finalUrl = data.embed_url;
                    
                    // Bersihkan link jika di dalam iframe src
                    if (finalUrl.includes('src="')) {
                        const match = finalUrl.match(/src="([^"]+)"/);
                        if (match) finalUrl = match[1];
                    }
                    
                    if (finalUrl.startsWith('//')) finalUrl = `https:${finalUrl}`;

                    // 6. Eksekusi Extractor bawaan Nuvio
                    const extracted = await extractFromUrl(finalUrl, movieHref);
                    if (extracted && extracted.length > 0) {
                        for (const s of extracted) {
                            streams.push({
                                ...s,
                                title: `[PornWatch] ${opt.label} - ${s.title || ''}`
                            });
                        }
                    }
                }
            } catch (innerErr) {
                // Lanjut ke server berikutnya jika satu server gagal
            }
        }

        return streams;

    } catch (error) {
        // Log ini penting buat lo liat di console kalau ada crash
        console.error("[PornWatch] Error:", error.message);
        return [];
    }
}

// Registrasi Top-Level
module.exports = { getStreams };
