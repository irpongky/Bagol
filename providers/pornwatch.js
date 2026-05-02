// PornWatch Provider for Nuvio
// Site: pornwatch.ws
// Extractors: DoodStream, Player4Me

const cheerio = require("cheerio-without-node-native");

// ── Constants ─────────────────────────────────────────────────────────────────
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://pornwatch.ws";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";

// ── Blocked keywords (from original Kotlin filter) ───────────────────────────
const BLOCKED_WORDS = [
  "gay","homosexual","queer","homo","androphile","femboy","feminine boy","effeminate",
  "trap","trans","Trade","Vers","Twink","Otter","Bear","Femme","Masc",
  "Pegging","Anal Gape","Femdom","futa","strap-on","strapon","tranny","tribute",
  "crossdress","tgirl","t-girl","Bisexual","Intersex","LGBTQ","Trans","TS","TGirl","T-Boy","Transsexual"
];
const BLOCKED_RE = new RegExp(
  "(?:" + BLOCKED_WORDS.map(function(w){ return w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }).join("|") + ")",
  "i"
);
function isBlocked(title) { return BLOCKED_RE.test(title); }

// ── HTTP ──────────────────────────────────────────────────────────────────────
function fetchText(url, extraHeaders) {
  return fetch(url, {
    headers: Object.assign({ "User-Agent": UA }, extraHeaders || {})
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

// ── TMDB ──────────────────────────────────────────────────────────────────────
function getTmdbTitle(tmdbId, mediaType) {
  var url = "https://api.themoviedb.org/3/" + mediaType + "/" + tmdbId
          + "?api_key=" + TMDB_API_KEY + "&language=en-US";
  return fetch(url)
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) { return d ? (d.title || d.name || null) : null; })
    .catch(function() { return null; });
}

// ── Extractors ────────────────────────────────────────────────────────────────

function extractDoodStream(url) {
  var embedUrl = url.replace("doply.net", "myvidplay.com");
  var refHost = "https://myvidplay.com";
  return fetchText(embedUrl, { Referer: refHost })
    .then(function(html) {
      var m = html.match(/\/pass_md5\/([^/]*)\/([^/']*)/);
      if (!m) return null;
      var fullPath = m[0], expiry = m[1], token = m[2];
      return fetchText(refHost + fullPath, { Referer: embedUrl })
        .then(function(base) {
          base = base.trim();
          var directUrl = (token && expiry) ? base + "?token=" + token + "&expiry=" + expiry + "000" : base;
          return [{ name: "DoodStream", title: "DoodStream", url: directUrl, quality: "auto",
                    headers: { "User-Agent": UA, Referer: refHost } }];
        });
    })
    .catch(function() { return null; });
}

function b64ToBytes(str) {
  var b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  var pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return Uint8Array.from(atob(b64 + pad), function(c){ return c.charCodeAt(0); });
}

// Player4Me: AES-CBC decrypt, key "kiemtienmua911ca", iv "1234567890oiuytr"
// mainUrl variants: my.player4me.online, vip.player4me.vip, my.rpmplay.online
function extractPlayer4Me(url) {
  var urlObj = new URL(url);
  var mainUrl = urlObj.origin;
  var id = url.indexOf("#") !== -1 ? url.split("#")[1] : urlObj.pathname.split("/").pop();
  return fetchText(mainUrl + "/api/v1/video?id=" + id, {
    Host: urlObj.host, Accept: "*/*", Cookie: "popunderCount/=1", Referer: mainUrl + "/"
  })
  .then(function(raw) {
    raw = raw.trim();
    if (!raw || raw.startsWith("<html>")) return null;
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode("kiemtienmua911ca"), { name: "AES-CBC" }, false, ["decrypt"])
      .then(function(key) {
        return crypto.subtle.decrypt({ name: "AES-CBC", iv: enc.encode("1234567890oiuytr") }, key, b64ToBytes(raw));
      })
      .then(function(dec) {
        var data = JSON.parse(new TextDecoder().decode(dec));
        var videoUrl = data.source || data.hls || data.cf;
        if (!videoUrl) return null;
        return [{ name: "Player4Me", title: "Player4Me", url: videoUrl, quality: "auto",
                  headers: { "User-Agent": UA, Referer: mainUrl + "/" } }];
      });
  })
  .catch(function() { return null; });
}

// ── Host routing ──────────────────────────────────────────────────────────────
var DOOD_HOSTS    = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm","playmogo.com"];
var PLAYER4_HOSTS = ["player4me.online","player4me.vip","rpmplay.online"];

function extractFromUrl(url) {
  if (DOOD_HOSTS.some(function(h){ return url.includes(h); }))    return extractDoodStream(url);
  if (PLAYER4_HOSTS.some(function(h){ return url.includes(h); })) return extractPlayer4Me(url);
  return Promise.resolve(null);
}

// ── Site scraping ─────────────────────────────────────────────────────────────
// Search: /?s=query → div.ml-item → h2 (title), a (href)
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

// loadLinks: div#pettabs → div.Rtable1-cell a (href)
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
