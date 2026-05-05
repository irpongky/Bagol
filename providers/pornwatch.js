const cheerio = require('cheerio');

const PornWatch = {
  baseUrl: "https://pornwatch.ws",

  /**
   * EXTRACTOR: Bongkar Link Mentah Jadi Direct Stream
   * Biar Nuvio lo nggak cuma dapet 404/Loading.
   */
  async resolveStream(embedUrl, referer) {
    try {
      // 1. VOE.SX Extractor (Bypass Base64)
      if (embedUrl.includes('voe.sx')) {
        const html = await fetchText(embedUrl, { "Referer": referer });
        const base64Data = html.match(/atob\(['"]([^'"]+)['"]\)/)?.[1];
        if (base64Data) {
          const decoded = JSON.parse(Buffer.from(base64Data, 'base64').toString());
          const streamUrl = decoded.file || decoded.url;
          return {
            url: streamUrl,
            headers: { "Referer": "https://voe.sx/", "User-Agent": "Mozilla/5.0" },
            isM3U8: streamUrl.includes('.m3u8')
          };
        }
      }

      // 2. PLAY4ME Family (Handshake API) - Termasuk upns.online, rpmplay, dll.
      if (embedUrl.includes('#') && (embedUrl.includes('player4me') || embedUrl.includes('upns.online') || embedUrl.includes('rpmplay') || embedUrl.includes('embedseek'))) {
        const id = embedUrl.split('#')[1];
        const domain = new URL(embedUrl).hostname;
        const apiUrl = `https://${domain}/api/v1/video?id=${id}`;

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { "Referer": referer, "X-Requested-With": "XMLHttpRequest" }
        });
        const data = await res.json();
        if (data && data.url) {
          return {
            url: data.url,
            headers: { "Referer": `https://${domain}/` },
            isM3U8: data.url.includes('.m3u8')
          };
        }
      }

      // 3. DOODSTREAM (Return as Embed for Player)
      if (embedUrl.includes('dood') || embedUrl.includes('doply')) {
        return { url: embedUrl, headers: { "Referer": referer }, isEmbed: true };
      }

      return null;
    } catch (e) {
      return null;
    }
  },

  /**
   * PROVIDER CORE: Ambil Semua Server via AJAX
   */
  async getStreams(tmdbId, mediaType) {
    try {
      // Step 1: Cari judul di TMDB dan Search di situs
      const title = await getTitleFromTmdb(tmdbId, mediaType);
      const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(title)}`;
      const searchHtml = await fetchText(searchUrl);
      const $search = cheerio.load(searchHtml);
      
      const movieHref = $search(".result-item .title a").first().attr("href");
      if (!movieHref) return [];

      // Step 2: Masuk ke halaman film & ambil Post ID
      const pageHtml = await fetchText(movieHref);
      const $page = cheerio.load(pageHtml);
      const postId = $page("#player").attr("data-post");
      if (!postId) return [];

      const streams = [];
      const ajaxRequests = [];

      // Step 3: Identifikasi semua opsi server (DooPlay Options)
      $page(".dooplay_player_option").each((_, el) => {
        const nume = $(el).attr("data-nume");
        const type = $(el).attr("data-type");
        const label = $(el).find(".server").text().trim() || `Server ${nume}`;

        // Logic AJAX: Tembak endpoint /wp-admin/admin-ajax.php
        ajaxRequests.push((async () => {
          try {
            const res = await fetch(`${this.baseUrl}/wp-admin/admin-ajax.php`, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": movieHref },
              body: new URLSearchParams({ action: "doo_player_ajax", post: postId, nume, type })
            });
            const data = await res.json();

            if (data && data.embed_url) {
              // Extract URL dari iframe string jika perlu
              const embedUrl = data.embed_url.match(/src="([^"]+)"/)?.[1] || data.embed_url;
              const cleanEmbedUrl = embedUrl.startsWith('//') ? `https:${embedUrl}` : embedUrl;

              // Step 4: RESOLVE link mentah jadi link siap putar
              const resolved = await this.resolveStream(cleanEmbedUrl, movieHref);
              if (resolved) {
                streams.push({
                  title: `[PornWatch] ${label}`,
                  url: resolved.url,
                  headers: resolved.headers,
                  isM3U8: resolved.isM3U8,
                  isEmbed: resolved.isEmbed,
                  quality: "Auto"
                });
              }
            }
          } catch (err) { /* silent fail for single server */ }
        })());
      });

      await Promise.all(ajaxRequests);
      return streams;

    } catch (error) {
      console.error("[PornWatch] Final Error:", error);
      return [];
    }
  }
};

module.exports = PornWatch;
