# Bagol Repo

Nuvio providers by kraptor. A build system that bundles JavaScript provider scrapers and serves them via HTTP.

## Project Overview

This project builds and serves provider plugins for the Nuvio platform. Each provider scrapes adult video sites and extracts streaming URLs.

## Architecture

- **Build system**: esbuild bundles `src/<provider>/index.js` into `providers/<provider>.js`
- **Server**: Node.js HTTP server (`server.js`) serves files on port 5000
- **Providers**: mangoporn, xxxparodyhd, pornwatch

## Key Files

- `manifest.json` — Provider registry (served at `/manifest.json`)
- `build.js` — esbuild build script (`platform: "neutral"`, `target: "es2016"` — transpiles async/await → generators for Hermes)
- `server.js` — HTTP file server (port 5000, host 0.0.0.0)
- `src/<provider>/index.js` — Entry point per provider
- `src/<provider>/extractor.js` — Site-specific search + link scraping
- `src/shared/http.js` — TMDB API helper (uses `?api_key=`, not Bearer)
- `src/shared/extractors.js` — All embed extractors (13 total)
- `src/shared/filters.js` — Content filtering
- `providers/<provider>.js` — Bundled CJS output files

## Scripts

- `npm start` — Start HTTP server
- `npm run build` — Build all providers
- `npm run build:<name>` — Build a specific provider

## Runtime Notes (Hermes / React Native)

- **NO** `crypto.subtle` (Web Crypto API not available in Hermes)
- **NO** Node.js builtins
- **YES** `fetch`, `atob`, `Uint8Array` available as globals
- `cheerio-without-node-native`, `crypto-js`, `axios` are EXTERNAL (provided by Nuvio app — do NOT bundle)

## Supported Extractors

| Extractor | Hosts |
|-----------|-------|
| DoodStream | myvidplay.com, dood.*, ds2play.com, playmogo.com, 20+ mirrors |
| Filemoon | filemoon.to/in/sx, bysedikamoum.com, x08.ovh |
| LuluStream | luluvid.com, lulustream.com, luluvdo.com — p,a,c,k unpacker included |
| Player4Me | player4me.online/vip, rpmplay.online, **seekplayer.vip, embedseek.online, easyvidplayer.com** |
| Vidguard | vidguard.to, listeamed.net, bembed.net |
| Streamwish | streamwish.to, streamhihi.com, awish.net, swhoi.com |
| Vidhidepro | vidhidepro.com, vidhidevip.com, vidhide.com |
| MixDrop | mixdrop.*, mixdrp.* |
| StreamTape | streamtape.com/to/net — substring-based URL decode |
| VOE | voe.sx, voe.bar, voeun.net |
| Maxstream | maxstream.org/video |
| VidNest | vidnest.io/net |
| Javclan | javclan.com |
| Javggvideo | javggvideo.xyz, javgg.net |

## Critical Bug Fixes Applied

1. **TMDB API**: Uses `?api_key=439c478a771f35c05022f9feabcca01c` (not Bearer token) — without this, title lookup fails and search returns nothing
2. **AES-CBC decrypt**: Player4Me APIs return **hex-encoded** ciphertext. Must use `CryptoJS.lib.CipherParams.create({ciphertext: CryptoJS.enc.Hex.parse(hex)})` — NOT raw hex string
3. **LuluStream**: HTML uses `p,a,c,k` eval packer — now unpacked with lazy `[\s\S]+?` regex via `unpackJS()`
4. **StreamTape**: URL assembled via `'//streamtape.com/get_vid' + ('xcdeo?...').substring(2).substring(1)` — substring chains now parsed
5. **Player4Me hosts expanded**: seekplayer.vip, embedseek.online, easyvidplayer.com all use identical `/api/v1/video?id=` endpoint and same AES key
6. **DoodStream**: Use original host URL (not redirected to myvidplay.com) — each mirror hosts its own content
7. **Mangoporn search selectors**: `div.details a` for title, `div.image a` for href

## Test Results (as of last build)

- **Mangoporn** (TMDB #550): 10 streams — LuluStream ✅, 7× Player4Me ✅, MixDrop ✅, StreamTape ✅
- **PornWatch** (TMDB #550): 10 streams — LuluStream ✅, 6× Player4Me ✅, MixDrop ✅, StreamTape ✅
- **XXXParodyHD** (TMDB #99861): 1–2 streams (limited by available hosts per page, VOE blocked by 403)

## Dependencies

- `esbuild` — Bundler
- `cheerio-without-node-native@1.0.0-rc.2` — HTML parser (used in provider source)
- `crypto-js` — AES-CBC decrypt (external, provided by Nuvio runtime)

## Deployment

- Target: autoscale
- Run: `node server.js`
- Port: 5000
