// XXXParodyHD Provider for Nuvio
// Site: xxxparodyhd.net
// Extractors: DoodStream, Streamwish, Vidhidepro, Javggvideo, Javclan, MixDrop

const cheerio = require("cheerio-without-node-native");

// ── Constants ─────────────────────────────────────────────────────────────────
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://xxxparodyhd.net";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Blocked keywords ──────────────────────────────────────────────────────────
const BLOCKED_WORDS = [
  "gay","homosexual","queer","homo","androphile","femboy","feminine boy","effeminate",
  "trap","trans","Trade","Vers","Twink","Otter","Bear","Femme","Masc",
  "Pegging","Femdom","futa","tranny","crossdress","Bisexual","Intersex","LGBTQ",
  "tgirl","t-girl","Transsexual","TS","TGirl","T-Boy"
];
var BLOCKED_RE = new RegExp(
  "(?:" + BLOCKED_WORDS.map(function(w){ return w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }).join("|") + ")",
  "i"
);
function isBlocked(title) { return BLOCKED_RE.test(title); }

// ── HTTP ──────────────────────────────────────────────────────────────────────
function fetchText(url, extraHeaders) {
  return fetch(url, {
    headers: Object.assign({
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,*/*",
      "Accept-Language": "en-US,en;q=0.9"
    }, extraHeaders || {})
  }).then(function(r) {
    if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
    return r.text();
  });
}

function fixUrl(href, base) {
  if (!href) return null;
  href = href.trim();
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return "https:" + href;
  if (href.startsWith("/")) return (base || BASE_URL) + href;
  return (base || BASE_URL) + "/" + href;
}

// ── p,a,c,k,e,d JS Unpacker ───────────────────────────────────────────────────
function unpackPacked(src) {
  if (src.indexOf("eval(function(p,a,c,k,e,") === -1) return src;
  try {
    var m = src.match(/\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('([|]?)'\)/);
    if (!m) return src;
    var p    = m[1];
    var base = parseInt(m[2], 10);
    var keys = m[4].split(m[5] || "|");
    return p.replace(/\b\w+\b/g, function(word) {
      var n = parseInt(word, base);
      return (n >= 0 && n < keys.length && keys[n] !== "") ? keys[n] : word;
    });
  } catch(e) { return src; }
}

function findInScripts($, finderFn) {
  var result = null;
  $("script").each(function(_, el) {
    if (result) return false;
    var raw = $(el).html() || "";
    var txt = unpackPacked(raw);
    var found = finderFn(txt, raw);
    if (found) { result = found; return false; }
  });
  return result;
}

// ── TMDB ──────────────────────────────────────────────────────────────────────
function getTmdbTitle(tmdbId, mediaType) {
  var url = "https://api.themoviedb.org/3/" + mediaType + "/" + tmdbId
          + "?api_key=" + TMDB_API_KEY + "&language=en-US";
  return fetch(url, { headers: { "User-Agent": UA } })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) { return d ? (d.title || d.name || null) : null; })
    .catch(function() { return null; });
}

// ── Extractor: DoodStream ─────────────────────────────────────────────────────
function extractDoodStream(url) {
  var host = url.includes("myvidplay.com") ? "https://myvidplay.com"
           : url.includes("doply.net")     ? "https://doply.net"
           : "https://dood.pm";
  return fetchText(url, { Referer: host })
    .then(function(html) {
      var m = html.match(/\/pass_md5\/([^/]+)\/([^'"\s]+)/);
      if (!m) return null;
      var passPath = m[0], token = m[2], expiry = m[1];
      return fetchText(host + passPath, { Referer: url })
        .then(function(base) {
          base = base.trim();
          var videoUrl = base + "?token=" + token + "&expiry=" + expiry + "000";
          return [{ name: "DoodStream", title: "DoodStream", url: videoUrl, quality: "auto",
                    headers: { "User-Agent": UA, Referer: host } }];
        });
    })
    .catch(function(e) { console.log("[XXXParodyHD] DoodStream error: " + e.message); return null; });
}

// ── Extractor: Streamwish / Javsw / Swhoi ────────────────────────────────────
// These sites use p,a,c,k,e,d obfuscation on scripts with JWPlayer sources
function extractStreamwish(url) {
  var host = new URL(url).origin;
  return fetchText(url, { Referer: BASE_URL + "/", Origin: host })
    .then(function(html) {
      var $ = cheerio.load(html);
      var fileUrl = findInScripts($, function(unpacked) {
        // Match sources:[{file:"..."}] or file:"..."
        var m = unpacked.match(/sources\s*:\s*\[\s*\{[^}]*file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (!m) m = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        return m ? m[1] : null;
      });
      if (!fileUrl) return null;
      return [{ name: "Streamwish", title: "Streamwish", url: fileUrl, quality: "auto",
                headers: { Referer: host + "/", Origin: host } }];
    })
    .catch(function(e) { console.log("[XXXParodyHD] Streamwish error: " + e.message); return null; });
}

// ── Extractor: Vidhidepro / VidhideVIP / Javlion ─────────────────────────────
// Same pattern as Streamwish - JWPlayer with packed scripts
function extractVidhidepro(url) {
  var host = new URL(url).origin;
  return fetchText(url, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var $ = cheerio.load(html);
      var fileUrl = findInScripts($, function(unpacked) {
        var m = unpacked.match(/sources\s*:\s*\[\s*\{[^}]*file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (!m) m = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        return m ? m[1] : null;
      });
      if (!fileUrl) return null;
      return [{ name: "Vidhidepro", title: "Vidhidepro", url: fileUrl, quality: "auto",
                headers: { Referer: host + "/", Origin: host } }];
    })
    .catch(function(e) { console.log("[XXXParodyHD] Vidhidepro error: " + e.message); return null; });
}

// ── Extractor: Javggvideo ─────────────────────────────────────────────────────
// Kotlin: substringAfter("var urlPlay = '").substringBefore("';")
function extractJavggvideo(url) {
  return fetchText(url, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var m = html.match(/var urlPlay\s*=\s*["']([^"']+)["']/);
      if (!m) {
        // Also try unpacked version
        var $ = cheerio.load(html);
        m = findInScripts($, function(unpacked) {
          var mm = unpacked.match(/var urlPlay\s*=\s*["']([^"']+)["']/);
          return mm ? mm[1] : null;
        });
        if (!m) return null;
        return [{ name: "Javggvideo", title: "Javggvideo", url: m, quality: "auto",
                  headers: { "User-Agent": UA } }];
      }
      return [{ name: "Javggvideo", title: "Javggvideo", url: m[1], quality: "auto",
                headers: { "User-Agent": UA } }];
    })
    .catch(function(e) { console.log("[XXXParodyHD] Javggvideo error: " + e.message); return null; });
}

// ── Extractor: Javclan ────────────────────────────────────────────────────────
function extractJavclan(url) {
  return fetchText(url, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var $ = cheerio.load(html);
      var fileUrl = findInScripts($, function(unpacked) {
        var m = unpacked.match(/sources\s*:\s*\[\s*\{[^}]*file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (!m) m = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        return m ? m[1] : null;
      });
      if (!fileUrl) return null;
      return [{ name: "Javclan", title: "Javclan", url: fileUrl, quality: "auto",
                headers: { Referer: BASE_URL + "/", "User-Agent": UA } }];
    })
    .catch(function(e) { console.log("[XXXParodyHD] Javclan error: " + e.message); return null; });
}

// ── Extractor: MixDrop ────────────────────────────────────────────────────────
// Pattern: MDCore.wurl = "//..." or vsr="..." or wurl="..." in script
function extractMixdrop(url) {
  return fetchText(url, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var $ = cheerio.load(html);
      var fileUrl = findInScripts($, function(unpacked) {
        var m = unpacked.match(/(?:MDCore\.\w+|vsr|wurl|surl)\s*=\s*["']([^"']+)["']/);
        if (m) {
          var v = m[1];
          return v.startsWith("//") ? "https:" + v : v;
        }
        return null;
      });
      if (!fileUrl) return null;
      return [{ name: "MixDrop", title: "MixDrop", url: fileUrl, quality: "auto",
                headers: { "User-Agent": UA } }];
    })
    .catch(function(e) { console.log("[XXXParodyHD] MixDrop error: " + e.message); return null; });
}

// ── Generic fallback ──────────────────────────────────────────────────────────
function extractGeneric(url) {
  var host = "";
  try { host = new URL(url).origin; } catch(e) { return Promise.resolve(null); }
  return fetchText(url, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var $ = cheerio.load(html);
      var fileUrl = findInScripts($, function(unpacked) {
        var m = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        return m ? m[1] : null;
      });
      if (!fileUrl) return null;
      return [{ name: "Video", title: "Video", url: fileUrl, quality: "auto",
                headers: { Referer: host + "/" } }];
    })
    .catch(function() { return null; });
}

// ── Host routing ──────────────────────────────────────────────────────────────
var DOOD_HOSTS      = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm","dooood.com","easyvidplayer.com"];
var STREAMWISH_HOSTS = ["streamwish.to","streamwish.com","streamhihi.com","javsw.me","swhoi.com","muvicloud.com","stream.lol","playerwish.com","wishfast.top"];
var VIDHIDE_HOSTS   = ["vidhidepro.com","vidhidevip.com","vidhide.com","javlion.xyz","hideguard.com"];
var MIXDROP_HOSTS   = ["mixdrop.ag","mixdrop.my","mixdrop.is","mixdrop.co","mixdrop.ch","mixdroop.com"];
var UPNS_HOSTS      = ["upns.online","my.upns.online","seekplayer.vip","embedseek.online"];

function extractFromUrl(url) {
  if (DOOD_HOSTS.some(function(h){ return url.includes(h); }))       return extractDoodStream(url);
  if (STREAMWISH_HOSTS.some(function(h){ return url.includes(h); })) return extractStreamwish(url);
  if (VIDHIDE_HOSTS.some(function(h){ return url.includes(h); }))    return extractVidhidepro(url);
  if (url.includes("javggvideo.xyz") || url.includes("javgg.net"))   return extractJavggvideo(url);
  if (url.includes("javclan.com"))                                    return extractJavclan(url);
  if (MIXDROP_HOSTS.some(function(h){ return url.includes(h); }))    return extractMixdrop(url);
  return extractGeneric(url);
}

// ── Site scraping ─────────────────────────────────────────────────────────────
function searchSite(query) {
  return fetchText(BASE_URL + "/search/" + encodeURIComponent(query))
    .then(function(html) {
      var $ = cheerio.load(html);
      var results = [];
      $("div.movies-list div.ml-item").each(function(_, el) {
        var title = $(el).find("h2").first().text().trim();
        var href  = fixUrl($(el).find("a").first().attr("href"));
        if (title && href && !isBlocked(title)) results.push({ title: title, href: href });
      });
      console.log("[XXXParodyHD] search '" + query + "' -> " + results.length + " results");
      return results;
    });
}

// loadLinks: div.Rtable1 a[id="#iframe"]
// The id attribute value is literally "#iframe" (with the hash character)
function getVideoLinks(pageUrl) {
  return fetchText(pageUrl, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var $ = cheerio.load(html);
      var links = [];
      $("div.Rtable1 a").each(function(_, el) {
        var id   = $(el).attr("id");
        var href = $(el).attr("href");
        if (id === "#iframe" && href) links.push(fixUrl(href, pageUrl));
      });
      console.log("[XXXParodyHD] video links: " + links.join(" | "));
      return links;
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {
  console.log("[XXXParodyHD] tmdbId=" + tmdbId + " type=" + mediaType);
  return getTmdbTitle(tmdbId, mediaType)
    .then(function(title) {
      if (!title) { console.log("[XXXParodyHD] no TMDB title"); return []; }
      console.log("[XXXParodyHD] title=" + title);
      return searchSite(title);
    })
    .then(function(results) {
      if (!results || !results.length) return [];
      var chain = Promise.resolve([]);
      results.slice(0, 3).forEach(function(result) {
        chain = chain.then(function(streams) {
          if (streams.length) return streams;
          return getVideoLinks(result.href)
            .then(function(links) {
              return Promise.all(links.map(function(link) { return extractFromUrl(link); }));
            })
            .then(function(extracted) {
              var found = [];
              extracted.forEach(function(items) {
                if (items) items.forEach(function(s) {
                  found.push(Object.assign({}, s, { title: "[XXXParodyHD] " + s.title }));
                });
              });
              return found;
            });
        });
      });
      return chain;
    })
    .catch(function(e) {
      console.error("[XXXParodyHD] Error: " + e.message);
      return [];
    });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
