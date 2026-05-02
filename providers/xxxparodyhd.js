"use strict";
var cheerio = require("cheerio-without-node-native");

// ── Helpers ──────────────────────────────────────────────────────────────────

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";
var BASE_URL = "https://xxxparodyhd.net";

function fixUrl(href, base) {
  if (!href) return null;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) return "https:" + href;
  if (href.startsWith("/")) return (base || BASE_URL) + href;
  return (base || BASE_URL) + "/" + href;
}

async function fetchText(url, headers) {
  var res = await fetch(url, {
    headers: Object.assign({ "User-Agent": UA }, headers || {})
  });
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return res.text();
}

// ── Filter ────────────────────────────────────────────────────────────────────

var BLOCKED = ["gay","homosexual","queer","homo","androphile","femboy","feminine boy","effeminate","trap","trans","Trade","Vers","Twink","Otter","Bear","Femme","Masc","Pegging","Femdom","futa","tranny","crossdress","Bisexual","Intersex","LGBTQ","tgirl","t-girl","Transsexual","TS","TGirl","T-Boy"];
var BLOCKED_RE = new RegExp("(?:" + BLOCKED.map(function(w){ return w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }).join("|") + ")", "i");
function isBlocked(t) { return BLOCKED_RE.test(t); }

// ── TMDB ──────────────────────────────────────────────────────────────────────

async function getTmdbTitle(tmdbId, mediaType) {
  try {
    var token = (typeof process !== "undefined" && process.env && process.env.TMDB_READ_TOKEN) || "";
    var res = await fetch("https://api.themoviedb.org/3/" + mediaType + "/" + tmdbId + "?language=en-US", {
      headers: token ? { Authorization: "Bearer " + token } : {}
    });
    if (!res.ok) return null;
    var d = await res.json();
    return d.title || d.name || null;
  } catch (e) { return null; }
}

// ── Extractors ───────────────────────────────────────────────────────────────

async function extractDoodStream(url) {
  try {
    var embedUrl = url.replace("doply.net", "myvidplay.com");
    var refHost = "https://myvidplay.com";
    var html = await fetchText(embedUrl, { Referer: refHost });
    var m = html.match(/\/pass_md5\/([^/]*)\/([^/']*)/);
    if (!m) return null;
    var fullPath = m[0], expiry = m[1], token = m[2];
    var base = (await fetchText(refHost + fullPath, { Referer: embedUrl })).trim();
    var directUrl = (token && expiry) ? (base + "?token=" + token + "&expiry=" + expiry + "000") : base;
    return [{ name: "DoodStream", title: "DoodStream", url: directUrl, quality: "auto",
              headers: { "User-Agent": UA, Referer: refHost } }];
  } catch (e) { return null; }
}

// Streamwish / Javsw / Streamhihi / swhoi
// Kotlin: script:containsData("sources") → file:"(.*?)"
async function extractStreamwish(url) {
  try {
    var html = await fetchText(url, { Referer: BASE_URL + "/" });
    var $ = cheerio.load(html);
    var script = "";
    $("script").each(function(_, el) {
      var s = $(el).html() || "";
      if (s.indexOf("sources") !== -1) { script = s; return false; }
    });
    var m = script.match(/file\s*:\s*"([^"]+)"/);
    if (!m) return null;
    return [{ name: "Streamwish", title: "Streamwish", url: m[1], quality: "auto",
              headers: { "User-Agent": UA, Referer: url } }];
  } catch (e) { return null; }
}

// Vidhidepro / VidhideVIP / Javlion
// Kotlin: sources:.[file:"(.*)".* in script:containsData("sources")
async function extractVidhidepro(url) {
  try {
    var html = await fetchText(url, { Referer: BASE_URL + "/" });
    var $ = cheerio.load(html);
    var script = "";
    $("script").each(function(_, el) {
      var s = $(el).html() || "";
      if (s.indexOf("sources") !== -1) { script = s; return false; }
    });
    var m = script.match(/sources\s*:\s*\[[\s\S]*?file\s*:\s*"([^"]+\.m3u8[^"]*)"/);
    if (!m) return null;
    return [{ name: "Vidhidepro", title: "Vidhidepro", url: m[1], quality: "auto",
              headers: { Referer: new URL(url).origin + "/", "User-Agent": UA } }];
  } catch (e) { return null; }
}

// Javggvideo: substringAfter("var urlPlay = '").substringBefore("';")
async function extractJavggvideo(url) {
  try {
    var html = await fetchText(url, { Referer: BASE_URL + "/" });
    var m = html.match(/var urlPlay\s*=\s*'([^']+)'/);
    if (!m) return null;
    return [{ name: "Javggvideo", title: "Javggvideo", url: m[1], quality: "auto",
              headers: { "User-Agent": UA } }];
  } catch (e) { return null; }
}

// Javclan: script:containsData("sources") → file:"(.*?)"
async function extractJavclan(url, referer) {
  try {
    var html = await fetchText(url, { Referer: referer || BASE_URL + "/" });
    var $ = cheerio.load(html);
    var script = "";
    $("script").each(function(_, el) {
      var s = $(el).html() || "";
      if (s.indexOf("sources") !== -1) { script = s; return false; }
    });
    var m = script.match(/file\s*:\s*"([^"]+)"/);
    if (!m) return null;
    return [{ name: "Javclan", title: "Javclan", url: m[1], quality: "auto",
              headers: { Referer: referer || BASE_URL + "/", "User-Agent": UA } }];
  } catch (e) { return null; }
}

// Mixdrop
async function extractMixdrop(url) {
  try {
    var html = await fetchText(url, { Referer: BASE_URL + "/" });
    var m = html.match(/(?:vsr|wurl|surl)\s*=\s*"([^"]+)"/);
    if (!m) return null;
    var videoUrl = m[1].startsWith("//") ? "https:" + m[1] : m[1];
    return [{ name: "MixDrop", title: "MixDrop", url: videoUrl, quality: "auto",
              headers: { "User-Agent": UA } }];
  } catch (e) { return null; }
}

var DOOD_HOSTS      = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm"];
var STREAMWISH_HOSTS = ["streamwish.to","streamhihi.com","javsw.me","swhoi.com"];
var VIDHIDE_HOSTS   = ["vidhidepro.com","vidhidevip.com","javlion.xyz"];
var MIXDROP_HOSTS   = ["mixdrop.ag","mixdrop.my","mixdrop.is"];

async function extractFromUrl(url, referer) {
  if (DOOD_HOSTS.some(function(h){ return url.includes(h); }))       return extractDoodStream(url);
  if (STREAMWISH_HOSTS.some(function(h){ return url.includes(h); })) return extractStreamwish(url);
  if (VIDHIDE_HOSTS.some(function(h){ return url.includes(h); }))    return extractVidhidepro(url);
  if (url.includes("javggvideo.xyz"))                                 return extractJavggvideo(url);
  if (url.includes("javclan.com"))                                    return extractJavclan(url, referer);
  if (MIXDROP_HOSTS.some(function(h){ return url.includes(h); }))    return extractMixdrop(url);
  return null;
}

// ── Site scraping ─────────────────────────────────────────────────────────────

// Kotlin: app.get("${mainUrl}/search/${query}") → div.movies-list div.ml-item → h2, a
async function searchSite(query) {
  var html = await fetchText(BASE_URL + "/search/" + encodeURIComponent(query));
  var $ = cheerio.load(html);
  var results = [];
  $("div.movies-list div.ml-item").each(function(_, el) {
    var title = $(el).find("h2").first().text().trim();
    var href  = fixUrl($(el).find("a").first().attr("href"));
    if (title && href && !isBlocked(title)) results.push({ title: title, href: href });
  });
  return results;
}

// Kotlin: document.select("div.Rtable1 a#\\#iframe") — id attribute value is literally "#iframe"
async function getVideoLinks(pageUrl) {
  var html = await fetchText(pageUrl, { Referer: BASE_URL + "/" });
  var $ = cheerio.load(html);
  var links = [];
  $("div.Rtable1 a").each(function(_, el) {
    var elId   = $(el).attr("id");
    var href   = $(el).attr("href");
    // id attribute value is literally "#iframe" (with the hash)
    if (elId === "#iframe" && href) links.push(fixUrl(href, pageUrl));
  });
  return links;
}

// ── getStreams ────────────────────────────────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    console.log("[XXXParodyHD] tmdbId=" + tmdbId + " type=" + mediaType);
    var title = await getTmdbTitle(tmdbId, mediaType);
    if (!title) { console.log("[XXXParodyHD] No TMDB title"); return []; }
    console.log("[XXXParodyHD] searching: " + title);

    var results = await searchSite(title);
    console.log("[XXXParodyHD] results: " + results.length);
    if (!results.length) return [];

    var streams = [];
    for (var i = 0; i < Math.min(results.length, 3); i++) {
      var links = await getVideoLinks(results[i].href);
      console.log("[XXXParodyHD] video links: " + links.join(", "));
      for (var j = 0; j < links.length; j++) {
        var extracted = await extractFromUrl(links[j], BASE_URL + "/");
        if (extracted) {
          for (var k = 0; k < extracted.length; k++) {
            streams.push(Object.assign({}, extracted[k], { title: "[XXXParodyHD] " + extracted[k].title }));
          }
        }
      }
      if (streams.length) break;
    }
    return streams;
  } catch (e) {
    console.error("[XXXParodyHD] Error: " + e.message);
    return [];
  }
}

module.exports = { getStreams: getStreams };
