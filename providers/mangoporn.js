"use strict";
const cheerio = require("cheerio-without-node-native");

// ── Shared Utils ─────────────────────────────────────────────────────────────

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

function b64ToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function toBytes(s) { return new TextEncoder().encode(s); }

async function aesGcmDecrypt(keyBytes, ivB64, dataB64) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(ivB64), tagLength: 128 },
    key,
    b64ToBytes(dataB64)
  );
  return new TextDecoder("iso-8859-1").decode(dec);
}

async function aesCbcDecrypt(cipherB64, keyStr, ivStr) {
  const key = await crypto.subtle.importKey("raw", toBytes(keyStr), { name: "AES-CBC" }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: toBytes(ivStr) },
    key,
    b64ToBytes(cipherB64)
  );
  return new TextDecoder().decode(dec);
}

// ── Filters ──────────────────────────────────────────────────────────────────

const BLOCKED = ["gay","homosexual","queer","homo","androphile","femboy","feminine boy","effeminate","trap","scat","trans","Trade","Vers","Twink","Otter","Bear","Femme","Masc","Pegging","Femdom","futa","tranny","crossdress","Bisexual","Intersex","LGBTQ","tgirl","t-girl","Transsexual"];
const BLOCKED_RE = new RegExp(`(?:${BLOCKED.map(w => w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})`, "i");
const isBlocked = (t) => BLOCKED_RE.test(t);

// ── Extractors ───────────────────────────────────────────────────────────────

async function extractDoodStream(url) {
  try {
    const embedUrl = url.replace("doply.net", "myvidplay.com");
    const refHost = "https://myvidplay.com";
    const html = await fetchText(embedUrl, {
      headers: { Referer: refHost, "User-Agent": UA }
    });
    const m = html.match(/\/pass_md5\/([^/]*)\/([^/']*)/);
    if (!m) return null;
    const fullPath = m[0];
    const expiry   = m[1];
    const token    = m[2];
    const base = (await fetchText(refHost + fullPath, {
      headers: { Referer: embedUrl, "User-Agent": UA }
    })).trim();
    const directUrl = (token && expiry) ? `${base}?token=${token}&expiry=${expiry}000` : base;
    return [{ name: "DoodStream", title: "DoodStream", url: directUrl, quality: "auto",
              headers: { "User-Agent": UA, Referer: refHost } }];
  } catch { return null; }
}

async function extractFilemoon(url) {
  try {
    const idM  = url.match(/\/(?:e|d|v|f|download)\/([0-9a-zA-Z]+)/);
    const id   = idM ? idM[1] : url.split("/").pop().split("?")[0];
    const host = new URL(url).host;
    const rootRef = `https://${host}/`;
    const json = await fetchJson(`https://${host}/api/videos/${id}/embed/playback`, {
      headers: { "User-Agent": UA, Referer: rootRef, Origin: `https://${host}`, "X-Requested-With": "XMLHttpRequest" }
    });
    let sources = json.sources;
    if (!sources && json.playback) {
      const pb = json.playback;
      const keyBytes = new Uint8Array(pb.key_parts.flatMap(p => [...b64ToBytes(p)]));
      const decrypted = await aesGcmDecrypt(keyBytes, pb.iv, pb.payload);
      sources = JSON.parse(decrypted).sources;
    }
    if (!sources || !sources.length) return null;
    return sources.map(s => ({
      name: "Filemoon", title: `Filemoon ${s.label || ""}`.trim(),
      url: s.url, quality: s.label || "auto",
      headers: { Referer: rootRef, "User-Agent": UA }
    }));
  } catch { return null; }
}

async function extractLuluStream(url) {
  try {
    const embedUrl = url.replace("/d/", "/e/");
    const host   = new URL(embedUrl).host;
    const origin = `https://${host}`;
    const html = await fetchText(embedUrl, {
      headers: { "User-Agent": UA, Referer: url, Origin: origin }
    });
    const m = html.match(/["']([^"']+\.m3u8[^"']*)["']/);
    if (!m) return null;
    return [{ name: "LuluStream", title: "LuluStream", url: m[1], quality: "auto",
              headers: { Referer: embedUrl, Origin: origin, "User-Agent": UA } }];
  } catch { return null; }
}

async function extractPlayer4Me(url) {
  try {
    // mainUrl is my.player4me.online / vip.player4me.vip / my.rpmplay.online
    const urlObj  = new URL(url);
    const mainUrl = urlObj.origin;
    const id      = url.split("#")[1] || urlObj.pathname.split("/").pop();
    const apiUrl  = `${mainUrl}/api/v1/video?id=${id}`;
    const raw = (await fetchText(apiUrl, {
      headers: {
        Host: urlObj.host,
        "User-Agent": UA,
        Accept: "*/*",
        Cookie: "popunderCount/=1",
        Referer: mainUrl + "/"
      }
    })).trim();
    if (!raw || raw.startsWith("<html>")) return null;
    const decrypted = await aesCbcDecrypt(raw, "kiemtienmua911ca", "1234567890oiuytr");
    const data = JSON.parse(decrypted);
    const videoUrl = data.source || data.hls || data.cf;
    if (!videoUrl) return null;
    return [{ name: "Player4Me", title: "Player4Me", url: videoUrl, quality: "auto",
              headers: { "User-Agent": UA, Referer: mainUrl + "/" } }];
  } catch { return null; }
}

async function extractVidguard(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    // Find the eval/obfuscated script to get svg.stream
    const scriptM = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]+?(?=<\/script>)/);
    if (!scriptM) return null;
    const packed = scriptM[0];
    const unpacked = jsUnpack(packed);
    if (!unpacked) return null;
    const streamM = unpacked.match(/stream\s*:\s*["']([^"']+sig=[^"']+)["']/);
    if (!streamM) return null;
    const streamUrl = sigDecode(streamM[1]);
    return [{ name: "Vidguard", title: "Vidguard", url: streamUrl, quality: "auto",
              headers: { "User-Agent": UA, Referer: "https://vidguard.to/" } }];
  } catch { return null; }
}

function sigDecode(url) {
  const sig = url.split("sig=")[1].split("&")[0];
  let t = "";
  for (let i = 0; i < sig.length; i += 2) {
    t += String.fromCharCode(parseInt(sig.slice(i, i + 2), 16) ^ 2);
  }
  const padding = [0, 0, 2, 1][t.length % 4];
  const dec = atob(t + "=".repeat(padding));
  let s = dec.slice(0, -5).split("").reverse().join("");
  const arr = s.split("");
  for (let i = 0; i < arr.length - 1; i += 2) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
  const modSig = arr.join("").slice(0, -5);
  return url.replace(sig, modSig);
}

function jsUnpack(packed) {
  try {
    const m = packed.match(/\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!m) return null;
    let [, p, a, , k] = m;
    a = parseInt(a);
    const kws = k.split("|");
    return p.replace(/\b\w+\b/g, w => kws[parseInt(w, a)] || w);
  } catch { return null; }
}

async function extractVidNest(url) {
  try {
    const html = await fetchText(url, {
      headers: { "User-Agent": UA, Referer: "https://vidnest.io/" }
    });
    const fm = html.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/);
    const lm = html.match(/label\s*:\s*["']([^"']+)["']/);
    if (!fm) return null;
    return [{ name: "VidNest", title: `VidNest ${lm?.[1] || ""}`.trim(),
              url: fm[1], quality: lm?.[1] || "auto",
              headers: { "User-Agent": UA, Referer: "https://vidnest.io/", Origin: "https://vidnest.io" } }];
  } catch { return null; }
}

const DOOD_HOSTS    = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm","playmogo.com"];
const FILEMOON_HOSTS = ["filemoon.to","filemoon.in","filemoon.sx","bysedikamoum.com","bysezoxexe.com","x08.ovh","javmoon.me"];
const LULU_HOSTS    = ["lulustream.com","luluvid.com","luluvdo.com","luluvdoo.com","lulupvp.com","lulu.dlc.ovh","lulu0.ovh"];
const PLAYER4_HOSTS = ["player4me.online","player4me.vip","rpmplay.online"];

async function extractFromUrl(url) {
  if (DOOD_HOSTS.some(h => url.includes(h)))    return extractDoodStream(url);
  if (FILEMOON_HOSTS.some(h => url.includes(h))) return extractFilemoon(url);
  if (LULU_HOSTS.some(h => url.includes(h)))    return extractLuluStream(url);
  if (PLAYER4_HOSTS.some(h => url.includes(h))) return extractPlayer4Me(url);
  if (url.includes("vidguard.to"))               return extractVidguard(url);
  if (url.includes("vidnest.io"))                return extractVidNest(url);
  return null;
}

// ── TMDB title lookup ─────────────────────────────────────────────────────────

async function getTmdbTitle(tmdbId, mediaType) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?language=en-US`, {
      headers: { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN || ""}` }
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.title || d.name || null;
  } catch { return null; }
}

// ── Provider ─────────────────────────────────────────────────────────────────

const BASE_URL = "https://mangoporn.net";

async function searchSite(query) {
  // Mangoporn search page uses different markup than the main listing
  // In Kotlin: toSearchingResult() → div.details a (title), div.image a (href), div.image img (poster)
  const html = await fetchText(`${BASE_URL}/page/1/?s=${encodeURIComponent(query)}`);
  const $ = cheerio.load(html);
  const results = [];
  $("article").each((_, el) => {
    const title = $(el).find("div.details a").first().text().trim();
    const href  = $(el).find("div.image a").first().attr("href");
    if (title && href && !isBlocked(title)) {
      results.push({ title, href });
    }
  });
  return results;
}

async function getVideoLinks(pageUrl) {
  // Kotlin: document.select("div#pettabs > ul a").map { it.attr("href") }
  const html = await fetchText(pageUrl, { headers: { "User-Agent": UA, Referer: BASE_URL + "/" } });
  const $ = cheerio.load(html);
  const links = [];
  $("div#pettabs > ul a").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("http")) links.push(href);
  });
  return links;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    console.log(`[Mangoporn] getStreams tmdbId=${tmdbId} type=${mediaType}`);
    const title = await getTmdbTitle(tmdbId, mediaType);
    if (!title) {
      console.log("[Mangoporn] No TMDB title found, skipping");
      return [];
    }
    console.log(`[Mangoporn] Searching for: ${title}`);
    const results = await searchSite(title);
    console.log(`[Mangoporn] Found ${results.length} search results`);
    if (!results.length) return [];

    const streams = [];
    for (const result of results.slice(0, 3)) {
      console.log(`[Mangoporn] Getting video links from: ${result.href}`);
      const videoLinks = await getVideoLinks(result.href);
      console.log(`[Mangoporn] Video links found: ${videoLinks.length}`, videoLinks);
      for (const link of videoLinks) {
        const extracted = await extractFromUrl(link);
        if (extracted) {
          streams.push(...extracted.map(s => ({ ...s, title: `[Mangoporn] ${s.title}` })));
        }
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
