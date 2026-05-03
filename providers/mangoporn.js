var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/shared/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";
var HEADERS = {
  "User-Agent": UA
};
async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: { ...HEADERS, ...options.headers },
    ...options
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}
async function fetchJson(url, options = {}) {
  const raw = await fetchText(url, options);
  return JSON.parse(raw);
}
async function getTitleFromTmdb(tmdbId, mediaType) {
  try {
    const endpoint = mediaType === "tv" ? `https://api.themoviedb.org/3/tv/${tmdbId}` : `https://api.themoviedb.org/3/movie/${tmdbId}`;
    const res = await fetch(`${endpoint}?language=en-US`, {
      headers: { Authorization: `Bearer ${typeof TMDB_READ_TOKEN !== "undefined" ? TMDB_READ_TOKEN : ""}` }
    });
    if (!res.ok)
      return null;
    const data = await res.json();
    return data.title || data.name || null;
  } catch {
    return null;
  }
}

// src/shared/extractors.js
function base64UrlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
function textToBytes(str) {
  return new TextEncoder().encode(str);
}
async function aesGcmDecrypt(keyBytes, ivB64url, payloadB64url) {
  const iv = base64UrlToBytes(ivB64url);
  const data = base64UrlToBytes(payloadB64url);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, data);
  return new TextDecoder("iso-8859-1").decode(decrypted);
}
async function aesCbcDecrypt(cipherB64, keyStr, ivStr) {
  const keyBytes = textToBytes(keyStr);
  const ivBytes = textToBytes(ivStr);
  const data = base64UrlToBytes(cipherB64);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv: ivBytes }, key, data);
  return new TextDecoder().decode(decrypted);
}
var DOOD_HOSTS = [
  "myvidplay.com",
  "doply.net",
  "playmogo.com",
  "dood.pm",
  "ds2play.com",
  "d000d.com"
];
function isDoodStream(url) {
  return DOOD_HOSTS.some((h) => url.includes(h));
}
async function extractDoodStream(url) {
  try {
    const embedUrl = url.replace("doply.net", "myvidplay.com");
    const refHost = "https://myvidplay.com";
    const html = await fetchText(embedUrl, {
      headers: { "User-Agent": UA, "Referer": refHost }
    });
    const md5Match = html.match(/\/pass_md5\/([^/]*)\/([^/']*)/);
    if (!md5Match)
      return null;
    const [fullPath, expiry, token] = md5Match;
    const md5Url = refHost + fullPath;
    const baseLink = (await fetchText(md5Url, {
      headers: { "User-Agent": UA, "Referer": embedUrl }
    })).trim();
    const directUrl = token && expiry ? `${baseLink}?token=${token}&expiry=${expiry}000` : baseLink;
    return [{
      name: "DoodStream",
      title: "DoodStream",
      url: directUrl,
      quality: "auto",
      headers: { "User-Agent": UA, "Referer": refHost }
    }];
  } catch {
    return null;
  }
}
var FILEMOON_HOSTS = [
  "filemoon.to",
  "filemoon.in",
  "filemoon.sx",
  "bysedikamoum.com",
  "bysezoxexe.com",
  "x08.ovh",
  "javmoon.me"
];
function isFilemoon(url) {
  return FILEMOON_HOSTS.some((h) => url.includes(h));
}
async function extractFilemoon(url) {
  try {
    const mediaId = (url.match(/\/(?:e|d|v|f|download)\/([0-9a-zA-Z]+)/) || [])[1] || url.split("/").filter(Boolean).pop().split("?")[0];
    const host = new URL(url).host;
    const rootRef = `https://${host}/`;
    const embedUrl = `https://${host}/e/${mediaId}`;
    const headers = {
      "User-Agent": UA,
      "Referer": rootRef,
      "Origin": `https://${host}`,
      "X-Requested-With": "XMLHttpRequest"
    };
    try {
      const apiUrl = `https://${host}/api/videos/${mediaId}/embed/playback`;
      const json = await fetchJson(apiUrl, { headers });
      let sources = json.sources;
      if (!sources && json.playback) {
        const pb = json.playback;
        const keyParts = pb.key_parts.map((p) => base64UrlToBytes(p));
        const keyBytes = new Uint8Array(keyParts.reduce((acc, b) => [...acc, ...b], []));
        const plain = await aesGcmDecrypt(keyBytes, pb.iv, pb.payload);
        sources = JSON.parse(plain).sources;
      }
      if (sources && sources.length) {
        return sources.map((s) => ({
          name: "Filemoon",
          title: s.label ? `Filemoon ${s.label}p` : "Filemoon",
          url: s.url,
          quality: s.label || "auto",
          headers: { "Referer": rootRef, "User-Agent": UA }
        }));
      }
    } catch {
    }
    const html = await fetchText(embedUrl, {
      headers: { "User-Agent": UA, "Referer": rootRef }
    });
    const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
    if (sourcesMatch) {
      return [{
        name: "Filemoon",
        title: "Filemoon",
        url: sourcesMatch[1],
        quality: "auto",
        headers: { "Referer": rootRef, "User-Agent": UA }
      }];
    }
    const jwMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
    if (jwMatch) {
      return [{
        name: "Filemoon",
        title: "Filemoon",
        url: jwMatch[1],
        quality: "auto",
        headers: { "Referer": rootRef, "User-Agent": UA }
      }];
    }
    const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
    if (m3u8Match) {
      return [{
        name: "Filemoon",
        title: "Filemoon",
        url: m3u8Match[1],
        quality: "auto",
        headers: { "Referer": rootRef, "User-Agent": UA }
      }];
    }
    return null;
  } catch {
    return null;
  }
}
var LULU_HOSTS = [
  "lulustream.com",
  "luluvid.com",
  "luluvdo.com",
  "luluvdoo.com",
  "lulupvp.com",
  "lulu.dlc.ovh",
  "lulu0.ovh"
];
function isLuluStream(url) {
  return LULU_HOSTS.some((h) => url.includes(h));
}
async function extractLuluStream(url) {
  try {
    const embedUrl = url.includes("/e/") ? url : url.replace("/d/", "/e/");
    const origin = new URL(embedUrl).origin;
    const html = await fetchText(embedUrl, {
      headers: {
        "User-Agent": UA,
        "Referer": url,
        "Origin": origin
      }
    });
    const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
    if (sourcesMatch) {
      return [{
        name: "LuluStream",
        title: "LuluStream",
        url: sourcesMatch[1],
        quality: "auto",
        headers: { "Referer": embedUrl, "Origin": origin, "User-Agent": UA }
      }];
    }
    const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
    if (m3u8Match) {
      return [{
        name: "LuluStream",
        title: "LuluStream",
        url: m3u8Match[1],
        quality: "auto",
        headers: { "Referer": embedUrl, "Origin": origin, "User-Agent": UA }
      }];
    }
    const relMatch = html.match(/["']([^"']+\.m3u8[^"']*)["']/);
    if (relMatch) {
      const videoUrl = relMatch[1].startsWith("http") ? relMatch[1] : `${origin}${relMatch[1].startsWith("/") ? "" : "/"}${relMatch[1]}`;
      return [{
        name: "LuluStream",
        title: "LuluStream",
        url: videoUrl,
        quality: "auto",
        headers: { "Referer": embedUrl, "Origin": origin, "User-Agent": UA }
      }];
    }
    return null;
  } catch {
    return null;
  }
}
var PLAYER4ME_HOSTS = [
  "player4me.online",
  "player4me.vip",
  "rpmplay.online"
];
function isPlayer4Me(url) {
  return PLAYER4ME_HOSTS.some((h) => url.includes(h));
}
async function extractPlayer4Me(url) {
  try {
    const parsedUrl = new URL(url);
    const mainUrl = parsedUrl.origin;
    const id = parsedUrl.hash.slice(1) || parsedUrl.searchParams.get("id") || parsedUrl.pathname.split("/").filter(Boolean).pop();
    const apiUrl = `${mainUrl}/api/v1/video?id=${id}`;
    const raw = (await fetchText(apiUrl, {
      headers: {
        "Host": parsedUrl.host,
        "User-Agent": UA,
        "Accept": "*/*",
        "Cookie": "popunderCount/=1",
        "Referer": mainUrl + "/"
      }
    })).trim();
    if (!raw || raw.startsWith("<"))
      return null;
    try {
      const data = JSON.parse(raw);
      const videoUrl = data.source || data.hls || data.cf || data.url;
      if (videoUrl) {
        return [{
          name: "Player4Me",
          title: "Player4Me",
          url: videoUrl,
          quality: "auto",
          headers: { "User-Agent": UA, "Referer": mainUrl + "/" }
        }];
      }
    } catch {
    }
    const KEYS = [
      { key: "kiemtienmua911ca", iv: "1234567890oiuytr" },
      { key: "kiemtienmua911ab", iv: "1234567890abcdef" }
    ];
    for (const { key, iv } of KEYS) {
      try {
        const plain = await aesCbcDecrypt(raw, key, iv);
        const data = JSON.parse(plain);
        const videoUrl = data.source || data.hls || data.cf || data.url;
        if (videoUrl) {
          return [{
            name: "Player4Me",
            title: "Player4Me",
            url: videoUrl,
            quality: "auto",
            headers: { "User-Agent": UA, "Referer": mainUrl + "/" }
          }];
        }
      } catch {
      }
    }
    return null;
  } catch {
    return null;
  }
}
function isVidguard(url) {
  return url.includes("vidguard.to") || url.includes("listeamed.net") || url.includes("bembed.net");
}
async function extractVidguard(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA, "Referer": "https://vidguard.to/" } });
    const jwMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
    if (jwMatch) {
      return [{
        name: "Vidguard",
        title: "Vidguard",
        url: jwMatch[1],
        quality: "auto",
        headers: { "Referer": "https://vidguard.to/", "User-Agent": UA }
      }];
    }
    const sigMatch = html.match(/sig=([a-fA-F0-9]{20,})/);
    if (sigMatch) {
      let sig = sigMatch[1];
      let t = "";
      for (let i = 0; i < sig.length; i += 2) {
        t += String.fromCharCode(parseInt(sig.slice(i, i + 2), 16) ^ 2);
      }
      try {
        const padding = [0, 0, 2, 1][t.length % 4];
        const decoded = atob(t + "=".repeat(padding));
        let s = decoded.slice(0, -5).split("").reverse().join("");
        const arr = s.split("");
        for (let i = 0; i < arr.length - 1; i += 2) {
          [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        }
        const modifiedSig = arr.join("").slice(0, -5);
        const cdnMatch = html.match(/["'](https?:\/\/[^"']*sig=[a-fA-F0-9]+[^"']*)["']/);
        if (cdnMatch) {
          const streamUrl = cdnMatch[1].replace(sigMatch[1], modifiedSig);
          return [{
            name: "Vidguard",
            title: "Vidguard",
            url: streamUrl,
            quality: "auto",
            headers: { "Referer": "https://vidguard.to/", "User-Agent": UA }
          }];
        }
      } catch {
      }
    }
    const fallback = html.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/);
    if (fallback) {
      return [{
        name: "Vidguard",
        title: "Vidguard",
        url: fallback[1],
        quality: "auto",
        headers: { "Referer": "https://vidguard.to/", "User-Agent": UA }
      }];
    }
    return null;
  } catch {
    return null;
  }
}
function isVidNest(url) {
  return url.includes("vidnest.io") || url.includes("vidnest.net");
}
async function extractVidNest(url) {
  try {
    const host = new URL(url).origin;
    const html = await fetchText(url, {
      headers: { "User-Agent": UA, "Referer": `${host}/` }
    });
    const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
    if (sourcesMatch) {
      const labelMatch = html.match(/label\s*:\s*["']([^"']+)["']/);
      return [{
        name: "VidNest",
        title: `VidNest ${labelMatch?.[1] || ""}`.trim(),
        url: sourcesMatch[1],
        quality: labelMatch?.[1] || "auto",
        headers: { "User-Agent": UA, "Referer": `${host}/`, "Origin": host }
      }];
    }
    const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/);
    if (fileMatch) {
      const labelMatch = html.match(/label\s*:\s*["']([^"']+)["']/);
      return [{
        name: "VidNest",
        title: `VidNest ${labelMatch?.[1] || ""}`.trim(),
        url: fileMatch[1],
        quality: labelMatch?.[1] || "auto",
        headers: { "User-Agent": UA, "Referer": `${host}/`, "Origin": host }
      }];
    }
    return null;
  } catch {
    return null;
  }
}
var STREAMWISH_HOSTS = [
  "streamwish.to",
  "streamhihi.com",
  "javsw.me",
  "swhoi.com",
  "swdyu.com",
  "swhhd.com",
  "awish.net",
  "streamwish.com"
];
function isStreamwish(url) {
  return STREAMWISH_HOSTS.some((h) => url.includes(h));
}
async function extractStreamwish(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA, "Referer": url } });
    const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
    if (sourcesMatch) {
      return [{
        name: "Streamwish",
        title: "Streamwish",
        url: sourcesMatch[1],
        quality: "auto",
        headers: { "User-Agent": UA }
      }];
    }
    const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
    if (fileMatch) {
      return [{
        name: "Streamwish",
        title: "Streamwish",
        url: fileMatch[1],
        quality: "auto",
        headers: { "User-Agent": UA }
      }];
    }
    const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
    if (m3u8Match) {
      return [{
        name: "Streamwish",
        title: "Streamwish",
        url: m3u8Match[1],
        quality: "auto",
        headers: { "User-Agent": UA }
      }];
    }
    return null;
  } catch {
    return null;
  }
}
var VIDHIDE_HOSTS = ["vidhidepro.com", "vidhidevip.com", "javlion.xyz", "vidhide.com"];
function isVidhidepro(url) {
  return VIDHIDE_HOSTS.some((h) => url.includes(h));
}
async function extractVidhidepro(url) {
  try {
    const origin = new URL(url).origin;
    const html = await fetchText(url, {
      headers: { "User-Agent": UA, "Referer": origin + "/" }
    });
    const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
    if (sourcesMatch) {
      return [{
        name: "Vidhidepro",
        title: "Vidhidepro",
        url: sourcesMatch[1],
        quality: "auto",
        headers: { "Referer": origin + "/", "User-Agent": UA }
      }];
    }
    const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
    if (fileMatch) {
      return [{
        name: "Vidhidepro",
        title: "Vidhidepro",
        url: fileMatch[1],
        quality: "auto",
        headers: { "Referer": origin + "/", "User-Agent": UA }
      }];
    }
    const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
    if (m3u8Match) {
      return [{
        name: "Vidhidepro",
        title: "Vidhidepro",
        url: m3u8Match[1],
        quality: "auto",
        headers: { "Referer": origin + "/", "User-Agent": UA }
      }];
    }
    return null;
  } catch {
    return null;
  }
}
function isMaxstream(url) {
  return url.includes("maxstream.org") || url.includes("maxstream.video");
}
async function extractMaxstream(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const directMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
    if (directMatch) {
      return [{
        name: "Maxstream",
        title: "Maxstream",
        url: directMatch[1],
        quality: "auto",
        headers: { "User-Agent": UA }
      }];
    }
    const packed = html.match(/\}\s*\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/)?.[0] || html.match(/function\(p,a,c,k,e,d\)[\s\S]+?(?=<\/script>)/)?.[0];
    if (packed) {
      const decoded = unpackJS(packed);
      if (decoded) {
        const fileMatch = decoded.match(/file\s*:\s*["']([^"']+)["']/);
        if (fileMatch) {
          return [{
            name: "Maxstream",
            title: "Maxstream",
            url: fileMatch[1],
            quality: "auto",
            headers: { "User-Agent": UA }
          }];
        }
      }
    }
    const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
    if (m3u8Match) {
      return [{
        name: "Maxstream",
        title: "Maxstream",
        url: m3u8Match[1],
        quality: "auto",
        headers: { "User-Agent": UA }
      }];
    }
    return null;
  } catch {
    return null;
  }
}
function unpackJS(packed) {
  try {
    const match = packed.match(/\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/);
    if (!match)
      return null;
    const [, p, a, , k] = match;
    const keywords = k.split("|");
    const base = parseInt(a);
    return p.replace(/\b\w+\b/g, (w) => {
      const n = parseInt(w, base);
      return (isNaN(n) ? w : keywords[n]) || w;
    });
  } catch {
    return null;
  }
}
function isJavclan(url) {
  return url.includes("javclan.com");
}
async function extractJavclan(url, referer) {
  try {
    const html = await fetchText(url, {
      headers: { "User-Agent": UA, "Referer": referer || url }
    });
    const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
    if (sourcesMatch) {
      return [{
        name: "Javclan",
        title: "Javclan",
        url: sourcesMatch[1],
        quality: "auto",
        headers: { "Referer": referer || url, "User-Agent": UA }
      }];
    }
    const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
    if (fileMatch) {
      return [{
        name: "Javclan",
        title: "Javclan",
        url: fileMatch[1],
        quality: "auto",
        headers: { "Referer": referer || url, "User-Agent": UA }
      }];
    }
    return null;
  } catch {
    return null;
  }
}
function isJavggvideo(url) {
  return url.includes("javggvideo.xyz") || url.includes("javgg.net");
}
async function extractJavggvideo(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const varPatterns = [
      /var\s+urlPlay\s*=\s*['"]([^'"]+)['"]/,
      /urlPlay\s*=\s*['"]([^'"]+)['"]/,
      /var\s+videoUrl\s*=\s*['"]([^'"]+)['"]/,
      /var\s+streamUrl\s*=\s*['"]([^'"]+)['"]/,
      /var\s+src\s*=\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/
    ];
    for (const pattern of varPatterns) {
      const match = html.match(pattern);
      if (match && match[1].startsWith("http")) {
        return [{
          name: "Javggvideo",
          title: "Javggvideo",
          url: match[1],
          quality: "auto",
          headers: { "User-Agent": UA }
        }];
      }
    }
    const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
    if (sourcesMatch) {
      return [{
        name: "Javggvideo",
        title: "Javggvideo",
        url: sourcesMatch[1],
        quality: "auto",
        headers: { "User-Agent": UA }
      }];
    }
    const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
    if (fileMatch) {
      return [{
        name: "Javggvideo",
        title: "Javggvideo",
        url: fileMatch[1],
        quality: "auto",
        headers: { "User-Agent": UA }
      }];
    }
    const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
    if (m3u8Match) {
      return [{
        name: "Javggvideo",
        title: "Javggvideo",
        url: m3u8Match[1],
        quality: "auto",
        headers: { "User-Agent": UA }
      }];
    }
    return null;
  } catch {
    return null;
  }
}
function isMixDrop(url) {
  return url.includes("mixdrop.") || url.includes("mixdrp.");
}
async function extractMixDrop(url) {
  try {
    const html = await fetchText(url, { headers: { "User-Agent": UA } });
    const packed = html.match(/\}\s*\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/)?.[0];
    if (packed) {
      const decoded = unpackJS(packed);
      if (decoded) {
        const srcMatch = decoded.match(/(?:MDCore\.wurl|wurl)\s*=\s*["']([^"']+)["']/);
        if (srcMatch) {
          const videoUrl = srcMatch[1].startsWith("//") ? "https:" + srcMatch[1] : srcMatch[1];
          return [{
            name: "MixDrop",
            title: "MixDrop",
            url: videoUrl,
            quality: "auto",
            headers: { "User-Agent": UA, "Referer": "https://mixdrop.ag/" }
          }];
        }
      }
    }
    const wurlMatch = html.match(/(?:MDCore\.wurl|wurl)\s*=\s*["']([^"']+)["']/);
    if (wurlMatch) {
      const videoUrl = wurlMatch[1].startsWith("//") ? "https:" + wurlMatch[1] : wurlMatch[1];
      return [{
        name: "MixDrop",
        title: "MixDrop",
        url: videoUrl,
        quality: "auto",
        headers: { "User-Agent": UA, "Referer": "https://mixdrop.ag/" }
      }];
    }
    return null;
  } catch {
    return null;
  }
}
async function extractFromUrl(url, referer) {
  if (isDoodStream(url))
    return extractDoodStream(url);
  if (isFilemoon(url))
    return extractFilemoon(url);
  if (isLuluStream(url))
    return extractLuluStream(url);
  if (isPlayer4Me(url))
    return extractPlayer4Me(url);
  if (isVidguard(url))
    return extractVidguard(url);
  if (isVidNest(url))
    return extractVidNest(url);
  if (isStreamwish(url))
    return extractStreamwish(url);
  if (isVidhidepro(url))
    return extractVidhidepro(url);
  if (isMaxstream(url))
    return extractMaxstream(url);
  if (isJavclan(url))
    return extractJavclan(url, referer);
  if (isJavggvideo(url))
    return extractJavggvideo(url);
  if (isMixDrop(url))
    return extractMixDrop(url);
  return null;
}

// src/shared/filters.js
var BLOCKED_WORDS = [
  "gay",
  "homosexual",
  "queer",
  "homo",
  "androphile",
  "femboy",
  "feminine boy",
  "effeminate",
  "trap",
  "trans",
  "Trade",
  "Vers",
  "Twink",
  "Otter",
  "Bear",
  "Femme",
  "Masc",
  "Serving",
  "Gagged",
  "Twink",
  "Kiki",
  "Kai Kai",
  "Werk",
  "Realness",
  "Hunty",
  "Snatched",
  "Clocked",
  "Shade",
  "Zaddy",
  "Chosen family",
  "Closet case",
  "Henny",
  "Queening out",
  "Slay",
  "Camp",
  "Fishy",
  "Cruising",
  "Bathhouse",
  "Power bottom",
  "Situationship",
  "Pegging",
  "Femdom",
  "futa",
  "tranny",
  "crossdress",
  "Bisexual",
  "Intersex",
  "LGBTQ",
  "TS",
  "TGirl",
  "T-Boy",
  "Transsexual",
  "t-girl",
  "tgirl"
];
var BLOCKED_REGEX = new RegExp(
  `\\b(?:${BLOCKED_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\w*\\b`,
  "i"
);
function isBlocked(title) {
  return BLOCKED_REGEX.test(title);
}

// src/mangoporn/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var BASE_URL = "https://mangoporn.net";
async function searchSite(query) {
  const url = `${BASE_URL}/page/1/?s=${encodeURIComponent(query)}`;
  const html = await fetchText(url);
  const $ = import_cheerio_without_node_native.default.load(html);
  const results = [];
  $("article").each((_, el) => {
    const title = $(el).find("div h3").text().trim();
    const href = $(el).find("div h3 a").attr("href");
    if (title && href && !isBlocked(title)) {
      results.push({ title, href });
    }
  });
  return results;
}
async function getVideoLinks(pageUrl) {
  const html = await fetchText(pageUrl);
  const $ = import_cheerio_without_node_native.default.load(html);
  const links = [];
  $("div#pettabs > ul a").each((_, el) => {
    const href = $(el).attr("href");
    if (href)
      links.push(href);
  });
  return links;
}
async function extractStreams(tmdbId, mediaType, season, episode) {
  const title = await getTitleFromTmdb(tmdbId, mediaType);
  const query = title || String(tmdbId);
  const results = await searchSite(query);
  if (!results.length)
    return [];
  const streams = [];
  for (const result of results.slice(0, 3)) {
    const videoLinks = await getVideoLinks(result.href);
    for (const link of videoLinks) {
      const extracted = await extractFromUrl(link, result.href);
      if (extracted) {
        streams.push(...extracted.map((s) => ({
          ...s,
          title: `[Mangoporn] ${s.title}`
        })));
      }
    }
    if (streams.length > 0)
      break;
  }
  return streams;
}

// src/mangoporn/index.js
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    console.log(`[Mangoporn] Request: ${mediaType} ${tmdbId}`);
    const streams = await extractStreams(tmdbId, mediaType, season, episode);
    return streams;
  } catch (error) {
    console.error(`[Mangoporn] Error: ${error.message}`);
    return [];
  }
}
module.exports = { getStreams };
