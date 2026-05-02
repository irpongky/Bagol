// PornWatch Provider for Nuvio
// Site: pornwatch.ws
// Extractors: DoodStream, Player4Me

const cheerio = require("cheerio-without-node-native");
const CryptoJS = require("crypto-js");

// ── Constants ─────────────────────────────────────────────────────────────────
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://pornwatch.ws";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Blocked keywords ──────────────────────────────────────────────────────────
const BLOCKED_WORDS = [
  "gay","homosexual","queer","homo","androphile","femboy","feminine boy","effeminate",
  "trap","trans","Trade","Vers","Twink","Otter","Bear","Femme","Masc",
  "Pegging","Anal Gape","Femdom","futa","strap-on","strapon","tranny","tribute",
  "crossdress","tgirl","t-girl","Bisexual","Intersex","LGBTQ","Trans","TS","TGirl","T-Boy","Transsexual"
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
    .catch(function(e) { console.log("[PornWatch] DoodStream error: " + e.message); return null; });
}

// ── Extractor: Player4Me ──────────────────────────────────────────────────────
// AES-CBC key="kiemtienmua911ca" iv="1234567890oiuytr"
function extractPlayer4Me(url) {
  var urlObj = new URL(url);
  var host = urlObj.origin;
  var id = url.indexOf("#") !== -1 ? url.split("#")[1]
          : urlObj.pathname.replace(/\//g,"").split("?")[0];
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
      console.log("[PornWatch] Player4Me decrypt error: " + e.message);
      return null;
    }
  })
  .catch(function(e) { console.log("[PornWatch] Player4Me error: " + e.message); return null; });
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
var DOOD_HOSTS    = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm","dooood.com","do0od.com","playmogo.com","easyvidplayer.com"];
var PLAYER4_HOSTS = ["player4me.online","player4me.vip","rpmplay.online","my.player4me","vip.player4me"];
var UPNS_HOSTS    = ["upns.online","my.upns.online","seekplayer.vip","embedseek.online"];

function extractFromUrl(url) {
  if (DOOD_HOSTS.some(function(h){ return url.includes(h); }))    return extractDoodStream(url);
  if (UPNS_HOSTS.some(function(h){ return url.includes(h); }))    return extractPlayer4Me(url); // UPNS = same API
  if (PLAYER4_HOSTS.some(function(h){ return url.includes(h); })) return extractPlayer4Me(url);
  return extractGeneric(url);
}

// ── Site scraping ─────────────────────────────────────────────────────────────
function searchSite(query) {
  return fetchText(BASE_URL + "/?s=" + encodeURIComponent(query))
    .then(function(html) {
      var $ = cheerio.load(html);
      var results = [];
      $("div.ml-item").each(function(_, el) {
        var title = $(el).find("h2").first().text().trim();
        var href  = fixUrl($(el).find("a").first().attr("href"));
        if (title && href && !isBlocked(title)) results.push({ title: title, href: href });
      });
      console.log("[PornWatch] search '" + query + "' -> " + results.length + " results");
      return results;
    });
}

function getVideoLinks(pageUrl) {
  return fetchText(pageUrl, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var $ = cheerio.load(html);
      var links = [];
      $("#pettabs").find(".Rtable1-cell a").each(function(_, el) {
        var href = fixUrl($(el).attr("href"), pageUrl);
        if (href) links.push(href);
      });
      console.log("[PornWatch] video links: " + links.join(" | "));
      return links;
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {
  console.log("[PornWatch] tmdbId=" + tmdbId + " type=" + mediaType);
  return getTmdbTitle(tmdbId, mediaType)
    .then(function(title) {
      if (!title) { console.log("[PornWatch] no TMDB title"); return []; }
      console.log("[PornWatch] title=" + title);
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
                  found.push(Object.assign({}, s, { title: "[PornWatch] " + s.title }));
                });
              });
              return found;
            });
        });
      });
      return chain;
    })
    .catch(function(e) {
      console.error("[PornWatch] Error: " + e.message);
      return [];
    });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
