var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/shared/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";
var HEADERS = {
  "User-Agent": UA
};
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetch(url, __spreadValues({
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers)
    }, options));
    if (!response.ok)
      throw new Error(`HTTP ${response.status} for ${url}`);
    return response.text();
  });
}
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const raw = yield fetchText(url, options);
    return JSON.parse(raw);
  });
}
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
function getTmdbMetadata(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    try {
      const endpoint = mediaType === "tv" ? `${TMDB_BASE_URL}/tv/${tmdbId}` : `${TMDB_BASE_URL}/movie/${tmdbId}`;
      const res = yield fetch(`${endpoint}?append_to_response=credits&language=en-US&api_key=${TMDB_API_KEY}&include_adult=true`);
      if (!res.ok)
        return null;
      const data = yield res.json();
      const director = mediaType === "movie" ? ((_b = (_a = data.credits) == null ? void 0 : _a.crew) == null ? void 0 : _b.filter((c) => c.job === "Director")) || [] : data.created_by || [];
      const altTitles = [];
      if (data.original_title && data.original_title !== (data.title || data.name))
        altTitles.push(data.original_title);
      if (data.original_language && data.title !== data.original_title) {
      }
      return {
        tmdb: {
          title: data.title || data.name,
          altTitles,
          year: (data.release_date || data.first_air_date || "").split("-")[0],
          runtime: data.runtime || ((_c = data.episode_run_time) == null ? void 0 : _c[0]),
          genres: ((_d = data.genres) == null ? void 0 : _d.map((g) => g.name)) || [],
          cast: ((_f = (_e = data.credits) == null ? void 0 : _e.cast) == null ? void 0 : _f.slice(0, 3)) || [],
          director,
          adult: data.adult,
          rated: (_k = (_j = (_i = (_h = (_g = data.release_dates) == null ? void 0 : _g.results) == null ? void 0 : _h.find((r) => r.iso_3166_1 === "US")) == null ? void 0 : _i.release_dates) == null ? void 0 : _j[0]) == null ? void 0 : _k.certification
        },
        enrichment: {}
        // Placeholder if needed
      };
    } catch (e) {
      return null;
    }
  });
}
function stripAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function normalizeVersion(t) {
  return t.toLowerCase().replace(/\bii\b/g, " 2 ").replace(/\biii\b/g, " 3 ").replace(/\biv\b/g, " 4 ").replace(/\bv\b/g, " 5 ").replace(/\bvi\b/g, " 6 ").replace(/\bvii\b/g, " 7 ").replace(/\bviii\b/g, " 8 ").replace(/\bix\b/g, " 9 ").replace(/\bx\b/g, " 10 ");
}
var NOISE_WORDS = ["vol", "volume", "part", "partie", "season", "saison", "ep", "episode", "s", "and", "the", "a", "an", "de", "du", "des", "la", "le", "les", "un", "une", "en", "au", "aux", "il", "je", "tu", "ma", "mon", "mes", "ton", "ta", "tes", "son", "sa", "ses", "qui", "que", "dont", "o\xF9", "et", "ou", "ne", "pas", "pour", "par", "sur", "avec", "sans", "dans"];
function cleanTitleWords(t) {
  const normalized = normalizeVersion(stripAccents(t));
  return normalized.replace(/\./g, "").replace(/_/g, " ").replace(/['\u2019']/g, "").replace(/([a-z])([0-9])/g, "$1 $2").replace(/([0-9])([a-z])/g, "$1 $2").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word && !NOISE_WORDS.includes(word));
}
function getNumbersFromWords(words) {
  return words.filter((w) => /^\d+$/.test(w));
}
function isTitleMatch(refTitle, mirrorTitle) {
  if (!refTitle || !mirrorTitle)
    return false;
  const w1 = cleanTitleWords(refTitle);
  const w2 = cleanTitleWords(mirrorTitle);
  if (w1.length === 0 || w2.length === 0)
    return false;
  const n1 = getNumbersFromWords(w1);
  const n2 = getNumbersFromWords(w2);
  if (n1.length > 0 || n2.length > 0) {
    if (n1.length !== n2.length)
      return false;
    if (!n1.every((v, i) => v === n2[i]))
      return false;
  }
  const lenDiff = Math.abs(w1.length - w2.length);
  const maxLen = Math.max(w1.length, w2.length);
  if (lenDiff / maxLen > 0.4)
    return false;
  const norm = (words) => words.map((w) => w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
  const nw1 = norm(w1);
  const nw2 = norm(w2);
  const containsAll = (source, target) => target.every((word) => source.includes(word));
  const shorterNw = nw1.length <= nw2.length ? nw1 : nw2;
  const longerNw = nw1.length <= nw2.length ? nw2 : nw1;
  if (containsAll(longerNw, shorterNw)) {
    if (shorterNw.length >= 3 || longerNw.length - shorterNw.length <= 1)
      return true;
  }
  if (containsAll(nw1, nw2) || containsAll(nw2, nw1)) {
    const sLen = Math.min(nw1.length, nw2.length);
    const lLen = Math.max(nw1.length, nw2.length);
    if (sLen >= 3 || lLen - sLen <= 1)
      return true;
  }
  const joined1 = nw1.join("");
  const joined2 = nw2.join("");
  if (joined1 === joined2)
    return true;
  if (joined1.length > 5 && joined2.length > 5 && (joined1.startsWith(joined2) || joined2.startsWith(joined1)))
    return true;
  if (nw1.length >= 3 && nw2.length >= 3 && Math.abs(nw1.length - nw2.length) <= 1) {
    const shorter = nw1.length <= nw2.length ? nw1 : nw2;
    const longer = nw1.length <= nw2.length ? nw2 : nw1;
    const shorterJoined = shorter.join(" ");
    const longerJoined = longer.join(" ");
    if (shorterJoined.length > 5 && longerJoined.includes(shorterJoined))
      return true;
  }
  return false;
}
function findBestMatch(tmdbTitle, searchResults, referenceYear = null, altTitles = []) {
  if (!tmdbTitle || !searchResults || searchResults.length === 0)
    return null;
  const refTitles = [tmdbTitle, ...altTitles];
  for (const result of searchResults) {
    const siteTitle = result.title || "";
    if (referenceYear) {
      const yearInSite = siteTitle.match(/\b(19|20)\d{2}\b/);
      if (yearInSite && yearInSite[0] !== String(referenceYear)) {
        continue;
      }
    }
    for (const ref of refTitles) {
      if (isTitleMatch(ref, siteTitle)) {
        return { result, score: 1 };
      }
    }
  }
  return null;
}
function generateQueryVariants(title) {
  if (!title)
    return [];
  const variants = [title];
  const cleaned = title.replace(/\s*\(\d{4}\)/g, "").trim();
  if (cleaned !== title)
    variants.push(cleaned);
  const stripped = stripAccents(cleaned);
  if (stripped !== cleaned)
    variants.push(stripped);
  variants.push(cleaned.replace(/\s+/g, "-"));
  return [...new Set(variants.filter((v) => v.length >= 3))];
}

// src/shared/extractors.js
var import_crypto_js = __toESM(require("crypto-js"));
function aesCbcDecrypt(cipherHexOrB64, keyStr, ivStr) {
  const normalized = cipherHexOrB64.replace(/-/g, "+").replace(/_/g, "/");
  const key = import_crypto_js.default.enc.Utf8.parse(keyStr);
  const iv = import_crypto_js.default.enc.Utf8.parse(ivStr);
  const isHex = /^[0-9a-fA-F]+$/.test(normalized);
  const cipherParams = isHex ? import_crypto_js.default.lib.CipherParams.create({ ciphertext: import_crypto_js.default.enc.Hex.parse(normalized) }) : normalized;
  const decrypted = import_crypto_js.default.AES.decrypt(cipherParams, key, {
    iv,
    mode: import_crypto_js.default.mode.CBC,
    padding: import_crypto_js.default.pad.Pkcs7
  });
  return decrypted.toString(import_crypto_js.default.enc.Utf8);
}
var DOOD_HOSTS = [
  "myvidplay.com",
  "doply.net",
  "playmogo.com",
  "dood.pm",
  "ds2play.com",
  "d000d.com",
  "doodstream.com",
  "dood.to",
  "dood.watch",
  "dooood.com",
  "doodad.pro",
  "dood.wf",
  "dood.cx",
  "dood.la",
  "dood.sh",
  "dood.re",
  "dood.so",
  "dood.yt",
  "dood.stream",
  "doodcdn.com",
  "doods.pro"
];
function isDoodStream(url) {
  return DOOD_HOSTS.some((h) => url.includes(h));
}
function extractDoodStream(url) {
  return __async(this, null, function* () {
    try {
      const embedUrl = url.replace("d000d.com", "doodstream.com");
      const embedOrigin = new URL(embedUrl).origin;
      const html = yield fetchText(embedUrl, {
        headers: {
          "User-Agent": UA,
          "Referer": embedOrigin + "/",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        }
      });
      const md5Match = html.match(/\/pass_md5\/([^/]*)\/([^/']*)/);
      if (!md5Match)
        return null;
      const [fullPath, expiry, token] = md5Match;
      const md5Url = embedOrigin + fullPath;
      const baseLink = (yield fetchText(md5Url, {
        headers: { "User-Agent": UA, "Referer": embedUrl }
      })).trim();
      const directUrl = token && expiry ? `${baseLink}?token=${token}&expiry=${expiry}000` : baseLink;
      return [{
        name: "DoodStream",
        title: "DoodStream",
        url: directUrl,
        quality: "auto",
        headers: { "User-Agent": UA, "Referer": embedOrigin + "/" }
      }];
    } catch (e) {
      return null;
    }
  });
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
function extractFilemoon(url) {
  return __async(this, null, function* () {
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
        const json = yield fetchJson(apiUrl, { headers });
        const sources = json.sources;
        if (sources && sources.length) {
          return sources.map((s) => ({
            name: "Filemoon",
            title: s.label ? `Filemoon ${s.label}p` : "Filemoon",
            url: s.url,
            quality: s.label || "auto",
            headers: { "Referer": rootRef, "User-Agent": UA }
          }));
        }
      } catch (e) {
      }
      const html = yield fetchText(embedUrl, {
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
    } catch (e) {
      return null;
    }
  });
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
function extractLuluStream(url) {
  return __async(this, null, function* () {
    var _a, _b;
    try {
      const embedUrl = url.includes("/e/") ? url : url.replace("/d/", "/e/");
      const origin = new URL(embedUrl).origin;
      const html = yield fetchText(embedUrl, {
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
      const m3u8Direct = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
      if (m3u8Direct) {
        return [{
          name: "LuluStream",
          title: "LuluStream",
          url: m3u8Direct[1],
          quality: "auto",
          headers: { "Referer": embedUrl, "Origin": origin, "User-Agent": UA }
        }];
      }
      const packedBlock = ((_a = html.match(/\}\s*\('[\s\S]+?'\s*\.split\('\|'\)\s*\)\s*\)/)) == null ? void 0 : _a[0]) || ((_b = html.match(/\}\s*\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)/)) == null ? void 0 : _b[0]);
      if (packedBlock) {
        const decoded = unpackJS(packedBlock);
        if (decoded) {
          const fileInPacked = decoded.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/);
          const m3u8InPacked = decoded.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
          const videoUrl = (fileInPacked == null ? void 0 : fileInPacked[1]) || (m3u8InPacked == null ? void 0 : m3u8InPacked[1]);
          if (videoUrl) {
            return [{
              name: "LuluStream",
              title: "LuluStream",
              url: videoUrl,
              quality: "auto",
              headers: { "Referer": embedUrl, "Origin": origin, "User-Agent": UA }
            }];
          }
        }
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
    } catch (e) {
      return null;
    }
  });
}
var PLAYER4ME_HOSTS = [
  "player4me.online",
  "player4me.vip",
  "rpmplay.online",
  "seekplayer.vip",
  "embedseek.online",
  "easyvidplayer.com"
];
function isPlayer4Me(url) {
  return PLAYER4ME_HOSTS.some((h) => url.includes(h));
}
function extractPlayer4Me(url) {
  return __async(this, null, function* () {
    try {
      const parsedUrl = new URL(url);
      const mainUrl = parsedUrl.origin;
      const id = parsedUrl.hash.slice(1) || parsedUrl.searchParams.get("id") || parsedUrl.pathname.split("/").filter(Boolean).pop();
      const apiUrl = `${mainUrl}/api/v1/video?id=${id}`;
      const raw = (yield fetchText(apiUrl, {
        headers: {
          "Host": parsedUrl.host,
          "User-Agent": UA,
          "Accept": "*/*",
          "Cookie": "popunderCount/=1",
          "Referer": mainUrl + "/",
          "Origin": mainUrl
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
      } catch (e) {
      }
      const KEYS = [
        { key: "kiemtienmua911ca", iv: "1234567890oiuytr" },
        { key: "kiemtienmua911ab", iv: "1234567890abcdef" }
      ];
      for (const { key, iv } of KEYS) {
        try {
          const plain = yield aesCbcDecrypt(raw, key, iv);
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
        } catch (e) {
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function isVidguard(url) {
  return url.includes("vidguard.to") || url.includes("listeamed.net") || url.includes("bembed.net");
}
function extractVidguard(url) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url, { headers: { "User-Agent": UA, "Referer": "https://vidguard.to/" } });
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
        } catch (e) {
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
    } catch (e) {
      return null;
    }
  });
}
function isVidNest(url) {
  return url.includes("vidnest.io") || url.includes("vidnest.net");
}
function extractVidNest(url) {
  return __async(this, null, function* () {
    try {
      const host = new URL(url).origin;
      const html = yield fetchText(url, {
        headers: { "User-Agent": UA, "Referer": `${host}/` }
      });
      const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
      if (sourcesMatch) {
        const labelMatch = html.match(/label\s*:\s*["']([^"']+)["']/);
        return [{
          name: "VidNest",
          title: `VidNest ${(labelMatch == null ? void 0 : labelMatch[1]) || ""}`.trim(),
          url: sourcesMatch[1],
          quality: (labelMatch == null ? void 0 : labelMatch[1]) || "auto",
          headers: { "User-Agent": UA, "Referer": `${host}/`, "Origin": host }
        }];
      }
      const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/);
      if (fileMatch) {
        const labelMatch = html.match(/label\s*:\s*["']([^"']+)["']/);
        return [{
          name: "VidNest",
          title: `VidNest ${(labelMatch == null ? void 0 : labelMatch[1]) || ""}`.trim(),
          url: fileMatch[1],
          quality: (labelMatch == null ? void 0 : labelMatch[1]) || "auto",
          headers: { "User-Agent": UA, "Referer": `${host}/`, "Origin": host }
        }];
      }
      return null;
    } catch (e) {
      return null;
    }
  });
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
function extractStreamwish(url) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url, { headers: { "User-Agent": UA, "Referer": url } });
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
    } catch (e) {
      return null;
    }
  });
}
var VIDHIDE_HOSTS = ["vidhidepro.com", "vidhidevip.com", "javlion.xyz", "vidhide.com"];
function isVidhidepro(url) {
  return VIDHIDE_HOSTS.some((h) => url.includes(h));
}
function extractVidhidepro(url) {
  return __async(this, null, function* () {
    try {
      const origin = new URL(url).origin;
      const html = yield fetchText(url, {
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
    } catch (e) {
      return null;
    }
  });
}
function isMaxstream(url) {
  return url.includes("maxstream.org") || url.includes("maxstream.video");
}
function extractMaxstream(url) {
  return __async(this, null, function* () {
    var _a, _b;
    try {
      const html = yield fetchText(url, { headers: { "User-Agent": UA } });
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
      const packed = ((_a = html.match(/\}\s*\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/)) == null ? void 0 : _a[0]) || ((_b = html.match(/function\(p,a,c,k,e,d\)[\s\S]+?(?=<\/script>)/)) == null ? void 0 : _b[0]);
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
    } catch (e) {
      return null;
    }
  });
}
function unpackJS(packed) {
  try {
    const match = packed.match(/\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)/) || packed.match(/\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/);
    if (!match)
      return null;
    const [, p, a, , k] = match;
    const keywords = k.split("|");
    const base = parseInt(a);
    return p.replace(/\b\w+\b/g, (w) => {
      const n = parseInt(w, base);
      return (isNaN(n) ? w : keywords[n]) || w;
    });
  } catch (e) {
    return null;
  }
}
function isJavclan(url) {
  return url.includes("javclan.com");
}
function extractJavclan(url, referer) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url, {
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
    } catch (e) {
      return null;
    }
  });
}
function isJavggvideo(url) {
  return url.includes("javggvideo.xyz") || url.includes("javgg.net");
}
function extractJavggvideo(url) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url, { headers: { "User-Agent": UA } });
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
    } catch (e) {
      return null;
    }
  });
}
function isMixDrop(url) {
  return url.includes("mixdrop.") || url.includes("mixdrp.");
}
function extractMixDrop(url) {
  return __async(this, null, function* () {
    var _a;
    try {
      const html = yield fetchText(url, { headers: { "User-Agent": UA } });
      const packed = (_a = html.match(/\}\s*\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/)) == null ? void 0 : _a[0];
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
    } catch (e) {
      return null;
    }
  });
}
var STREAMTAPE_HOSTS = [
  "streamtape.com",
  "streamtape.to",
  "streamtape.net",
  "streamtape.xyz",
  "streamtape.site",
  "shavetape.cash",
  "tapecontent.net"
];
function isStreamtape(url) {
  return STREAMTAPE_HOSTS.some((h) => url.includes(h));
}
function extractStreamtape(url) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url, { headers: { "User-Agent": UA, "Referer": url } });
      const stRegex = /getElementById\(['"](?:robotlink|botlink|ideoolink)['"]\)[^.]*\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*\(['"]([^'"]+)['"]\)((?:\.substring\(\d+\))*)/g;
      let stMatch, lastMatch;
      while ((stMatch = stRegex.exec(html)) !== null)
        lastMatch = stMatch;
      if (lastMatch) {
        let [, part1, raw2, substrs] = lastMatch;
        const subNums = substrs.match(/\d+/g) || [];
        for (const n of subNums)
          raw2 = raw2.substring(parseInt(n));
        const raw = (part1 + raw2).replace(/\s/g, "");
        const videoUrl = raw.startsWith("http") ? raw : raw.startsWith("//") ? "https:" + raw : raw.startsWith("/") ? "https://streamtape.com" + raw : "https://" + raw;
        return [{
          name: "StreamTape",
          title: "StreamTape",
          url: videoUrl,
          quality: "auto",
          headers: { "User-Agent": UA, "Referer": url }
        }];
      }
      const robotDiv = html.match(/id=["']robotlink["'][^>]*>([^<]+)</);
      if (robotDiv) {
        const raw = robotDiv[1].trim();
        const videoUrl = raw.startsWith("//") ? "https:" + raw : raw.startsWith("/") ? "https://streamtape.com" + raw : raw;
        if (videoUrl.includes("streamtape") || videoUrl.includes("get_video")) {
          return [{
            name: "StreamTape",
            title: "StreamTape",
            url: videoUrl,
            quality: "auto",
            headers: { "User-Agent": UA, "Referer": url }
          }];
        }
      }
      const mp4Match = html.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/);
      if (mp4Match) {
        return [{
          name: "StreamTape",
          title: "StreamTape",
          url: mp4Match[1],
          quality: "auto",
          headers: { "User-Agent": UA, "Referer": url }
        }];
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
var VOE_HOSTS = [
  "voe.sx",
  "voe.bar",
  "voe.stream",
  "voeun.net",
  "voeus.com",
  "volescalen.com",
  "voecarriage.com",
  "voefence.com",
  "voeshine.com"
];
var VOE_UNPROTECTED_MIRRORS = [
  "garylargeavailable.com",
  "bryantenunder.com"
];
function rot13(str) {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c >= 65 && c <= 90)
      c = (c - 65 + 13) % 26 + 65;
    else if (c >= 97 && c <= 122)
      c = (c - 97 + 13) % 26 + 97;
    out += String.fromCharCode(c);
  }
  return out;
}
function decodeVoe(encodedStr) {
  try {
    let rot = rot13(encodedStr);
    const separators = ["@\\$", "\\^\\^", "~@", "%\\?", "\\*~", "!!", "#&"];
    separators.forEach((sep) => {
      rot = rot.replace(new RegExp(sep, "g"), "");
    });
    let b64 = atob(rot);
    let shifted = "";
    for (let i = 0; i < b64.length; i++) {
      shifted += String.fromCharCode(b64.charCodeAt(i) - 3);
    }
    let reversed = shifted.split("").reverse().join("");
    let finalJson = decodeURIComponent(escape(atob(reversed)));
    return JSON.parse(finalJson);
  } catch (e) {
    return null;
  }
}
function isVoe(url) {
  return VOE_HOSTS.some((h) => url.includes(h));
}
function extractVoe(url) {
  return __async(this, null, function* () {
    const mediaId = (url.match(/\/e\/([a-zA-Z0-9]+)/) || [])[1];
    if (!mediaId)
      return null;
    const candidates = [url, ...VOE_UNPROTECTED_MIRRORS.map((h) => `https://${h}/e/${mediaId}`)];
    for (const candidateUrl of candidates) {
      try {
        const origin = new URL(candidateUrl).origin;
        const html = yield fetchText(candidateUrl, {
          headers: {
            "User-Agent": UA,
            "Referer": candidateUrl,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        });
        if (html.includes("ddos-guard") || html.includes("DDoS-Guard")) {
          continue;
        }
        const jsRedirectMatch = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/) || html.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (jsRedirectMatch) {
          const nextUrl = jsRedirectMatch[1];
          const nextOrigin = new URL(nextUrl).origin;
          const nextHtml = yield fetchText(nextUrl, {
            headers: {
              "User-Agent": UA,
              "Referer": candidateUrl,
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
          });
          if (nextHtml.includes("ddos-guard") || nextHtml.includes("DDoS-Guard"))
            continue;
          const jsonMatch2 = nextHtml.match(/<script type="application\/json">\["([^"]+)"\]<\/script>/);
          if (jsonMatch2) {
            const decoded = decodeVoe(jsonMatch2[1]);
            if (decoded && decoded.source) {
              return [{
                name: "VOE",
                title: "VOE",
                url: decoded.source,
                quality: decoded.quality || "auto",
                headers: { "Referer": nextOrigin + "/", "User-Agent": UA }
              }];
            }
          }
        }
        const jsonMatch = html.match(/<script type="application\/json">\["([^"]+)"\]<\/script>/);
        if (jsonMatch) {
          const decoded = decodeVoe(jsonMatch[1]);
          if (decoded && decoded.source) {
            return [{
              name: "VOE",
              title: "VOE",
              url: decoded.source,
              quality: decoded.quality || "auto",
              headers: { "Referer": origin + "/", "User-Agent": UA }
            }];
          }
        }
        const hlsMatch = html.match(/['"]hls['"]\s*:\s*['"]([^'"]+)['"]/);
        if (hlsMatch) {
          return [{
            name: "VOE",
            title: "VOE",
            url: hlsMatch[1],
            quality: "auto",
            headers: { "Referer": origin + "/", "User-Agent": UA }
          }];
        }
        const packed = html.match(new RegExp("eval\\(function\\(p,a,c,k,e,[rd]\\).*?\\}\\(.*\\)\\)", "s"));
        if (packed) {
          const unpacked = unpackJS(packed[0]);
          if (unpacked) {
            const m3u8InPacked = unpacked.match(/['"]hls['"]\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/) || unpacked.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/) || unpacked.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
            if (m3u8InPacked) {
              return [{
                name: "VOE",
                title: "VOE",
                url: m3u8InPacked[1],
                quality: "auto",
                headers: { "Referer": origin + "/", "User-Agent": UA }
              }];
            }
          }
        }
      } catch (e) {
      }
    }
    return null;
  });
}
var ALL_KNOWN_HOSTS = [
  ...DOOD_HOSTS,
  ...FILEMOON_HOSTS,
  ...LULU_HOSTS,
  ...PLAYER4ME_HOSTS,
  "vidguard.to",
  "listeamed.net",
  "bembed.net",
  "vidnest.io",
  "vidnest.net",
  ...STREAMWISH_HOSTS,
  ...VIDHIDE_HOSTS,
  "maxstream.org",
  "maxstream.video",
  "javclan.com",
  "javggvideo.xyz",
  "javgg.net",
  "mixdrop.",
  "mixdrp.",
  ...STREAMTAPE_HOSTS,
  ...VOE_HOSTS
];
function isKnownEmbedHost(url) {
  try {
    return ALL_KNOWN_HOSTS.some((h) => url.includes(h));
  } catch (e) {
    return false;
  }
}
function extractFromUrl(url, referer) {
  return __async(this, null, function* () {
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
    if (isStreamtape(url))
      return extractStreamtape(url);
    if (isVoe(url))
      return extractVoe(url);
    return null;
  });
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

// src/shared/utils.js
function formatStreamLabel(siteName, providerName, quality) {
  const res = quality ? quality.toUpperCase() : "AUTO";
  return `${res} \u2022 ${siteName} \u2022 ${providerName}`;
}
function formatTooltip(meta, siteName, res) {
  if (!meta || !meta.tmdb)
    return null;
  const { tmdb } = meta;
  const titleLine = tmdb.title || "";
  const runtimeLine = tmdb.runtime ? `\u23F1\uFE0F ${tmdb.runtime} min` : "";
  const directorLine = tmdb.director && tmdb.director[0] ? `\u{1F3AC} ${tmdb.director[0].name}` : "";
  const castLine = tmdb.cast && tmdb.cast.length > 0 ? `\u{1F465} ${tmdb.cast.map((c) => c.name).join(", ")}` : "";
  const genreLine = tmdb.genres && tmdb.genres.length > 0 ? `\u{1F3AD} ${tmdb.genres.join(", ")}` : "";
  const adultLabels = [];
  if (tmdb.adult)
    adultLabels.push("adult:true");
  if (tmdb.rated)
    adultLabels.push(`rated:${tmdb.rated}`);
  if (adultLabels.length === 0)
    adultLabels.push("adult:true");
  const warningLine = `\u{1F51E} ${adultLabels.join(" \u2502 ")}`;
  const descParts = [
    titleLine,
    `${res.toUpperCase()} ${runtimeLine ? " \u2502 " + runtimeLine : ""}`,
    `\u{1F310} Source: ${siteName}`,
    warningLine,
    genreLine,
    directorLine,
    castLine,
    `\u2705 Verified`
  ].filter(Boolean);
  return descParts.join("\n");
}

// src/mangoporn/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var BASE_URL = "https://mangoporn.net";
function searchSite(query) {
  return __async(this, null, function* () {
    const url = `${BASE_URL}/page/1/?s=${encodeURIComponent(query)}`;
    const html = yield fetchText(url);
    const $ = import_cheerio_without_node_native.default.load(html);
    const results = [];
    $("article").each((_, el) => {
      const title = $(el).find("div.details a").first().text().trim() || $(el).find("div h3").text().trim() || $(el).find("h2").text().trim();
      const href = $(el).find("div.image a").attr("href") || $(el).find("div.details a").attr("href") || $(el).find("h3 a").attr("href") || $(el).find("a").first().attr("href");
      if (title && href && !isBlocked(title)) {
        results.push({ title, href });
      }
    });
    if (!results.length) {
      $("div.ml-item, article, div.item, div.post, div.video-item").each((_, el) => {
        const title = $(el).find("h2, h3, .title").first().text().trim();
        const href = $(el).find("a").first().attr("href");
        if (title && href && href.startsWith("http") && !isBlocked(title)) {
          results.push({ title, href });
        }
      });
    }
    return results;
  });
}
function getVideoLinks(pageUrl) {
  return __async(this, null, function* () {
    const html = yield fetchText(pageUrl);
    const $ = import_cheerio_without_node_native.default.load(html);
    const links = /* @__PURE__ */ new Set();
    $("div#pettabs > ul a").each((_, el) => {
      const href = $(el).attr("href");
      if (href && href.startsWith("http"))
        links.add(href);
    });
    if (!links.size) {
      const selectors = [
        "div#pettabs a",
        "#pettabs a",
        "div.Rtable1-cell a",
        "div.Rtable1 a",
        "div.servers a",
        "div.embed-links a",
        "div.tabs a",
        "div.player-links a",
        "ul.servers-list a"
      ];
      for (const sel of selectors) {
        $(sel).each((_, el) => {
          const href = $(el).attr("href");
          if (href && href.startsWith("http"))
            links.add(href);
        });
        if (links.size)
          break;
      }
    }
    if (!links.size) {
      $("li[data-fl-url]").each((_, el) => {
        const href = $(el).attr("data-fl-url");
        if (href && href.startsWith("http"))
          links.add(href);
      });
    }
    if (!links.size) {
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (href.startsWith("http") && isKnownEmbedHost(href))
          links.add(href);
      });
    }
    return [...links];
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var _a, _b, _c;
    const meta = yield getTmdbMetadata(tmdbId, mediaType);
    const tmdbTitle = ((_a = meta == null ? void 0 : meta.tmdb) == null ? void 0 : _a.title) || String(tmdbId);
    const referenceYear = (_b = meta == null ? void 0 : meta.tmdb) == null ? void 0 : _b.year;
    const altTitles = ((_c = meta == null ? void 0 : meta.tmdb) == null ? void 0 : _c.altTitles) || [];
    const queries = generateQueryVariants(tmdbTitle);
    const searchPromises = queries.map((q) => searchSite(q).catch(() => []));
    const allSearchResults = yield Promise.all(searchPromises);
    const allResults = [].concat(...allSearchResults);
    const uniqueResults = Array.from(new Map(allResults.map((r) => [r.href, r])).values());
    if (!uniqueResults.length)
      return [];
    let bestResult = null;
    if (tmdbTitle) {
      const match = findBestMatch(tmdbTitle, uniqueResults, referenceYear, altTitles);
      if (match) {
        bestResult = match.result;
        console.log(`[Mangoporn] Match: "${bestResult.title}"`);
      }
    }
    if (!bestResult) {
      console.log(`[Mangoporn] No match for "${tmdbTitle}"`);
      return [];
    }
    const videoLinks = yield getVideoLinks(bestResult.href);
    const streamPromises = videoLinks.map((link) => __async(this, null, function* () {
      try {
        const extracted = yield extractFromUrl(link, BASE_URL + "/");
        if (extracted) {
          return extracted.map((s) => __spreadProps(__spreadValues({}, s), {
            name: formatStreamLabel("Mangoporn", s.name, s.quality),
            title: formatTooltip(meta, "Mangoporn", s.quality) || `[Mangoporn] ${s.title}`
          }));
        }
      } catch (e) {
      }
      return [];
    }));
    const nestedStreams = yield Promise.all(streamPromises);
    return [].concat(...nestedStreams);
  });
}

// src/mangoporn/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[Mangoporn] Request: ${mediaType} ${tmdbId}`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[Mangoporn] Error: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
