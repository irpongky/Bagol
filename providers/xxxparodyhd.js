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

// ── Filters ──────────────────────────────────────────────────────────────────

const BLOCKED = ["gay","homosexual","queer","homo","androphile","femboy","feminine boy","effeminate","trap","trans","Trade","Vers","Twink","Otter","Bear","Femme","Masc","Pegging","Femdom","futa","tranny","crossdress","Bisexual","Intersex","LGBTQ","tgirl","t-girl","Transsexual"];
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

async function extractStreamwish(url) {
  // Kotlin: script:containsData(sources) → regex file:"(.*?)"
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const $ = cheerio.load(html);
    let script = "";
    $("script").each((_, el) => {
      const s = $(el).html() || "";
      if (s.includes("sources")) { script = s; return false; }
    });
    const m = script.match(/file\s*:\s*"([^"]+)"/);
    if (!m) return null;
    return [{ name: "Streamwish", title: "Streamwish", url: m[1], quality: "auto",
              headers: { "User-Agent": UA, Referer: url } }];
  } catch { return null; }
}

async function extractVidhidepro(url) {
  // Kotlin: sources:.[file:"(.*)".* in script:containsData(sources)
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const $ = cheerio.load(html);
    let script = "";
    $("script").each((_, el) => {
      const s = $(el).html() || "";
      if (s.includes("sources")) { script = s; return false; }
    });
    const m = script.match(/sources:\s*\[\s*\{[^}]*file\s*:\s*"([^"]+\.m3u8[^"]*)"/);
    if (!m) return null;
    return [{ name: "Vidhidepro", title: "Vidhidepro", url: m[1], quality: "auto",
              headers: { Referer: new URL(url).origin + "/", "User-Agent": UA } }];
  } catch { return null; }
}

async function extractJavggvideo(url) {
  // Kotlin: substringAfter("var urlPlay = '").substringBefore("';")
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const m = html.match(/var urlPlay\s*=\s*'([^']+)'/);
    if (!m) return null;
    return [{ name: "Javggvideo", title: "Javggvideo", url: m[1], quality: "auto",
              headers: { "User-Agent": UA, Referer: new URL(url).origin + "/" } }];
  } catch { return null; }
}

async function extractJavclan(url, referer) {
  // Kotlin: script:containsData(sources) → file:"(.*?)"
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA, Referer: referer || url } });
    const $ = cheerio.load(html);
    let script = "";
    $("script").each((_, el) => {
      const s = $(el).html() || "";
      if (s.includes("sources")) { script = s; return false; }
    });
    const m = script.match(/file\s*:\s*"([^"]+)"/);
    if (!m) return null;
    return [{ name: "Javclan", title: "Javclan", url: m[1], quality: "auto",
              headers: { Referer: referer || url, "User-Agent": UA } }];
  } catch { return null; }
}

async function extractMaxstream(url) {
  // Kotlin: JsUnpacker on script:containsData(function(p,a,c,k,e,d)) → file:"(.*?)"
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const $ = cheerio.load(html);
    let packedScript = "";
    $("script").each((_, el) => {
      const s = $(el).html() || "";
      if (s.includes("function(p,a,c,k,e,d)")) { packedScript = s; return false; }
    });
    const unpacked = jsUnpack(packedScript);
    if (!unpacked) return null;
    const m = unpacked.match(/file\s*:\s*"([^"]+)"/);
    if (!m) return null;
    return [{ name: "Maxstream", title: "Maxstream", url: m[1], quality: "auto",
              headers: { "User-Agent": UA, Referer: url } }];
  } catch { return null; }
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

async function extractMixdrop(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const m = html.match(/(?:vsr|wurl|surl)\s*=\s*"([^"]+)"/);
    if (!m) return null;
    const videoUrl = m[1].startsWith("//") ? "https:" + m[1] : m[1];
    return [{ name: "MixDrop", title: "MixDrop", url: videoUrl, quality: "auto",
              headers: { "User-Agent": UA, Referer: new URL(url).origin + "/" } }];
  } catch { return null; }
}

const DOOD_HOSTS     = ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm"];
const STREAMWISH_HOSTS = ["streamwish.to","streamhihi.com","javsw.me","swhoi.com"];
const VIDHIDE_HOSTS  = ["vidhidepro.com","vidhidevip.com","javlion.xyz"];
const MIXDROP_HOSTS  = ["mixdrop.ag","mixdrop.my","mixdrop.is"];

async function extractFromUrl(url, referer) {
  if (DOOD_HOSTS.some(h => url.includes(h)))      return extractDoodStream(url);
  if (STREAMWISH_HOSTS.some(h => url.includes(h))) return extractStreamwish(url);
  if (VIDHIDE_HOSTS.some(h => url.includes(h)))   return extractVidhidepro(url);
  if (url.includes("javggvideo.xyz"))              return extractJavggvideo(url);
  if (url.includes("javclan.com"))                 return extractJavclan(url, referer);
  if (url.includes("maxstream.org"))               return extractMaxstream(url);
  if (MIXDROP_HOSTS.some(h => url.includes(h)))   return extractMixdrop(url);
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

const BASE_URL = "https://xxxparodyhd.net";

async function searchSite(query) {
  // Kotlin: app.get("${mainUrl}/search/${query}").document
  //         document.select("div.movies-list div.ml-item") → h2 (title), a (href)
  const html = await fetchText(`${BASE_URL}/search/${encodeURIComponent(query)}`);
  const $ = cheerio.load(html);
  const results = [];
  $("div.movies-list div.ml-item").each((_, el) => {
    const title = $(el).find("h2").first().text().trim();
    const href  = $(el).find("a").first().attr("href");
    if (title && href && !isBlocked(title)) results.push({ title, href });
  });
  return results;
}

async function getVideoLinks(pageUrl) {
  // Kotlin: document.select("div.Rtable1 a#\\#iframe")
  // The id attribute value is literally "#iframe" (contains a hash)
  // In cheerio we cannot use CSS id selector for values containing #
  // Use filter() instead:
  const html = await fetchText(pageUrl, { headers: { "User-Agent": UA, Referer: BASE_URL + "/" } });
  const $ = cheerio.load(html);
  const links = [];
  $("div.Rtable1 a").filter((_, el) => {
    return $(el).attr("id") === "#iframe";
  }).each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("http")) links.push(href);
  });
  return links;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    console.log(`[XXXParodyHD] getStreams tmdbId=${tmdbId} type=${mediaType}`);
    const title = await getTmdbTitle(tmdbId, mediaType);
    if (!title) {
      console.log("[XXXParodyHD] No TMDB title found, skipping");
      return [];
    }
    console.log(`[XXXParodyHD] Searching for: ${title}`);
    const results = await searchSite(title);
    console.log(`[XXXParodyHD] Found ${results.length} search results`);
    if (!results.length) return [];

    const streams = [];
    for (const result of results.slice(0, 3)) {
      console.log(`[XXXParodyHD] Getting video links from: ${result.href}`);
      const videoLinks = await getVideoLinks(result.href);
      console.log(`[XXXParodyHD] Video links found: ${videoLinks.length}`, videoLinks);
      for (const link of videoLinks) {
        const extracted = await extractFromUrl(link, BASE_URL + "/");
        if (extracted) {
          streams.push(...extracted.map(s => ({ ...s, title: `[XXXParodyHD] ${s.title}` })));
        }
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
