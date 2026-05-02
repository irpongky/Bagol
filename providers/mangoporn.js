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

async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, options));
}

function base64UrlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function textToBytes(s) { return new TextEncoder().encode(s); }

async function aesGcmDecrypt(keyBytes, ivB64, dataB64) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(ivB64), tagLength: 128 },
    key,
    base64UrlToBytes(dataB64)
  );
  return new TextDecoder("iso-8859-1").decode(dec);
}

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

async function extractFilemoon(url) {
  try {
    const id = (url.match(/\/(?:e|d|v|f|download)\/([0-9a-zA-Z]+)/) || [])[1] || url.split("/").pop().split("?")[0];
    const host = new URL(url).host;
    const rootRef = `https://${host}/`;
    const json = await fetchJson(`https://${host}/api/videos/${id}/embed/playback`, {
      headers: { "User-Agent": UA, Referer: rootRef, Origin: `https://${host}`, "X-Requested-With": "XMLHttpRequest" }
    });
    let sources = json.sources;
    if (!sources && json.playback) {
      const pb = json.playback;
      const keyBytes = new Uint8Array(pb.key_parts.flatMap(p => [...base64UrlToBytes(p)]));
      sources = JSON.parse(await aesGcmDecrypt(keyBytes, pb.iv, pb.payload)).sources;
    }
    if (!sources) return null;
    return sources.map(s => ({ name: "Filemoon", title: `Filemoon ${s.label || ""}`.trim(), url: s.url, quality: s.label || "auto", headers: { Referer: rootRef } }));
  } catch { return null; }
}

async function extractLuluStream(url) {
  try {
    const embedUrl = url.replace("/d/", "/e/");
    const origin = new URL(embedUrl).origin;
    const html = await fetchText(embedUrl, { headers: { "User-Agent": UA, Referer: url, Origin: origin } });
    const m = html.match(/["']([^"']+\.m3u8[^"']*)["']/);
    if (!m) return null;
    return [{ name: "LuluStream", title: "LuluStream", url: m[1], quality: "auto", headers: { Referer: embedUrl, Origin: origin } }];
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

async function extractVidguard(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const sigM = html.match(/sig=([a-fA-F0-9]+)/);
    if (!sigM) return null;
    let t = "";
    const sig = sigM[1];
    for (let i = 0; i < sig.length; i += 2) t += String.fromCharCode(parseInt(sig.slice(i, i + 2), 16) ^ 2);
    const padding = [0, 0, 2, 1][t.length % 4];
    const dec = atob(t + "=".repeat(padding));
    let s = dec.slice(0, -5).split("").reverse().join("");
    const arr = s.split("");
    for (let i = 0; i < arr.length - 1; i += 2) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    const modSig = arr.join("").slice(0, -5);
    return [{ name: "Vidguard", title: "Vidguard", url: url.replace(sig, modSig), quality: "auto", headers: { "User-Agent": UA, Referer: "https://vidguard.to" } }];
  } catch { return null; }
}

async function extractVidNest(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA, Referer: "https://vidnest.io/" } });
    const fm = html.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/);
    const lm = html.match(/label\s*:\s*["']([^"']+)["']/);
    if (!fm) return null;
    return [{ name: "VidNest", title: `VidNest ${lm?.[1] || ""}`.trim(), url: fm[1], quality: lm?.[1] || "auto", headers: { "User-Agent": UA, Referer: "https://vidnest.io/", Origin: "https://vidnest.io" } }];
  } catch { return null; }
}

const DOOD_HOSTS = ["myvidplay.com","doply.net","playmogo.com","dood.pm","ds2play.com","d000d.com"];
const FILEMOON_HOSTS = ["filemoon.to","filemoon.in","filemoon.sx","bysedikamoum.com","bysezoxexe.com","x08.ovh","javmoon.me"];
const LULU_HOSTS = ["lulustream.com","luluvid.com","luluvdo.com","luluvdoo.com","lulupvp.com","lulu.dlc.ovh","lulu0.ovh"];
const PLAYER4ME_HOSTS = ["player4me.online","player4me.vip","rpmplay.online"];

async function extractFromUrl(url) {
  if (DOOD_HOSTS.some(h => url.includes(h))) return extractDoodStream(url);
  if (FILEMOON_HOSTS.some(h => url.includes(h))) return extractFilemoon(url);
  if (LULU_HOSTS.some(h => url.includes(h))) return extractLuluStream(url);
  if (PLAYER4ME_HOSTS.some(h => url.includes(h))) return extractPlayer4Me(url);
  if (url.includes("vidguard.to")) return extractVidguard(url);
  if (url.includes("vidnest.io")) return extractVidNest(url);
  return null;
}

// ── Provider ─────────────────────────────────────────────────────────────────

const BASE_URL = "https://mangoporn.net";

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
  const html = await fetchText(`${BASE_URL}/page/1/?s=${encodeURIComponent(query)}`);
  const $ = cheerio.load(html);
  const results = [];
  $("article").each((_, el) => {
    const title = $(el).find("div h3").text().trim();
    const href = $(el).find("div h3 a").attr("href");
    if (title && href && !isBlocked(title)) results.push({ title, href });
  });
  return results;
}

async function getVideoLinks(pageUrl) {
  const html = await fetchText(pageUrl);
  const $ = cheerio.load(html);
  const links = [];
  $("div#pettabs > ul a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) links.push(href);
  });
  return links;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    console.log(`[Mangoporn] ${mediaType} ${tmdbId}`);
    const title = await getTmdbTitle(tmdbId, mediaType);
    const query = title || String(tmdbId);
    const results = await searchSite(query);
    if (!results.length) return [];

    const streams = [];
    for (const result of results.slice(0, 3)) {
      const videoLinks = await getVideoLinks(result.href);
      for (const link of videoLinks) {
        const extracted = await extractFromUrl(link);
        if (extracted) streams.push(...extracted.map(s => ({ ...s, title: `[Mangoporn] ${s.title}` })));
      }
      if (streams.length) break;
    }
    return streams;
  } catch (e) {
    console.error(`[Mangoporn] Error: ${e.message}`);
    return [];
  }
}

module.exports = { getStreams };
