// XXXParodyHD Provider for Nuvio
// Site: xxxparodyhd.net
// Extractors: DoodStream, Streamwish, Vidhidepro, Javggvideo, Javclan, MixDrop

const cheerio = require("cheerio-without-node-native");

// ── Constants ─────────────────────────────────────────────────────────────────
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://xxxparodyhd.net";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";

// ── Blocked keywords ──────────────────────────────────────────────────────────
const BLOCKED_WORDS = [
  "gay","homosexual","queer","homo","androphile","femboy","feminine boy","effeminate",
  "trap","trans","Trade","Vers","Twink","Otter","Bear","Femme","Masc",
  "Pegging","Femdom","futa","tranny","crossdress","Bisexual","Intersex","LGBTQ",
  "tgirl","t-girl","Transsexual","TS","TGirl","T-Boy"
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

// Streamwish / Javsw / Streamhihi / swhoi
// Kotlin: script:containsData("sources") → file:"(.*?)"
function extractStreamwish(url) {
  return fetchText(url, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var $ = cheerio.load(html);
      var script = "";
      $("script").each(function(_, el) {
        var s = $(el).html() || "";
        if (s.indexOf("sources") !== -1 && s.indexOf("file") !== -1) { script = s; return false; }
      });
      var m = script.match(/file\s*:\s*"([^"]+)"/);
      if (!m) return null;
      return [{ name: "Streamwish", title: "Streamwish", url: m[1], quality: "auto",
                headers: { "User-Agent": UA, Referer: url } }];
    })
    .catch(function() { return null; });
}

// Vidhidepro / VidhideVIP / Javlion
// Kotlin: sources:.[file:"(.*)".* in script:containsData("sources")
function extractVidhidepro(url) {
  return fetchText(url, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var $ = cheerio.load(html);
      var script = "";
      $("script").each(function(_, el) {
        var s = $(el).html() || "";
        if (s.indexOf("sources") !== -1 && s.indexOf("file") !== -1) { script = s; return false; }
      });
      var m = script.match(/sources\s*:\s*\[[\s\S]*?file\s*:\s*"([^"]+\.m3u8[^"]*)"/);
      if (!m) return null;
      return [{ name: "Vidhidepro", title: "Vidhidepro", url: m[1], quality: "auto",
                headers: { Referer: new URL(url).origin + "/", "User-Agent": UA } }];
    })
    .catch(function() { return null; });
}

// Javggvideo: substringAfter("var urlPlay = '").substringBefore("';")
function extractJavggvideo(url) {
  return fetchText(url, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var m = html.match(/var urlPlay\s*=\s*'([^']+)'/);
      if (!m) return null;
      return [{ name: "Javggvideo", title: "Javggvideo", url: m[1], quality: "auto",
                headers: { "User-Agent": UA } }];
    })
    .catch(function() { return null; });
}

// Javclan: script:containsData("sources") → file:"(.*?)"
function extractJavclan(url, referer) {
  return fetchText(url, { Referer: referer || BASE_URL + "/" })
    .then(function(html) {
      var $ = cheerio.load(html);
      var script = "";
      $("script").each(function(_, el) {
        var s = $(el).html() || "";
        if (s.indexOf("sources") !== -1 && s.indexOf("file") !== -1) { script = s; return false; }
      });
      var m = script.match(/file\s*:\s*"([^"]+)"/);
      if (!m) return null;
      return [{ name: "Javclan", title: "Javclan", url: m[1], quality: "auto",
                headers: { Referer: referer || BASE_URL + "/", "User-Agent": UA } }];
    })
    .catch(function() { return null; });
}

// MixDrop
function extractMixdrop(url) {
  return fetchText(url, { Referer: BASE_URL + "/" })
    .then(function(html) {
      var m = html.match(/(?:vsr|wurl|surl)\s*=\s*"([^"]+)"/);
      if (!m) return null;
      var videoUrl = m[1].startsWith("//") ? "https:" + m[1] : m[1];
      return [{ name: "MixDrop", title: "MixDrop", url: videoUrl, quality: "auto",
                headers: { "User-Agent": UA } }];
    })
    .catch(function() { return null; });
}

// ── Host routing ──────────────────────────────────────────────────────────────
var DOOD_HOSTS      = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm"];
var STREAMWISH_HOSTS = ["streamwish.to","streamhihi.com","javsw.me","swhoi.com"];
var VIDHIDE_HOSTS   = ["vidhidepro.com","vidhidevip.com","javlion.xyz"];
var MIXDROP_HOSTS   = ["mixdrop.ag","mixdrop.my","mixdrop.is"];

function extractFromUrl(url, referer) {
  if (DOOD_HOSTS.some(function(h){ return url.includes(h); }))       return extractDoodStream(url);
  if (STREAMWISH_HOSTS.some(function(h){ return url.includes(h); })) return extractStreamwish(url);
  if (VIDHIDE_HOSTS.some(function(h){ return url.includes(h); }))    return extractVidhidepro(url);
  if (url.includes("javggvideo.xyz"))                                 return extractJavggvideo(url);
  if (url.includes("javclan.com"))                                    return extractJavclan(url, referer);
  if (MIXDROP_HOSTS.some(function(h){ return url.includes(h); }))    return extractMixdrop(url);
  return Promise.resolve(null);
}

// ── Site scraping ─────────────────────────────────────────────────────────────
// Search: /search/query → div.movies-list div.ml-item → h2 (title), a (href)
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
              return Promise.all(links.map(function(link) {
                return extractFromUrl(link, BASE_URL + "/");
              }));
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
