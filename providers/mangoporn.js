"use strict";
var cheerio = require("cheerio-without-node-native");

// ── Helpers ──────────────────────────────────────────────────────────────────

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";
var BASE_URL = "https://mangoporn.net";

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

var BLOCKED = ["gay","homosexual","queer","homo","androphile","femboy","feminine boy","effeminate","trap","scat","trans","Trade","Vers","Twink","Otter","Bear","Femme","Masc","Pegging","Femdom","futa","tranny","crossdress","Bisexual","Intersex","LGBTQ","tgirl","t-girl","Transsexual","TS","TGirl","T-Boy"];
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
    var fullPath = m[0];
    var expiry   = m[1];
    var token    = m[2];
    var base = (await fetchText(refHost + fullPath, { Referer: embedUrl })).trim();
    var directUrl = (token && expiry) ? (base + "?token=" + token + "&expiry=" + expiry + "000") : base;
    return [{ name: "DoodStream", title: "DoodStream", url: directUrl, quality: "auto",
              headers: { "User-Agent": UA, Referer: refHost } }];
  } catch (e) { return null; }
}

async function extractLuluStream(url) {
  try {
    var embedUrl = url.replace("/d/", "/e/");
    var host = new URL(embedUrl).host;
    var origin = "https://" + host;
    var html = await fetchText(embedUrl, { Referer: url, Origin: origin });
    var m = html.match(/["']([^"']+\.m3u8[^"']*)["']/);
    if (!m) return null;
    return [{ name: "LuluStream", title: "LuluStream", url: m[1], quality: "auto",
              headers: { Referer: embedUrl, Origin: origin } }];
  } catch (e) { return null; }
}

function b64ToBytes(str) {
  var b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  var padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), function(c){ return c.charCodeAt(0); });
}

async function extractFilemoon(url) {
  try {
    var m = url.match(/\/(?:e|d|v|f|download)\/([0-9a-zA-Z]+)/);
    var id = m ? m[1] : url.split("/").pop().split("?")[0];
    var host = new URL(url).host;
    var rootRef = "https://" + host + "/";
    var response = await fetchText("https://" + host + "/api/videos/" + id + "/embed/playback", {
      Referer: rootRef, Origin: "https://" + host, "X-Requested-With": "XMLHttpRequest"
    });
    var json = JSON.parse(response);
    var sources = json.sources;
    if (!sources && json.playback) {
      var pb = json.playback;
      var keyParts = pb.key_parts;
      var allBytes = [];
      for (var i = 0; i < keyParts.length; i++) {
        var chunk = b64ToBytes(keyParts[i]);
        for (var j = 0; j < chunk.length; j++) allBytes.push(chunk[j]);
      }
      var keyBytes = new Uint8Array(allBytes);
      var key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
      var dec = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64ToBytes(pb.iv), tagLength: 128 },
        key,
        b64ToBytes(pb.payload)
      );
      sources = JSON.parse(new TextDecoder("iso-8859-1").decode(dec)).sources;
    }
    if (!sources || !sources.length) return null;
    return sources.map(function(s) {
      return { name: "Filemoon", title: "Filemoon " + (s.label || ""), url: s.url,
               quality: s.label || "auto", headers: { Referer: rootRef } };
    });
  } catch (e) { return null; }
}

async function extractPlayer4Me(url) {
  try {
    var urlObj = new URL(url);
    var mainUrl = urlObj.origin;
    var id = url.split("#")[1] || urlObj.pathname.split("/").pop();
    var raw = (await fetchText(mainUrl + "/api/v1/video?id=" + id, {
      Host: urlObj.host, Accept: "*/*", Cookie: "popunderCount/=1", Referer: mainUrl + "/"
    })).trim();
    if (!raw || raw.startsWith("<html>")) return null;
    var key = new TextEncoder().encode("kiemtienmua911ca");
    var iv  = new TextEncoder().encode("1234567890oiuytr");
    var cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["decrypt"]);
    var dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv: iv }, cryptoKey, b64ToBytes(raw));
    var data = JSON.parse(new TextDecoder().decode(dec));
    var videoUrl = data.source || data.hls || data.cf;
    if (!videoUrl) return null;
    return [{ name: "Player4Me", title: "Player4Me", url: videoUrl, quality: "auto",
              headers: { "User-Agent": UA, Referer: mainUrl + "/" } }];
  } catch (e) { return null; }
}

async function extractVidNest(url) {
  try {
    var html = await fetchText(url, { Referer: "https://vidnest.io/" });
    var fm = html.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/);
    var lm = html.match(/label\s*:\s*["']([^"']+)["']/);
    if (!fm) return null;
    return [{ name: "VidNest", title: "VidNest " + (lm ? lm[1] : ""), url: fm[1],
              quality: lm ? lm[1] : "auto",
              headers: { "User-Agent": UA, Referer: "https://vidnest.io/", Origin: "https://vidnest.io" } }];
  } catch (e) { return null; }
}

var DOOD_HOSTS     = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm","playmogo.com"];
var FILEMOON_HOSTS = ["filemoon.to","filemoon.in","filemoon.sx","bysedikamoum.com","bysezoxexe.com","x08.ovh","javmoon.me"];
var LULU_HOSTS     = ["lulustream.com","luluvid.com","luluvdo.com","luluvdoo.com","lulupvp.com","lulu.dlc.ovh","lulu0.ovh"];
var PLAYER4_HOSTS  = ["player4me.online","player4me.vip","rpmplay.online"];

async function extractFromUrl(url) {
  if (DOOD_HOSTS.some(function(h){ return url.includes(h); }))     return extractDoodStream(url);
  if (FILEMOON_HOSTS.some(function(h){ return url.includes(h); })) return extractFilemoon(url);
  if (LULU_HOSTS.some(function(h){ return url.includes(h); }))     return extractLuluStream(url);
  if (PLAYER4_HOSTS.some(function(h){ return url.includes(h); }))  return extractPlayer4Me(url);
  if (url.includes("vidnest.io"))                                   return extractVidNest(url);
  return null;
}

// ── Site scraping ─────────────────────────────────────────────────────────────

// Search uses toSearchingResult() selectors: div.details a (title), div.image a (href)
async function searchSite(query) {
  var html = await fetchText(BASE_URL + "/page/1/?s=" + encodeURIComponent(query));
  var $ = cheerio.load(html);
  var results = [];
  $("article").each(function(_, el) {
    var title = $(el).find("div.details a").first().text().trim();
    var href  = fixUrl($(el).find("div.image a").first().attr("href"));
    if (title && href && !isBlocked(title)) results.push({ title: title, href: href });
  });
  return results;
}

// loadLinks: document.select("div#pettabs > ul a").map { it.attr("href") }
async function getVideoLinks(pageUrl) {
  var html = await fetchText(pageUrl, { Referer: BASE_URL + "/" });
  var $ = cheerio.load(html);
  var links = [];
  $("div#pettabs > ul a").each(function(_, el) {
    var href = $(el).attr("href");
    if (href) links.push(fixUrl(href, pageUrl));
  });
  return links;
}

// ── getStreams ────────────────────────────────────────────────────────────────

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    console.log("[Mangoporn] tmdbId=" + tmdbId + " type=" + mediaType);
    var title = await getTmdbTitle(tmdbId, mediaType);
    if (!title) { console.log("[Mangoporn] No TMDB title"); return []; }
    console.log("[Mangoporn] searching: " + title);

    var results = await searchSite(title);
    console.log("[Mangoporn] results: " + results.length);
    if (!results.length) return [];

    var streams = [];
    for (var i = 0; i < Math.min(results.length, 3); i++) {
      var links = await getVideoLinks(results[i].href);
      console.log("[Mangoporn] video links from " + results[i].href + ": " + links.join(", "));
      for (var j = 0; j < links.length; j++) {
        var extracted = await extractFromUrl(links[j]);
        if (extracted) {
          for (var k = 0; k < extracted.length; k++) {
            streams.push(Object.assign({}, extracted[k], { title: "[Mangoporn] " + extracted[k].title }));
          }
        }
      }
      if (streams.length) break;
    }
    return streams;
  } catch (e) {
    console.error("[Mangoporn] Error: " + e.message);
    return [];
  }
}

module.exports = { getStreams: getStreams };
