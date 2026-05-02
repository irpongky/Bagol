"use strict";
const cheerio = require("cheerio-without-node-native");

// ── Shared ───────────────────────────────────────────────────────────────────

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";

async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function base64UrlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function textToBytes(s) { return new TextEncoder().encode(s); }

async function aesCbcDecrypt(cipherB64, keyStr, ivStr) {
  const key = await crypto.subtle.importKey("raw", textToBytes(keyStr), { name: "AES-CBC" }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: textToBytes(ivStr) },
    key,
    base64UrlToBytes(cipherB64)
  );
  return new TextDecoder().decode(dec);
}

// ── Filters ──────────────────────────────────────────────────────────────────

const BLOCKED = ["gay","homosexual","queer","homo","femboy","trans","tranny","Bisexual","Intersex","LGBTQ","TS","TGirl","T-Boy","Transsexual","futa","crossdress","tgirl","t-girl","Pegging","Femdom"];
const BLOCKED_RE = new RegExp(`\\b(?:${BLOCKED.map(w => w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})\\w*\\b`, "i");
const isBlocked = (t) => BLOCKED_RE.test(t);

// ── Extractors ───────────────────────────────────────────────────────────────

async function extractDoodStream(url) {
  try {
    const embedUrl = url.replace("doply.net", "myvidplay.com");
    const refHost = "https://myvidplay.com";
    const html = await fetchText(embedUrl, { headers: { Referer: refHost } });
    const m = html.match(/\/pass_md5\/([^/]*)\/([^/']*)/);
    if (!m) return null;
    const [fullPath, expiry, token] = m;
    const base = (await fetchText(refHost + fullPath, { headers: { Referer: embedUrl } })).trim();
    const directUrl = token && expiry ? `${base}?token=${token}&expiry=${expiry}000` : base;
    return [{ name: "DoodStream", title: "DoodStream", url: directUrl, quality: "auto", headers: { "User-Agent": UA, Referer: refHost } }];
  } catch { return null; }
}

async function extractPlayer4Me(url) {
  try {
    const mainUrl = new URL(url).origin;
    const id = url.split("#")[1] || url.split("/").pop();
    const raw = (await fetchText(`${mainUrl}/api/v1/video?id=${id}`, {
      headers: { Host: new URL(url).host, "User-Agent": UA, Accept: "*/*", Cookie: "popunderCount/=1", Referer: mainUrl + "/" }
    })).trim();
    if (raw.startsWith("<html>")) return null;
    const data = JSON.parse(await aesCbcDecrypt(raw, "kiemtienmua911ca", "1234567890oiuytr"));
    const videoUrl = data.source || data.hls || data.cf;
    if (!videoUrl) return null;
    return [{ name: "Player4Me", title: "Player4Me", url: videoUrl, quality: "auto", headers: { "User-Agent": UA, Referer: mainUrl + "/" } }];
  } catch { return null; }
}

const DOOD_HOSTS = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm","playmogo.com"];
const PLAYER4ME_HOSTS = ["player4me.online","player4me.vip","rpmplay.online"];

async function extractFromUrl(url) {
  if (DOOD_HOSTS.some(h => url.includes(h))) return extractDoodStream(url);
  if (PLAYER4ME_HOSTS.some(h => url.includes(h))) return extractPlayer4Me(url);
  return null;
}

// ── Provider ─────────────────────────────────────────────────────────────────

const BASE_URL = "https://pornwatch.ws";

async function getTmdbTitle(tmdbId, mediaType) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?language=en-US`, {
      headers: { Authorization: `Bearer ${typeof TMDB_READ_TOKEN !== "undefined" ? TMDB_READ_TOKEN : ""}` }
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.title || d.name || null;
  } catch { return null; }
}

async function searchSite(query) {
  const html = await fetchText(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
  const $ = cheerio.load(html);
  const results = [];
  $("div.ml-item").each((_, el) => {
    const title = $(el).find("h2").text().trim();
    const href = $(el).find("a").attr("href");
    if (title && href && !isBlocked(title)) results.push({ title, href });
  });
  return results;
}

async function getVideoLinks(pageUrl) {
  const html = await fetchText(pageUrl);
  const $ = cheerio.load(html);
  const links = [];
  $("div#pettabs div.Rtable1-cell a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) links.push(href);
  });
  return links;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    console.log(`[PornWatch] ${mediaType} ${tmdbId}`);
    const title = await getTmdbTitle(tmdbId, mediaType);
    const query = title || String(tmdbId);
    const results = await searchSite(query);
    if (!results.length) return [];

    const streams = [];
    for (const result of results.slice(0, 3)) {
      const videoLinks = await getVideoLinks(result.href);
      for (const link of videoLinks) {
        const extracted = await extractFromUrl(link);
        if (extracted) streams.push(...extracted.map(s => ({ ...s, title: `[PornWatch] ${s.title}` })));
      }
      if (streams.length) break;
    }
    return streams;
  } catch (e) {
    console.error(`[PornWatch] Error: ${e.message}`);
    return [];
  }
}

module.exports = { getStreams };
