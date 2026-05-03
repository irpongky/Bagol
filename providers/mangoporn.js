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
function getTitleFromTmdb(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const endpoint = mediaType === "tv" ? `https://api.themoviedb.org/3/tv/${tmdbId}` : `https://api.themoviedb.org/3/movie/${tmdbId}`;
      const res = yield fetch(`${endpoint}?language=en-US`, {
        headers: { Authorization: `Bearer ${typeof TMDB_READ_TOKEN !== "undefined" ? TMDB_READ_TOKEN : ""}` }
      });
      if (!res.ok)
        return null;
      const data = yield res.json();
      return data.title || data.name || null;
    } catch (e) {
      return null;
    }
  });
}

// src/shared/extractors.js
var import_crypto_js = __toESM(require("crypto-js"));
function aesCbcDecrypt(cipherB64, keyStr, ivStr) {
  const normalized = cipherB64.replace(/-/g, "+").replace(/_/g, "/");
  const key = import_crypto_js.default.enc.Utf8.parse(keyStr);
  const iv = import_crypto_js.default.enc.Utf8.parse(ivStr);
  const decrypted = import_crypto_js.default.AES.decrypt(normalized, key, {
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
      const embedUrl = url.replace("doply.net", "myvidplay.com").replace("d000d.com", "myvidplay.com");
      const embedOrigin = new URL(embedUrl).origin;
      const html = yield fetchText(embedUrl, {
        headers: { "User-Agent": UA, "Referer": embedOrigin + "/" }
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
    } catch (e) {
      return null;
    }
  });
}
var PLAYER4ME_HOSTS = [
  "player4me.online",
  "player4me.vip",
  "rpmplay.online"
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
  "mixdrp."
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
      const title = $(el).find("div h3").text().trim() || $(el).find("h2").text().trim() || $(el).find("h1").text().trim();
      const href = $(el).find("h3 a").attr("href") || $(el).find("h2 a").attr("href") || $(el).find("a").first().attr("href");
      if (title && href && !isBlocked(title)) {
        results.push({ title, href });
      }
    });
    if (!results.length) {
      $("div.post, div.item, div.video-item, div.ml-item").each((_, el) => {
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
        "div.pettabs a",
        "div.tabs a",
        "div.servers a",
        "div.links a",
        "div.video-links a",
        "div.Rtable1 a",
        "div.Rtable1-cell a"
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
    const title = yield getTitleFromTmdb(tmdbId, mediaType);
    const query = title || String(tmdbId);
    const results = yield searchSite(query);
    if (!results.length)
      return [];
    const streams = [];
    for (const result of results.slice(0, 3)) {
      const videoLinks = yield getVideoLinks(result.href);
      for (const link of videoLinks) {
        const extracted = yield extractFromUrl(link, result.href);
        if (extracted) {
          streams.push(...extracted.map((s) => __spreadProps(__spreadValues({}, s), {
            title: `[Mangoporn] ${s.title}`
          })));
        }
      }
      if (streams.length > 0)
        break;
    }
    return streams;
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
