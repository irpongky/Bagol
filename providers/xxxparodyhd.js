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

async function extractStreamwish(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const fm = html.match(/file:\s*["']([^"']+)["']/);
    if (!fm) return null;
    return [{ name: "Streamwish", title: "Streamwish", url: fm[1], quality: "auto", headers: { "User-Agent": UA } }];
  } catch { return null; }
}

async function extractVidhidepro(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const fm = html.match(/sources:\s*\[\s*\{\s*file:\s*"([^"]+\.m3u8[^"]*)"/);
    if (!fm) return null;
    return [{ name: "Vidhidepro", title: "Vidhidepro", url: fm[1], quality: "auto", headers: { Referer: new URL(url).origin + "/" } }];
  } catch { return null; }
}

async function extractJavggvideo(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const link = html.split("var urlPlay = '")[1]?.split("';")[0];
    if (!link) return null;
    return [{ name: "Javggvideo", title: "Javggvideo", url: link, quality: "auto", headers: { "User-Agent": UA } }];
  } catch { return null; }
}

async function extractJavclan(url, referer) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Referer: referer || url } });
    if (!res.ok) return null;
    const html = await res.text();
    const fm = html.match(/file:\s*["']([^"']+)["']/);
    if (!fm) return null;
    return [{ name: "Javclan", title: "Javclan", url: fm[1], quality: "auto", headers: { Referer: referer || url } }];
  } catch { return null; }
}

async function extractMaxstream(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const packed = html.match(/function\(p,a,c,k,e,d\)[\s\S]+?(?=<\/script>)/)?.[0];
    if (!packed) return null;
    const match = packed.match(/\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/);
    if (!match) return null;
    const [, p, a, , k] = match;
    const kws = k.split("|");
    const decoded = p.replace(/\b\w+\b/g, w => kws[parseInt(w, parseInt(a))] || w);
    const fm = decoded.match(/file:\s*["']([^"']+)["']/);
    if (!fm) return null;
    return [{ name: "Maxstream", title: "Maxstream", url: fm[1], quality: "auto", headers: { "User-Agent": UA } }];
  } catch { return null; }
}

async function extractMixdrop(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const fm = html.match(/(?:vsr|wurl|surl)\s*=\s*"([^"]+)"/);
    if (!fm) return null;
    const videoUrl = fm[1].startsWith("//") ? "https:" + fm[1] : fm[1];
    return [{ name: "MixDrop", title: "MixDrop", url: videoUrl, quality: "auto", headers: { "User-Agent": UA, Referer: new URL(url).origin + "/" } }];
  } catch { return null; }
}

const DOOD_HOSTS = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm"];
const STREAMWISH_HOSTS = ["streamwish.to","streamhihi.com","javsw.me","swhoi.com"];
const VIDHIDE_HOSTS = ["vidhidepro.com","vidhidevip.com","javlion.xyz"];
const MIXDROP_HOSTS = ["mixdrop.ag","mixdrop.my","mixdrop.is"];

async function extractFromUrl(url, referer) {
  if (DOOD_HOSTS.some(h => url.includes(h))) return extractDoodStream(url);
  if (STREAMWISH_HOSTS.some(h => url.includes(h))) return extractStreamwish(url);
  if (VIDHIDE_HOSTS.some(h => url.includes(h))) return extractVidhidepro(url);
  if (url.includes("javggvideo.xyz")) return extractJavggvideo(url);
  if (url.includes("javclan.com")) return extractJavclan(url, referer);
  if (url.includes("maxstream.org")) return extractMaxstream(url);
  if (MIXDROP_HOSTS.some(h => url.includes(h))) return extractMixdrop(url);
  return null;
}

// ── Provider ─────────────────────────────────────────────────────────────────

const BASE_URL = "https://xxxparodyhd.net";

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
  const html = await fetchText(`${BASE_URL}/search/${encodeURIComponent(query)}`);
  const $ = cheerio.load(html);
  const results = [];
  $("div.movies-list div.ml-item").each((_, el) => {
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
  $('div.Rtable1 a[id="\\#iframe"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) links.push(href);
  });
  return links;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    console.log(`[XXXParodyHD] ${mediaType} ${tmdbId}`);
    const title = await getTmdbTitle(tmdbId, mediaType);
    const query = title || String(tmdbId);
    const results = await searchSite(query);
    if (!results.length) return [];

    const streams = [];
    for (const result of results.slice(0, 3)) {
      const videoLinks = await getVideoLinks(result.href);
      for (const link of videoLinks) {
        const extracted = await extractFromUrl(link, BASE_URL + "/");
        if (extracted) streams.push(...extracted.map(s => ({ ...s, title: `[XXXParodyHD] ${s.title}` })));
      }
      if (streams.length) break;
    }
    return streams;
  } catch (e) {
    console.error(`[XXXParodyHD] Error: ${e.message}`);
    return [];
  }
}

module.exports = { getStreams };
