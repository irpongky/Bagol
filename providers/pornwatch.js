"use strict";
var cheerio = require("cheerio-without-node-native");

// ── Helpers ──────────────────────────────────────────────────────────────────

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";
var BASE_URL = "https://pornwatch.ws";

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

var BLOCKED = ["gay","homosexual","queer","homo","androphile","femboy","feminine boy","effeminate","trap","trans","Trade","Vers","Twink","Otter","Bear","Femme","Masc","Pegging","Anal Gape","Femdom","futa","strap-on","strapon","tranny","tribute","crossdress","tgirl","t-girl","Bisexual","Intersex","LGBTQ","Trans","TS","TGirl","T-Boy","Transsexual"];
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

function b64ToBytes(str) {
  var b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  var padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), function(c){ return c.charCodeAt(0); });
}

// Player4Me: AES-CBC decrypt with key "kiemtienmua911ca" / iv "1234567890oiuytr"
// Kotlin mainUrl examples: my.player4me.online, vip.player4me.vip, my.rpmplay.online
async function extractPlayer4Me(url) {
  try {
    var urlObj = new URL(url);
    var mainUrl = urlObj.origin;
    // id is the fragment part (#id) of the URL
    var id = url.indexOf("#") !== -1 ? url.split("#")[1] : urlObj.pathname.split("/").pop();
    var raw = (await fetchText(mainUrl + "/api/v1/video?id=" + id, {
      Host: urlObj.host, Accept: "*/*", Cookie: "popunderCount/=1", Referer: mainUrl + "/"
    })).trim();
    if (!raw || raw.startsWith("<html>")) return null;
    var enc = new TextEncoder();
    var cryptoKey = await crypto.subtle.importKey("raw", enc.encode("kiemtienmua911ca"),
                      { name: "AES-CBC" }, false, ["decrypt"]);
    var dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv: enc.encode("1234567890oiuytr") },
                cryptoKey, b64ToBytes(raw));
    var data = JSON.parse(new TextDecoder().decode(dec));
    var videoUrl = data.source || data.hls || data.cf;
    if (!videoUrl) return null;
    return [{ name: "Player4Me", title: "Player4Me", url: videoUrl, quality: "auto",
              headers: { "User-Agent": UA, Referer: mainUrl + "/" } }];
  } catch (e) { return null; }
}

var DOOD_HOSTS    = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm","playmogo.com"];
var PLAYER4_HOSTS = ["player4me.online","player4me.vip","rpmplay.online"];

async function extractFromUrl(url) {
  if (DOOD_HOSTS.some(function(h){ return url.includes(h); }))    return extractDoodStream(url);
  if (PLAYER4_HOSTS.some(function(h){ return url.includes(h); })) return extractPlayer4Me(url);
  return null;
}

// ── Site scraping ─────────────────────────────────────────────────────────────

// Kotlin: app.get("${mainUrl}/?s=${query}") → div.ml-item → h2 (title), a (href)
async function searchSite(query) {
  var html = await fetchText(BASE_URL + "/?s=" + encodeURIComponent(query));
  var $ = cheerio.load(html);
  var results = [];
  $("div.ml-item").each(function(_, el) {
    var title = $(el).find("h2").first().text().trim();
    var href  = fixUrl($(el).find("a").first().attr("href"));
    if (title && href && !isBlocked(title)) results.push({ title: title, href: href });
  });
  return results;
}

// Kotlin: document.selectFirst("div#pettabs")?.select("div.Rtable1-cell a")
async function getVideoLinks(pageUrl) {
  var html = await fetchText(pageUrl, { Referer: BASE_URL + "/" });
  var $ = cheerio.load(html);
  var links = [];
  $("div#pettabs").find("div.Rtable1-cell a").each(function(_, el) {
    var href = $(el).attr("href");
    if (href) links.push(fixUrl(href, pageUrl));
  });
  return links;
}

// ── getStreams ────────────────────────────────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    console.log("[PornWatch] tmdbId=" + tmdbId + " type=" + mediaType);
    var title = await getTmdbTitle(tmdbId, mediaType);
    if (!title) { console.log("[PornWatch] No TMDB title"); return []; }
    console.log("[PornWatch] searching: " + title);

    var results = await searchSite(title);
    console.log("[PornWatch] results: " + results.length);
    if (!results.length) return [];

    var streams = [];
    for (var i = 0; i < Math.min(results.length, 3); i++) {
      var links = await getVideoLinks(results[i].href);
      console.log("[PornWatch] video links: " + links.join(", "));
      for (var j = 0; j < links.length; j++) {
        var extracted = await extractFromUrl(links[j]);
        if (extracted) {
          for (var k = 0; k < extracted.length; k++) {
            streams.push(Object.assign({}, extracted[k], { title: "[PornWatch] " + extracted[k].title }));
          }
        }
      }
      if (streams.length) break;
    }
    return streams;
  } catch (e) {
    console.error("[PornWatch] Error: " + e.message);
    return [];
  }
}

module.exports = { getStreams: getStreams };
