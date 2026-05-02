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

function b64ToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function toBytes(s) { return new TextEncoder().encode(s); }

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

const BLOCKED = ["gay","homosexual","queer","homo","androphile","femboy","feminine boy","effeminate","trap","trans","Trade","Vers","Twink","Otter","Bear","Femme","Masc","Pegging","Anal Gape","Femdom","futa","strap-on","strapon","tranny","tribute","crossdress","tgirl","t-girl","Bisexual","Intersex","LGBTQ","Trans"];
const BLOCKED_RE = new RegExp(`(?:${BLOCKED.map(w => w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})`, "i");
const isBlocked = (t) => BLOCKED_RE.test(t);

// ── Extractors ───────────────────────────────────────────────────────────────

async function extractDoodStream(url) {
  try {
    const embedUrl = url.replace("doply.net", "myvidplay.com");
    const refHost = "https://myvidplay.com";
    const html = await fetchText(embedUrl, { headers: { Referer: refHost, "User-Agent": UA } });
    const m = html.match(/\/pass_md5\/([^/]*)\/([^/']*)/);
    if (!m) return null;
    const fullPath = m[0], expiry = m[1], token = m[2];
    const base = (await fetchText(refHost + fullPath, { headers: { Referer: embedUrl, "User-Agent": UA } })).trim();
    const directUrl = (token && expiry) ? `${base}?token=${token}&expiry=${expiry}000` : base;
    return [{ name: "DoodStream", title: "DoodStream", url: directUrl, quality: "auto",
              headers: { "User-Agent": UA, Referer: refHost } }];
  } catch { return null; }
}

async function extractPlayer4Me(url) {
  // mainUrl includes subdomain: my.player4me.online / vip.player4me.vip / my.rpmplay.online
  // id comes from the fragment (#id) in the URL
  try {
    const urlObj  = new URL(url);
    const mainUrl = urlObj.origin;
    // id is the part after '#' in the href
    const id      = url.split("#")[1] || urlObj.pathname.split("/").filter(Boolean).pop();
    const apiUrl  = `${mainUrl}/api/v1/video?id=${id}`;
    const raw = (await fetchText(apiUrl, {
      headers: {
        Host:         urlObj.host,
        "User-Agent": UA,
        Accept:       "*/*",
        Cookie:       "popunderCount/=1",
        Referer:      mainUrl + "/"
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

const DOOD_HOSTS    = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm","playmogo.com"];
const PLAYER4_HOSTS = ["player4me.online","player4me.vip","rpmplay.online"];

async function extractFromUrl(url) {
  if (DOOD_HOSTS.some(h => url.includes(h)))    return extractDoodStream(url);
  if (PLAYER4_HOSTS.some(h => url.includes(h))) return extractPlayer4Me(url);
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

const BASE_URL = "https://pornwatch.ws";

async function searchSite(query) {
  // Kotlin: app.get("${mainUrl}/?s=${query}").document
  //         document.select("div.ml-item") → h2 (title), a (href)
  const html = await fetchText(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
  const $ = cheerio.load(html);
  const results = [];
  $("div.ml-item").each((_, el) => {
    const title = $(el).find("h2").first().text().trim();
    const href  = $(el).find("a").first().attr("href");
    if (title && href && !isBlocked(title)) results.push({ title, href });
  });
  return results;
}

async function getVideoLinks(pageUrl) {
  // Kotlin: document.selectFirst("div#pettabs")?.select("div.Rtable1-cell a")
  const html = await fetchText(pageUrl, { headers: { "User-Agent": UA, Referer: BASE_URL + "/" } });
  const $ = cheerio.load(html);
  const links = [];
  $("div#pettabs div.Rtable1-cell a").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("http")) links.push(href);
  });
  return links;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    console.log(`[PornWatch] getStreams tmdbId=${tmdbId} type=${mediaType}`);
    const title = await getTmdbTitle(tmdbId, mediaType);
    if (!title) {
      console.log("[PornWatch] No TMDB title found, skipping");
      return [];
    }
    console.log(`[PornWatch] Searching for: ${title}`);
    const results = await searchSite(title);
    console.log(`[PornWatch] Found ${results.length} search results`);
    if (!results.length) return [];

    const streams = [];
    for (const result of results.slice(0, 3)) {
      console.log(`[PornWatch] Getting video links from: ${result.href}`);
      const videoLinks = await getVideoLinks(result.href);
      console.log(`[PornWatch] Video links found: ${videoLinks.length}`, videoLinks);
      for (const link of videoLinks) {
        const extracted = await extractFromUrl(link);
        if (extracted) {
          streams.push(...extracted.map(s => ({ ...s, title: `[PornWatch] ${s.title}` })));
        }
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
