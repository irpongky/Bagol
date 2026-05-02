// Mangoporn Provider for Nuvio (FIXED)
// Site: mangoporn.net
// Extractors: DoodStream, Filemoon, LuluStream, Player4Me, VidNest, MixDrop, Vue, Upns, FilmCDN

const cheerio = require("cheerio-without-node-native");
const CryptoJS = require("crypto-js");

// ── Constants ─────────────────────────────────────────────────────────────────
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://mangoporn.net";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Blocked keywords ──────────────────────────────────────────────────────────
const BLOCKED_WORDS = [
  "gay","homosexual","queer","homo","androphile","femboy","feminine boy","effeminate",
  "trap","scat","trans","Trade","Vers","Twink","Otter","Bear","Femme","Masc",
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

// ── JS Unpacker ───────────────────────────────────────────────────────────────
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

// ── TMDB (with year) ──────────────────────────────────────────────────────────
function getTmdbInfo(tmdbId, mediaType) {
  var url = "https://api.themoviedb.org/3/" + mediaType + "/" + tmdbId
          + "?api_key=" + TMDB_API_KEY + "&language=en-US";
  return fetch(url, { headers: { "User-Agent": UA } })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) {
      if (!d) return null;
      var title = d.title || d.name || null;
      var year = d.release_date ? d.release_date.substring(0,4)
               : d.first_air_date ? d.first_air_date.substring(0,4) : null;
      return { title: title, year: year };
    })
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
    .catch(function(e) { console.log("[Mangoporn] DoodStream error: " + e.message); return null; });
}

// ── Extractor: Filemoon ───────────────────────────────────────────────────────
function extractFilemoon(url) {
  var host = new URL(url).origin;
  return fetchText(url, { Referer: BASE_URL + "/", Origin: host })
    .then(function(html) {
      var $ = cheerio.load(html);
      var fileUrl = findInScripts($, function(unpacked) {
        var m = unpacked.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (!m) m = unpacked.match(/["']file["']\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        return m ? m[1] : null;
      });
      if (!fileUrl) return null;
      return [{ name: "Filemoon", title: "Filemoon", url: fileUrl, quality: "auto",
                headers: { Referer: host + "/", Origin: host } }];
    })
    .catch(function(e) { console.log("[Mangoporn] Filemoon error: " + e.message); return null; });
}

// ── Extractor: LuluStream (FIXED with unpacker) ──────────────────────────────
function extractLuluStream(url) {
  var host = new URL(url).origin;
  var embedUrl = url;
  if (url.includes("/d/")) embedUrl = url.replace("/d/", "/e/");
  else if (url.includes("/f/")) embedUrl = url.replace("/f/", "/e/");

  return fetchText(embedUrl, { Referer: BASE_URL + "/", Origin: host })
    .then(function(html) {
      var $ = cheerio.load(html);
      var fileUrl = findInScripts($, function(unpacked) {
        var m = unpacked.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
        if (!m) m = unpacked.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
        if (!m) m = unpacked.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
        return m ? m[1] : null;
      });
      if (!fileUrl) {
        // Fallback: direct regex on html
        var fm = html.match(/["']([^"']+\.m3u8[^"']*)["']/);
        if (fm) fileUrl = fm[1];
      }
      if (!fileUrl) return null;
      return [{ name: "LuluStream", title: "LuluStream", url: fileUrl, quality: "auto",
                headers: { Referer: embedUrl, Origin: host, "User-Agent": UA } }];
    })
    .catch(function(e) { console.log("[Mangoporn] LuluStream error: " + e.message); return null; });
}

// ── Extractor: VidNest ────────────────────────────────────────────────────────
function extractVidNest(url) {
  var host = new URL(url).origin;
  return fetchText(url, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var $ = cheerio.load(html);
      var fileUrl = findInScripts($, function(unpacked) {
        var m = unpacked.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (!m) m = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        return m ? m[1] : null;
      });
      if (!fileUrl) return null;
      return [{ name: "VidNest", title: "VidNest", url: fileUrl, quality: "auto",
                headers: { Referer: host + "/", Origin: host } }];
    })
    .catch(function(e) { console.log("[Mangoporn] VidNest error: " + e.message); return null; });
}

// ── Extractor: Player4Me (FIXED host list + ID extraction) ───────────────────
function extractPlayer4Me(url) {
  var urlObj = new URL(url);
  var host = urlObj.origin;
  var id = url.split("#")[1] || url.split("/").pop().split("?")[0];
  return fetchText(host + "/api/v1/video?id=" + id, {
    Host: urlObj.host, Accept: "*/*", Cookie: "popunderCount/=1", Referer: host + "/"
  })
  .then(function(raw) {
    raw = raw.trim();
    if (!raw || raw.charAt(0) === "<") return null;
    try {
      var key = CryptoJS.enc.Utf8.parse("kiemtienmua911ca");
      var iv  = CryptoJS.enc.Utf8.parse("1234567890oiuytr");
      var dec = CryptoJS.AES.decrypt(raw, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      var data = JSON.parse(dec.toString(CryptoJS.enc.Utf8));
      var videoUrl = data.source || data.hls || data.cf || (data.sources && data.sources[0] && data.sources[0].file);
      if (!videoUrl) return null;
      return [{ name: "Player4Me", title: "Player4Me", url: videoUrl, quality: "auto",
                headers: { "User-Agent": UA, Referer: host + "/" } }];
    } catch(e) {
      console.log("[Mangoporn] Player4Me decrypt error: " + e.message);
      return null;
    }
  })
  .catch(function(e) { console.log("[Mangoporn] Player4Me error: " + e.message); return null; });
}

// ── Extractor: MixDrop (NEW) ─────────────────────────────────────────────────
function extractMixdrop(url) {
  var embedUrl = url;
  if (url.includes("/f/")) embedUrl = url.replace("/f/", "/e/");
  var host = new URL(embedUrl).origin;
  return fetchText(embedUrl, {
    Referer: host + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
  })
    .then(function(html) {
      var $ = cheerio.load(html);
      var fileUrl = findInScripts($, function(unpacked) {
        var m = unpacked.match(/MDCore\.\w+\s*=\s*["']([^"']+)["']/);
        if (!m) m = unpacked.match(/(?:var\s+)?\b(wurl|vurl|surl|href)\s*=\s*["']([^"']+)["']/);
        if (!m) m = unpacked.match(/src\s*:\s*["']([^"']+\.mp4[^"']*)["']/);
        if (!m) m = unpacked.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/);
        if (!m) return null;
        var v = m[1] || m[2];
        // Decode base64 if looks like it
        if (v && v.match(/^[A-Za-z0-9+/=]{20,}$/)) {
          try { v = atob(v); } catch(e) {}
        }
        if (v && v.startsWith("//")) v = "https:" + v;
        if (v && !v.startsWith("http")) v = host + (v.startsWith("/") ? "" : "/") + v;
        return v;
      });
      if (!fileUrl) return null;
      return [{ name: "MixDrop", title: "MixDrop", url: fileUrl, quality: "auto",
                headers: { "User-Agent": UA, Referer: host + "/" } }];
    })
    .catch(function(e) { console.log("[Mangoporn] MixDrop error: " + e.message); return null; });
}

// ── Extractor: Vue (NEW) ─────────────────────────────────────────────────────
function extractVue(url) {
  var host = new URL(url).origin;
  return fetchText(url, {
    Referer: host + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  })
    .then(function(html) {
      var $ = cheerio.load(html);
      var fileUrl = findInScripts($, function(unpacked) {
        var m = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (!m) m = unpacked.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (!m) m = unpacked.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (!m) m = unpacked.match(/src\s*=\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        return m ? m[1] : null;
      });
      if (!fileUrl) return null;
      return [{ name: "Vue", title: "Vue", url: fileUrl, quality: "auto",
                headers: { "User-Agent": UA, Referer: host + "/" } }];
    })
    .catch(function(e) { console.log("[Mangoporn] Vue error: " + e.message); return null; });
}

// ── Extractor: Upns (NEW) ────────────────────────────────────────────────────
function extractUpns(url) {
  var host = new URL(url).origin;
  return fetchText(url, {
    Referer: host + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  })
    .then(function(html) {
      var $ = cheerio.load(html);
      var fileUrl = findInScripts($, function(unpacked) {
        var m = unpacked.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/);
        if (!m) m = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (!m) m = unpacked.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        return m ? m[1] : null;
      });
      if (!fileUrl) return null;
      return [{ name: "Upns", title: "Upns", url: fileUrl, quality: "auto",
                headers: { "User-Agent": UA, Referer: host + "/" } }];
    })
    .catch(function(e) { console.log("[Mangoporn] Upns error: " + e.message); return null; });
}

// ── Extractor: FilmCDN (NEW - ported from Kotlin) ────────────────────────────
function extractFilmcdn(url, referer) {
  var host = "";
  try { host = new URL(url).origin; } catch(e) { return Promise.resolve(null); }
  var embedUrl = url;
  if (url.includes("/d/")) embedUrl = url.replace("/d/", "/v/");
  else if (url.includes("/download/")) embedUrl = url.replace("/download/", "/v/");
  else if (url.includes("/file/")) embedUrl = url.replace("/file/", "/v/");
  else if (url.includes("/f/")) embedUrl = url.replace("/f/", "/v/");

  return fetchText(embedUrl, {
    Referer: referer || host + "/",
    Origin: host,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site"
  })
    .then(function(html) {
      var script = html;
      var packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?<\/script>/);
      if (packedMatch) {
        var unpacked = unpackPacked(packedMatch[0]);
        if (unpacked.indexOf("var links") !== -1) {
          unpacked = unpacked.substring(unpacked.indexOf("var links"));
        }
        script = unpacked;
      } else {
        var sm = html.match(/<script[^>]*>([\s\S]*?sources:[\s\S]*?)<\/script>/);
        if (sm) script = sm[1];
      }
      if (!script) return null;

      var streams = [];
      var regex = /:\s*"(.*?m3u8.*?)"/g;
      var match;
      while ((match = regex.exec(script)) !== null) {
        var m3u8Url = match[1];
        if (m3u8Url.startsWith("http")) {
          streams.push({
            name: "FilmCDN",
            title: "FilmCDN",
            url: m3u8Url,
            quality: "auto",
            headers: {
              "User-Agent": UA,
              Referer: referer || host + "/",
              Origin: host,
              "Sec-Fetch-Dest": "empty",
              "Sec-Fetch-Mode": "cors",
              "Sec-Fetch-Site": "cross-site"
            }
          });
        }
      }
      return streams.length ? streams : null;
    })
    .catch(function(e) { console.log("[Mangoporn] FilmCDN error: " + e.message); return null; });
}

// ── Host routing ──────────────────────────────────────────────────────────────
var DOOD_HOSTS     = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm","dooood.com","do0od.com","playmogo.com"];
var FILEMOON_HOSTS = ["filemoon.to","filemoon.in","filemoon.sx","filemoon.nl","filemoon.art","javmoon.me","bysedikamoum.com","bysezoxexe.com","x08.ovh"];
var LULU_HOSTS     = ["lulustream.com","luluvid.com","luluvdo.com","luluvdoo.com","lulupvp.com","lulu.dlc.ovh","lulu0.ovh","ludwigurl.com","lulu.sx","luluscam.com"];
var VIDNEST_HOSTS  = ["vidnest.io","vidnest.app","vidnest.xyz","vidnest.lol","vidnest.fun"];
var PLAYER4_HOSTS  = ["player4me.online","player4me.vip","rpmplay.online","player4me.xyz","player4me.cc","play4me.online","play4me.vip","p4me.xyz","p4mplay.xyz"];
var MIXDROP_HOSTS  = ["mixdrop.ag","mixdrop.my","mixdrop.is","mixdrop.co","mixdrop.ch","mixdrop.to","mixdrop.club","mixdrop.sx"];
var VUE_HOSTS      = ["vue.to","vue.tv","vueplayer.xyz","vueplay.xyz","vue.watch"];
var UPNS_HOSTS     = ["upns.xyz","upns.live","upns.cc","upns.to","upns.click"];
var FILMCDN_HOSTS  = ["filmcdm.top","filmcdn.xyz","filmcdn.top"];

function extractFromUrl(url, referer) {
  if (DOOD_HOSTS.some(function(h){ return url.includes(h); }))     return extractDoodStream(url);
  if (FILEMOON_HOSTS.some(function(h){ return url.includes(h); })) return extractFilemoon(url);
  if (LULU_HOSTS.some(function(h){ return url.includes(h); }))     return extractLuluStream(url);
  if (VIDNEST_HOSTS.some(function(h){ return url.includes(h); }))  return extractVidNest(url);
  if (PLAYER4_HOSTS.some(function(h){ return url.includes(h); }))  return extractPlayer4Me(url);
  if (MIXDROP_HOSTS.some(function(h){ return url.includes(h); }))  return extractMixdrop(url);
  if (VUE_HOSTS.some(function(h){ return url.includes(h); }))      return extractVue(url);
  if (UPNS_HOSTS.some(function(h){ return url.includes(h); }))     return extractUpns(url);
  if (FILMCDN_HOSTS.some(function(h){ return url.includes(h); }))  return extractFilmcdn(url, referer);
  return extractGeneric(url);
}

// Generic fallback
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

// ── Site scraping ─────────────────────────────────────────────────────────────
function searchSite(query, year) {
  return fetchText(BASE_URL + "/page/1/?s=" + encodeURIComponent(query))
    .then(function(html) {
      var $ = cheerio.load(html);
      var results = [];
      $("article").each(function(_, el) {
        var title = $(el).find("div.details a").first().text().trim();
        var href  = fixUrl($(el).find("div.image a").first().attr("href"));
        if (title && href && !isBlocked(title)) {
          // Strict matching: title must contain query words
          var lowerTitle = title.toLowerCase();
          var lowerQuery = query.toLowerCase();
          var queryWords = lowerQuery.split(/\s+/).filter(function(w){ return w.length > 2; });
          var matchCount = 0;
          queryWords.forEach(function(w){ if (lowerTitle.indexOf(w) !== -1) matchCount++; });
          var matchRatio = queryWords.length > 0 ? matchCount / queryWords.length : 0;

          // Year filtering if available
          var titleYear = title.match(/\b(19\d{2}|20\d{2})\b/);
          var yearMatch = !year || !titleYear || titleYear[1] === String(year);

          if (matchRatio >= 0.5 && yearMatch) {
            results.push({ title: title, href: href });
          }
        }
      });
      console.log("[Mangoporn] search '" + query + "' -> " + results.length + " results");
      return results;
    });
}

function getVideoLinks(pageUrl) {
  return fetchText(pageUrl, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var $ = cheerio.load(html);
      var links = [];
      $("div#pettabs > ul a").each(function(_, el) {
        var href = fixUrl($(el).attr("href"), pageUrl);
        if (href) links.push(href);
      });
      console.log("[Mangoporn] video links: " + links.join(" | "));
      return links;
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {
  console.log("[Mangoporn] tmdbId=" + tmdbId + " type=" + mediaType);
  return getTmdbInfo(tmdbId, mediaType)
    .then(function(info) {
      if (!info || !info.title) { console.log("[Mangoporn] no TMDB title"); return []; }
      console.log("[Mangoporn] title=" + info.title + " year=" + info.year);
      return searchSite(info.title, info.year);
    })
    .then(function(results) {
      if (!results || !results.length) return [];
      var chain = Promise.resolve([]);
      results.slice(0, 3).forEach(function(result) {
        chain = chain.then(function(streams) {
          if (streams.length) return streams;
          return getVideoLinks(result.href)
            .then(function(links) {
              return Promise.all(links.map(function(link) { return extractFromUrl(link, result.href); }));
            })
            .then(function(extracted) {
              var found = [];
              extracted.forEach(function(items) {
                if (items) items.forEach(function(s) {
                  found.push(Object.assign({}, s, { title: "[Mangoporn] " + s.title }));
                });
              });
              return found;
            });
        });
      });
      return chain;
    })
    .catch(function(e) {
      console.error("[Mangoporn] Error: " + e.message);
      return [];
    });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
