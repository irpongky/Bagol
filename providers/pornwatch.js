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
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
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
var require_http = __commonJS({
  "src/shared/http.js"(exports2, module2) {
    var UA2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";
    var HEADERS = { "User-Agent": UA2 };
    var DEFAULT_TIMEOUT_MS = 1e4;
    var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
    var TMDB_BASE_URL = "https://api.themoviedb.org/3";
    function fetchWithRetry(_0) {
      return __async(this, arguments, function* (url, options = {}, retries = 3) {
        const controller = new AbortController();
        const _a = options, { timeout, signal: _ignored, headers: optHeaders } = _a, restOpts = __objRest(_a, ["timeout", "signal", "headers"]);
        const timer = setTimeout(() => controller.abort(), timeout || DEFAULT_TIMEOUT_MS);
        try {
          const response = yield fetch(url, __spreadProps(__spreadValues({}, restOpts), {
            headers: __spreadValues(__spreadValues({}, HEADERS), optHeaders),
            signal: controller.signal
          }));
          if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
          return response;
        } catch (e) {
          if (retries > 0 && (e.name === "AbortError" || e.message.includes("HTTP 429"))) {
            yield new Promise((r) => setTimeout(r, 1e3 * (4 - retries)));
            return fetchWithRetry(url, options, retries - 1);
          }
          throw e;
        } finally {
          clearTimeout(timer);
        }
      });
    }
    function fetchText3(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        const response = yield fetchWithRetry(url, options);
        return response.text();
      });
    }
    function fetchJson2(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        const raw = yield fetchText3(url, options);
        return JSON.parse(raw);
      });
    }
    function getTitleFromTmdb(tmdbId, mediaType) {
      return __async(this, null, function* () {
        if (!tmdbId) return null;
        const types = mediaType === "tv" ? ["tv", "movie"] : ["movie", "tv"];
        for (const type of types) {
          try {
            const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?language=en-US&api_key=${TMDB_API_KEY}&include_adult=true`;
            const res = yield fetchWithRetry(url, { timeout: 8e3 }, 2);
            const data = yield res.json();
            const title = data.title || data.name || null;
            if (title) return { title, type, data };
          } catch (e) {
          }
        }
        return null;
      });
    }
    function resolveMetadata2(id, mediaType) {
      return __async(this, null, function* () {
        if (!id) return { title: null, id: null };
        const idStr = String(id);
        if (idStr.startsWith("tt")) {
          try {
            const url = `${TMDB_BASE_URL}/find/${idStr}?external_source=imdb_id&api_key=${TMDB_API_KEY}&include_adult=true`;
            const res = yield fetchWithRetry(url, { timeout: 8e3 }, 2);
            const data = yield res.json();
            const movieResults = data.movie_results || [];
            const tvResults = data.tv_results || [];
            if (mediaType === "tv" && tvResults.length > 0) {
              const tv = tvResults[0];
              return { title: tv.name, id: tv.id, type: "tv" };
            }
            if (movieResults.length > 0) {
              const movie = movieResults[0];
              return { title: movie.title, id: movie.id, type: "movie" };
            }
            if (tvResults.length > 0) {
              const tv = tvResults[0];
              return { title: tv.name, id: tv.id, type: "tv" };
            }
            return { title: idStr, id: idStr, type: mediaType || "movie" };
          } catch (e) {
            return { title: idStr, id: idStr, type: mediaType || "movie" };
          }
        }
        if (idStr.startsWith("tmdb:")) {
          const parts = idStr.split(":");
          let tmdbId = parts[parts.length - 1];
          let type = mediaType;
          if (parts.length >= 3) {
            type = parts[1];
          }
          const result2 = yield getTitleFromTmdb(tmdbId, type);
          if (result2) {
            return { title: result2.title, id: tmdbId, type: result2.type };
          }
          return { title: null, id: tmdbId, type: type || "movie" };
        }
        const result = yield getTitleFromTmdb(idStr, mediaType);
        if (result) {
          return { title: result.title, id: idStr, type: result.type };
        }
        return { title: null, id: idStr, type: mediaType || "movie" };
      });
    }
    if (typeof module2 !== "undefined" && module2.exports) {
      module2.exports = { fetchText: fetchText3, fetchJson: fetchJson2, getTitleFromTmdb, resolveMetadata: resolveMetadata2, TMDB_API_KEY, TMDB_BASE_URL };
    }
  }
});

// src/pornwatch/extractor.js
var import_http2 = __toESM(require_http());

// src/shared/extractors.js
var import_http = __toESM(require_http());
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
      const html = yield (0, import_http.fetchText)(embedUrl, {
        headers: {
          "User-Agent": import_http.UA,
          "Referer": embedOrigin + "/",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        }
      });
      const md5Match = html.match(/\/pass_md5\/([^/]*)\/([^/']*)/);
      if (!md5Match) return null;
      const [fullPath, expiry, token] = md5Match;
      const md5Url = embedOrigin + fullPath;
      const baseLink = (yield (0, import_http.fetchText)(md5Url, {
        headers: { "User-Agent": import_http.UA, "Referer": embedUrl }
      })).trim();
      const directUrl = token && expiry ? `${baseLink}?token=${token}&expiry=${expiry}000` : baseLink;
      return [{
        name: "DoodStream",
        title: "DoodStream",
        url: directUrl,
        quality: "auto",
        headers: { "User-Agent": import_http.UA, "Referer": embedOrigin + "/" }
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
        "User-Agent": import_http.UA,
        "Referer": rootRef,
        "Origin": `https://${host}`,
        "X-Requested-With": "XMLHttpRequest"
      };
      try {
        const apiUrl = `https://${host}/api/videos/${mediaId}/embed/playback`;
        const json = yield (0, import_http.fetchJson)(apiUrl, { headers });
        const sources = json.sources;
        if (sources && sources.length) {
          return sources.map((s) => ({
            name: "Filemoon",
            title: s.label ? `Filemoon ${s.label}p` : "Filemoon",
            url: s.url,
            quality: s.label || "auto",
            headers: { "Referer": rootRef, "User-Agent": import_http.UA }
          }));
        }
      } catch (e) {
      }
      const html = yield (0, import_http.fetchText)(embedUrl, {
        headers: { "User-Agent": import_http.UA, "Referer": rootRef }
      });
      const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
      if (sourcesMatch) {
        return [{
          name: "Filemoon",
          title: "Filemoon",
          url: sourcesMatch[1],
          quality: "auto",
          headers: { "Referer": rootRef, "User-Agent": import_http.UA }
        }];
      }
      const jwMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
      if (jwMatch) {
        return [{
          name: "Filemoon",
          title: "Filemoon",
          url: jwMatch[1],
          quality: "auto",
          headers: { "Referer": rootRef, "User-Agent": import_http.UA }
        }];
      }
      const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
      if (m3u8Match) {
        return [{
          name: "Filemoon",
          title: "Filemoon",
          url: m3u8Match[1],
          quality: "auto",
          headers: { "Referer": rootRef, "User-Agent": import_http.UA }
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
      const html = yield (0, import_http.fetchText)(embedUrl, {
        headers: {
          "User-Agent": import_http.UA,
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
          headers: { "Referer": embedUrl, "Origin": origin, "User-Agent": import_http.UA }
        }];
      }
      const m3u8Direct = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
      if (m3u8Direct) {
        return [{
          name: "LuluStream",
          title: "LuluStream",
          url: m3u8Direct[1],
          quality: "auto",
          headers: { "Referer": embedUrl, "Origin": origin, "User-Agent": import_http.UA }
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
              headers: { "Referer": embedUrl, "Origin": origin, "User-Agent": import_http.UA }
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
          headers: { "Referer": embedUrl, "Origin": origin, "User-Agent": import_http.UA }
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
      const raw = (yield (0, import_http.fetchText)(apiUrl, {
        headers: {
          "Host": parsedUrl.host,
          "User-Agent": import_http.UA,
          "Accept": "*/*",
          "Cookie": "popunderCount/=1",
          "Referer": mainUrl + "/",
          "Origin": mainUrl
        }
      })).trim();
      if (!raw || raw.startsWith("<")) return null;
      try {
        const data = JSON.parse(raw);
        const videoUrl = data.source || data.hls || data.cf || data.url;
        if (videoUrl) {
          return [{
            name: "Player4Me",
            title: "Player4Me",
            url: videoUrl,
            quality: "auto",
            headers: { "User-Agent": import_http.UA, "Referer": mainUrl + "/" }
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
              headers: { "User-Agent": import_http.UA, "Referer": mainUrl + "/" }
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
      const html = yield (0, import_http.fetchText)(url, { headers: { "User-Agent": import_http.UA, "Referer": "https://vidguard.to/" } });
      const jwMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
      if (jwMatch) {
        return [{
          name: "Vidguard",
          title: "Vidguard",
          url: jwMatch[1],
          quality: "auto",
          headers: { "Referer": "https://vidguard.to/", "User-Agent": import_http.UA }
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
              headers: { "Referer": "https://vidguard.to/", "User-Agent": import_http.UA }
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
          headers: { "Referer": "https://vidguard.to/", "User-Agent": import_http.UA }
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
      const html = yield (0, import_http.fetchText)(url, {
        headers: { "User-Agent": import_http.UA, "Referer": `${host}/` }
      });
      const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
      if (sourcesMatch) {
        const labelMatch = html.match(/label\s*:\s*["']([^"']+)["']/);
        return [{
          name: "VidNest",
          title: `VidNest ${(labelMatch == null ? void 0 : labelMatch[1]) || ""}`.trim(),
          url: sourcesMatch[1],
          quality: (labelMatch == null ? void 0 : labelMatch[1]) || "auto",
          headers: { "User-Agent": import_http.UA, "Referer": `${host}/`, "Origin": host }
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
          headers: { "User-Agent": import_http.UA, "Referer": `${host}/`, "Origin": host }
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
      const html = yield (0, import_http.fetchText)(url, { headers: { "User-Agent": import_http.UA, "Referer": url } });
      const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
      if (sourcesMatch) {
        return [{
          name: "Streamwish",
          title: "Streamwish",
          url: sourcesMatch[1],
          quality: "auto",
          headers: { "User-Agent": import_http.UA }
        }];
      }
      const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
      if (fileMatch) {
        return [{
          name: "Streamwish",
          title: "Streamwish",
          url: fileMatch[1],
          quality: "auto",
          headers: { "User-Agent": import_http.UA }
        }];
      }
      const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
      if (m3u8Match) {
        return [{
          name: "Streamwish",
          title: "Streamwish",
          url: m3u8Match[1],
          quality: "auto",
          headers: { "User-Agent": import_http.UA }
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
      const html = yield (0, import_http.fetchText)(url, {
        headers: { "User-Agent": import_http.UA, "Referer": origin + "/" }
      });
      const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
      if (sourcesMatch) {
        return [{
          name: "Vidhidepro",
          title: "Vidhidepro",
          url: sourcesMatch[1],
          quality: "auto",
          headers: { "Referer": origin + "/", "User-Agent": import_http.UA }
        }];
      }
      const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
      if (fileMatch) {
        return [{
          name: "Vidhidepro",
          title: "Vidhidepro",
          url: fileMatch[1],
          quality: "auto",
          headers: { "Referer": origin + "/", "User-Agent": import_http.UA }
        }];
      }
      const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
      if (m3u8Match) {
        return [{
          name: "Vidhidepro",
          title: "Vidhidepro",
          url: m3u8Match[1],
          quality: "auto",
          headers: { "Referer": origin + "/", "User-Agent": import_http.UA }
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
      const html = yield (0, import_http.fetchText)(url, { headers: { "User-Agent": import_http.UA } });
      const directMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
      if (directMatch) {
        return [{
          name: "Maxstream",
          title: "Maxstream",
          url: directMatch[1],
          quality: "auto",
          headers: { "User-Agent": import_http.UA }
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
              headers: { "User-Agent": import_http.UA }
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
          headers: { "User-Agent": import_http.UA }
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
    if (!match) return null;
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
      const html = yield (0, import_http.fetchText)(url, {
        headers: { "User-Agent": import_http.UA, "Referer": referer || url }
      });
      const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
      if (sourcesMatch) {
        return [{
          name: "Javclan",
          title: "Javclan",
          url: sourcesMatch[1],
          quality: "auto",
          headers: { "Referer": referer || url, "User-Agent": import_http.UA }
        }];
      }
      const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
      if (fileMatch) {
        return [{
          name: "Javclan",
          title: "Javclan",
          url: fileMatch[1],
          quality: "auto",
          headers: { "Referer": referer || url, "User-Agent": import_http.UA }
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
      const html = yield (0, import_http.fetchText)(url, { headers: { "User-Agent": import_http.UA } });
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
            headers: { "User-Agent": import_http.UA }
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
          headers: { "User-Agent": import_http.UA }
        }];
      }
      const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
      if (fileMatch) {
        return [{
          name: "Javggvideo",
          title: "Javggvideo",
          url: fileMatch[1],
          quality: "auto",
          headers: { "User-Agent": import_http.UA }
        }];
      }
      const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
      if (m3u8Match) {
        return [{
          name: "Javggvideo",
          title: "Javggvideo",
          url: m3u8Match[1],
          quality: "auto",
          headers: { "User-Agent": import_http.UA }
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
      const html = yield (0, import_http.fetchText)(url, { headers: { "User-Agent": import_http.UA } });
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
              headers: { "User-Agent": import_http.UA, "Referer": "https://mixdrop.ag/" }
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
          headers: { "User-Agent": import_http.UA, "Referer": "https://mixdrop.ag/" }
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
      const html = yield (0, import_http.fetchText)(url, { headers: { "User-Agent": import_http.UA, "Referer": url } });
      const stRegex = /getElementById\(['"](?:robotlink|botlink|ideoolink)['"]\)[^.]*\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*\(['"]([^'"]+)['"]\)((?:\.substring\(\d+\))*)/g;
      let stMatch, lastMatch;
      while ((stMatch = stRegex.exec(html)) !== null) lastMatch = stMatch;
      if (lastMatch) {
        let [, part1, raw2, substrs] = lastMatch;
        const subNums = substrs.match(/\d+/g) || [];
        for (const n of subNums) raw2 = raw2.substring(parseInt(n));
        const raw = (part1 + raw2).replace(/\s/g, "");
        const videoUrl = raw.startsWith("http") ? raw : raw.startsWith("//") ? "https:" + raw : raw.startsWith("/") ? "https://streamtape.com" + raw : "https://" + raw;
        return [{
          name: "StreamTape",
          title: "StreamTape",
          url: videoUrl,
          quality: "auto",
          headers: { "User-Agent": import_http.UA, "Referer": url }
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
            headers: { "User-Agent": import_http.UA, "Referer": url }
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
          headers: { "User-Agent": import_http.UA, "Referer": url }
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
    if (c >= 65 && c <= 90) c = (c - 65 + 13) % 26 + 65;
    else if (c >= 97 && c <= 122) c = (c - 97 + 13) % 26 + 97;
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
    if (!mediaId) return null;
    const candidates = [url, ...VOE_UNPROTECTED_MIRRORS.map((h) => `https://${h}/e/${mediaId}`)];
    for (const candidateUrl of candidates) {
      try {
        const origin = new URL(candidateUrl).origin;
        const html = yield (0, import_http.fetchText)(candidateUrl, {
          headers: {
            "User-Agent": import_http.UA,
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
          const nextHtml = yield (0, import_http.fetchText)(nextUrl, {
            headers: {
              "User-Agent": import_http.UA,
              "Referer": candidateUrl,
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
          });
          if (nextHtml.includes("ddos-guard") || nextHtml.includes("DDoS-Guard")) continue;
          const jsonMatch2 = nextHtml.match(/<script type="application\/json">\["([^"]+)"\]<\/script>/);
          if (jsonMatch2) {
            const decoded = decodeVoe(jsonMatch2[1]);
            if (decoded && decoded.source) {
              return [{
                name: "VOE",
                title: "VOE",
                url: decoded.source,
                quality: decoded.quality || "auto",
                headers: { "Referer": nextOrigin + "/", "User-Agent": import_http.UA }
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
              headers: { "Referer": origin + "/", "User-Agent": import_http.UA }
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
            headers: { "Referer": origin + "/", "User-Agent": import_http.UA }
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
                headers: { "Referer": origin + "/", "User-Agent": import_http.UA }
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
    if (isDoodStream(url)) return extractDoodStream(url);
    if (isFilemoon(url)) return extractFilemoon(url);
    if (isLuluStream(url)) return extractLuluStream(url);
    if (isPlayer4Me(url)) return extractPlayer4Me(url);
    if (isVidguard(url)) return extractVidguard(url);
    if (isVidNest(url)) return extractVidNest(url);
    if (isStreamwish(url)) return extractStreamwish(url);
    if (isVidhidepro(url)) return extractVidhidepro(url);
    if (isMaxstream(url)) return extractMaxstream(url);
    if (isJavclan(url)) return extractJavclan(url, referer);
    if (isJavggvideo(url)) return extractJavggvideo(url);
    if (isMixDrop(url)) return extractMixDrop(url);
    if (isStreamtape(url)) return extractStreamtape(url);
    if (isVoe(url)) return extractVoe(url);
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
function cleanTitle(title) {
  if (!title) return "";
  return title.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}
function isMatch(resultTitle, expectedTitle) {
  if (!resultTitle || !expectedTitle) return false;
  const cleanResult = cleanTitle(resultTitle);
  const cleanExpected = cleanTitle(expectedTitle);
  if (cleanResult === cleanExpected) return true;
  if (cleanResult.includes(cleanExpected)) return true;
  const expectedWords = cleanExpected.split(" ").filter((w) => w.length > 2);
  if (expectedWords.length > 0) {
    const allWordsPresent = expectedWords.every((word) => cleanResult.includes(word));
    if (allWordsPresent) return true;
  }
  return false;
}

// src/pornwatch/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var BASE_URL = "https://pornwatch.ws";
var NAV_PATHS = /\/(movies-2|xxxfree|most-viewed-2|most-rating-2|director|genre|casts|release-year|wp-|xmlrpc|wp-json|\?)/;
function searchSite(query, expectedTitle) {
  return __async(this, null, function* () {
    const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const html = yield (0, import_http2.fetchText)(url);
    const $ = import_cheerio_without_node_native.default.load(html);
    const results = [];
    const seen = /* @__PURE__ */ new Set();
    $("div.ml-item").each((_, el) => {
      const title = $(el).find("h2").text().trim() || $(el).find("h3").text().trim();
      const href = $(el).find("a").first().attr("href");
      if (title && href && !isBlocked(title) && !seen.has(href)) {
        if (isMatch(title, expectedTitle)) {
          seen.add(href);
          results.push({ title, href });
        }
      }
    });
    if (!results.length) {
      $("article, div.item, div.post, div.video-item").each((_, el) => {
        const title = $(el).find("h2, h3, .title").first().text().trim();
        const href = $(el).find("a").first().attr("href");
        if (title && href && href.startsWith("http") && !isBlocked(title) && !seen.has(href)) {
          if (isMatch(title, expectedTitle)) {
            seen.add(href);
            results.push({ title, href });
          }
        }
      });
    }
    if (!results.length) {
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (href.startsWith(BASE_URL + "/") && !NAV_PATHS.test(href) && !seen.has(href)) {
          const title = $(el).attr("title") || $(el).text().trim();
          if (title && !isBlocked(title)) {
            if (isMatch(title, expectedTitle)) {
              seen.add(href);
              results.push({ title, href });
            }
          }
        }
      });
    }
    return results;
  });
}
function getVideoLinks(pageUrl) {
  return __async(this, null, function* () {
    const html = yield (0, import_http2.fetchText)(pageUrl);
    const $ = import_cheerio_without_node_native.default.load(html);
    const links = /* @__PURE__ */ new Set();
    $("div#pettabs div.Rtable1-cell a").each((_, el) => {
      const href = $(el).attr("href");
      if (href && href.startsWith("http")) links.add(href);
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
          if (href && href.startsWith("http")) links.add(href);
        });
        if (links.size) break;
      }
    }
    if (!links.size) {
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (href.startsWith("http") && isKnownEmbedHost(href)) {
          links.add(href);
        }
      });
    }
    return [...links];
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const metadata = yield (0, import_http2.resolveMetadata)(tmdbId, mediaType);
    const query = metadata.title || String(tmdbId);
    const results = yield searchSite(query, metadata.title);
    if (!results.length) return [];
    const streams = [];
    for (const result of results.slice(0, 3)) {
      const videoLinks = yield getVideoLinks(result.href);
      for (const link of videoLinks) {
        const extracted = yield extractFromUrl(link, BASE_URL + "/");
        if (extracted) {
          streams.push(...extracted.map((s) => __spreadProps(__spreadValues({}, s), {
            title: `[PornWatch] ${s.title}`
          })));
        }
      }
      if (streams.length > 0) break;
    }
    return streams;
  });
}

// src/pornwatch/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[PornWatch] Request: ${mediaType} ${tmdbId}`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[PornWatch] Error: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
