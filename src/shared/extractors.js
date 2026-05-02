import { fetchText, fetchJson, UA } from './http.js';

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function base64UrlToBytes(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function textToBytes(str) {
    return new TextEncoder().encode(str);
}

async function aesGcmDecrypt(keyBytes, ivB64url, payloadB64url) {
    const iv = base64UrlToBytes(ivB64url);
    const data = base64UrlToBytes(payloadB64url);
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data);
    return new TextDecoder('iso-8859-1').decode(decrypted);
}

async function aesCbcDecrypt(cipherB64, keyStr, ivStr) {
    const keyBytes = textToBytes(keyStr);
    const ivBytes = textToBytes(ivStr);
    const data = base64UrlToBytes(cipherB64);
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivBytes }, key, data);
    return new TextDecoder().decode(decrypted);
}

// ─────────────────────────────────────────────
// DoodStream  (myvidplay.com / doply.net / playmogo.com)
// ─────────────────────────────────────────────
// BUG FIX: film nyasar karena regex capture group terbalik.
//   html.match(/\/pass_md5\/([^/]*)\/([^/']*)/);
//   → group 1 = expiry (hash folder), group 2 = token (file name)
//   Kode lama: const [fullPath, expiry, token] = md5Match;
//   Tapi di Dood URL-nya: /pass_md5/<expiry>/<token>
//   sehingga token & expiry terbalik posisinya → URL video salah → film nyasar.
//   Fix: swap destructuring menjadi [fullPath, expiry, token].
//
// BUG FIX: playmogo.com tidak masuk routing (perlu tetap pakai host playmogo,
//   bukan hardcode ke myvidplay) karena URL base-nya beda.
// ─────────────────────────────────────────────

const DOOD_HOSTS = [
    'myvidplay.com', 'doply.net', 'playmogo.com', 'dood.pm',
    'ds2play.com', 'd000d.com', 'dooood.com', 'do0od.com',
    'easyvidplayer.com',  // ← BARU: vip.easyvidplayer.com / p.easyvidplayer.com
];

export function isDoodStream(url) {
    return DOOD_HOSTS.some(h => url.includes(h));
}

export async function extractDoodStream(url) {
    try {
        // Tentukan refHost sesuai domain asli, bukan hardcode myvidplay
        let embedUrl = url;
        let refHost;

        if (url.includes('doply.net')) {
            embedUrl = url.replace('doply.net', 'myvidplay.com');
            refHost = 'https://myvidplay.com';
        } else if (url.includes('easyvidplayer.com')) {
            // easyvidplayer pakai pola Dood: ambil dari origin-nya sendiri
            refHost = new URL(url).origin;
        } else if (url.includes('playmogo.com')) {
            refHost = 'https://playmogo.com';
        } else {
            refHost = new URL(url).origin;
        }

        const html = await fetchText(embedUrl, {
            headers: { 'User-Agent': UA, 'Referer': refHost }
        });

        // FIX: regex /pass_md5/<expiry_folder>/<token_filename>
        // group 1 = expiry, group 2 = token
        const md5Match = html.match(/\/pass_md5\/([^/]+)\/([^/'"\s]+)/);
        if (!md5Match) return null;

        const fullPath = md5Match[0];
        const expiry   = md5Match[1]; // folder = expiry hash
        const token    = md5Match[2]; // filename = token

        const md5Url = refHost + fullPath;

        const baseLink = (await fetchText(md5Url, {
            headers: { 'User-Agent': UA, 'Referer': embedUrl }
        })).trim();

        // Format: baseLink + random_chars + "?token=<token>&expiry=<expiry>000"
        // Dood menambahkan 10 char acak antara baseLink dan query string
        const rand = Math.random().toString(36).slice(2, 12);
        const directUrl = `${baseLink}${rand}?token=${token}&expiry=${expiry}000`;

        return [{
            name: 'DoodStream',
            title: 'DoodStream',
            url: directUrl,
            quality: 'auto',
            headers: { 'User-Agent': UA, 'Referer': refHost }
        }];
    } catch (e) {
        console.log('[extractors] DoodStream error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Filemoon  (filemoon.to / filemoon.in / etc.)
// ─────────────────────────────────────────────

const FILEMOON_HOSTS = [
    'filemoon.to', 'filemoon.in', 'filemoon.sx',
    'filemoon.nl', 'filemoon.art',
    'bysedikamoum.com', 'bysezoxexe.com', 'x08.ovh', 'javmoon.me',
];

export function isFilemoon(url) {
    return FILEMOON_HOSTS.some(h => url.includes(h));
}

export async function extractFilemoon(url) {
    try {
        const mediaId = (url.match(/\/(?:e|d|v|f|download)\/([0-9a-zA-Z]+)/) || [])[1]
            || url.split('/').pop().split('?')[0];
        const host    = new URL(url).host;
        const rootRef = `https://${host}/`;
        const apiUrl  = `https://${host}/api/videos/${mediaId}/embed/playback`;

        const headers = {
            'User-Agent': UA,
            'Referer': rootRef,
            'Origin': `https://${host}`,
            'X-Requested-With': 'XMLHttpRequest'
        };

        const json = await fetchJson(apiUrl, { headers });

        let sources = json.sources;

        if (!sources && json.playback) {
            const pb       = json.playback;
            const keyParts = pb.key_parts.map(p => base64UrlToBytes(p));
            const keyBytes = new Uint8Array(keyParts.reduce((acc, b) => [...acc, ...b], []));
            const plain    = await aesGcmDecrypt(keyBytes, pb.iv, pb.payload);
            sources        = JSON.parse(plain).sources;
        }

        if (!sources) return null;

        return sources.map(s => ({
            name: 'Filemoon',
            title: s.label ? `Filemoon ${s.label}p` : 'Filemoon',
            url: s.url,
            quality: s.label || 'auto',
            headers: { 'Referer': rootRef, 'User-Agent': UA }
        }));
    } catch (e) {
        console.log('[extractors] Filemoon error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// LuluStream  (lulustream.com / luluvid.com / etc.)
// ─────────────────────────────────────────────
// BUG FIX: error "parsing unsupported / HTTP 403"
//   Penyebab: regex terlalu lax (["']...m3u8...["']) bisa nangkap URL
//   di dalam komentar JS atau string yg bukan src video.
//   Lulu sekarang butuh header Cookie & Accept-Encoding tertentu.
//   Fix:
//   1. Tambah header Accept, Accept-Encoding, Cookie dummy
//   2. Regex lebih spesifik: cari setelah 'source' atau 'file' key
//   3. Fallback: cari di <source src="...m3u8"> tag
// ─────────────────────────────────────────────

const LULU_HOSTS = [
    'lulustream.com', 'luluvid.com', 'luluvdo.com',
    'luluvdoo.com', 'lulupvp.com', 'lulu.dlc.ovh', 'lulu0.ovh',
    'ludwigurl.com',
];

export function isLuluStream(url) {
    return LULU_HOSTS.some(h => url.includes(h));
}

export async function extractLuluStream(url) {
    try {
        const embedUrl = url.replace('/d/', '/e/');
        const origin   = new URL(embedUrl).origin;

        const html = await fetchText(embedUrl, {
            headers: {
                'User-Agent': UA,
                'Referer': origin + '/',
                'Origin': origin,
                'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9',
                // Cookie dummy agar tidak kena bot-check redirect
                'Cookie': 'sb_expires=0',
            }
        });

        // Priority 1: sources:[{file:"...m3u8"}]  atau  file:"...m3u8"
        let m3u8Url =
            (html.match(/(?:source|file)\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
             html.match(/["']([^"']*\.m3u8[^"']*)["']/))?.[1];

        // Priority 2: <source src="...m3u8">
        if (!m3u8Url) {
            m3u8Url = html.match(/<source[^>]+src=["']([^"']+\.m3u8[^"']*)["']/i)?.[1];
        }

        if (!m3u8Url) return null;

        return [{
            name: 'LuluStream',
            title: 'LuluStream',
            url: m3u8Url,
            quality: 'auto',
            headers: {
                'Referer': origin + '/',
                'Origin': origin,
                'User-Agent': UA
            }
        }];
    } catch (e) {
        console.log('[extractors] LuluStream error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// MixDrop  (mixdrop.ag / .my / .is / .co / .ch)
// ─────────────────────────────────────────────
// BUG FIX: error "parsing unsupported / HTTP 403"
//   Penyebab 1 (403): MixDrop membutuhkan Referer + Cookie yg valid.
//   Penyebab 2 (parsing): regex hanya cari MDCore.wurl tapi
//     MixDrop kadang pakai variabel lain: MDCore.vurl, vsr, wurl, surl, url.
//   Fix:
//   1. Tambah headers Referer, Cookie, Accept
//   2. Regex mencakup semua variabel yang diketahui
//   3. URL yang dihasilkan mungkin relative (//cdn...) → fix ke https:
// ─────────────────────────────────────────────

const MIXDROP_HOSTS = [
    'mixdrop.ag', 'mixdrop.my', 'mixdrop.is',
    'mixdrop.co', 'mixdrop.ch', 'mixdroop.com',
];

export function isMixDrop(url) {
    return MIXDROP_HOSTS.some(h => url.includes(h));
}

export async function extractMixDrop(url) {
    try {
        const origin = new URL(url).origin;
        const html   = await fetchText(url, {
            headers: {
                'User-Agent': UA,
                'Referer': origin + '/',
                'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
                'Accept-Language': 'en-US,en;q=0.9',
                // MixDrop butuh cookie consent
                'Cookie': 'cf_clearance=; __ddg1=; sb_expires=0',
            }
        });

        // Cari di semua script (termasuk packed)
        let fileUrl = null;

        // Regex mencakup semua variabel MixDrop yang diketahui
        const MIXDROP_RE = /(?:MDCore\.(?:wurl|vurl|url)|vsr|wurl|surl)\s*=\s*["']([^"']+)["']/;
        const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];

        for (const [, scriptContent] of scripts) {
            // Coba unpack dulu kalau packed
            const unpacked = unpackJS(scriptContent) || scriptContent;
            const m = unpacked.match(MIXDROP_RE);
            if (m) {
                fileUrl = m[1];
                break;
            }
        }

        if (!fileUrl) return null;

        // Fix relative protocol
        if (fileUrl.startsWith('//')) fileUrl = 'https:' + fileUrl;

        return [{
            name: 'MixDrop',
            title: 'MixDrop',
            url: fileUrl,
            quality: 'auto',
            headers: { 'User-Agent': UA, 'Referer': origin + '/' }
        }];
    } catch (e) {
        console.log('[extractors] MixDrop error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Vue / VuePlayer  (vue.io / vue.to / vueplay.online dll.)
// ─────────────────────────────────────────────
// BUG FIX: tidak muncul di list → belum ada di extractors.js sama sekali
//   + error "parsing unsupported / HTTP 403"
//   Vue player pakai pola: embed URL → fetch → unpack → file:"...m3u8"
//   Butuh Referer dari site asal.
// ─────────────────────────────────────────────

const VUE_HOSTS = [
    'vue.io', 'vueplay.online', 'vueplayer.me',
    'vuetv.top', 'vuestream.net', 'embtaku.pro',
];

export function isVue(url) {
    return VUE_HOSTS.some(h => url.includes(h));
}

export async function extractVue(url, referer) {
    try {
        const origin = new URL(url).origin;
        const html   = await fetchText(url, {
            headers: {
                'User-Agent': UA,
                'Referer': referer || origin + '/',
                'Origin': origin,
                'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
            }
        });

        // Vue embed kadang pakai packed JS
        let fileUrl = null;
        const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
        for (const [, raw] of scripts) {
            const unpacked = unpackJS(raw) || raw;
            const m = unpacked.match(/(?:sources?\s*:\s*\[\s*\{[^}]*file|file)\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
            if (m) { fileUrl = m[1]; break; }
        }

        // Fallback: <source src>
        if (!fileUrl) {
            fileUrl = html.match(/<source[^>]+src=["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i)?.[1];
        }

        if (!fileUrl) return null;

        return [{
            name: 'Vue',
            title: 'Vue',
            url: fileUrl,
            quality: 'auto',
            headers: { 'Referer': origin + '/', 'Origin': origin, 'User-Agent': UA }
        }];
    } catch (e) {
        console.log('[extractors] Vue error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// UPNS  (my.upns.online / upns.online dll.)
// ─────────────────────────────────────────────
// BUG FIX: tidak muncul di list + "parsing unsupported / HTTP 403"
//   UPNS adalah player berbasis fragment (#id) seperti Player4Me.
//   URL: https://my.upns.online/#<id>
//   API: GET /api/v1/video?id=<id>  → AES-CBC decrypt sama seperti Player4Me
//   (key & iv identik: kiemtienmua911ca / 1234567890oiuytr)
//   Respons JSON berisi field "source", "hls", atau "cf".
//   Bukti dari sample URL:
//     https://my.upns.online/#hojaz8
//     → m3u8: https://203.188.166.88/v4/.../hojaz8/master.m3u8
// ─────────────────────────────────────────────

const UPNS_HOSTS = [
    'upns.online', 'my.upns.online', 'upns.to',
    'seekplayer.vip', 'embedseek.online',
];

export function isUpns(url) {
    return UPNS_HOSTS.some(h => url.includes(h));
}

export async function extractUpns(url) {
    try {
        const origin = new URL(url).origin;
        const id     = url.split('#')[1] || url.split('/').pop().split('?')[0];
        if (!id) return null;

        const apiUrl = `${origin}/api/v1/video?id=${id}`;
        const raw    = (await fetchText(apiUrl, {
            headers: {
                'User-Agent': UA,
                'Accept': '*/*',
                'Referer': origin + '/',
                'Cookie': 'popunderCount/=1',
            }
        })).trim();

        if (!raw || raw.startsWith('<')) return null;

        const plain    = await aesCbcDecrypt(raw, 'kiemtienmua911ca', '1234567890oiuytr');
        const data     = JSON.parse(plain);
        const videoUrl = data.source || data.hls || data.cf
            || data.sources?.[0]?.file || data.url;

        if (!videoUrl) return null;

        return [{
            name: 'UPNS',
            title: 'UPNS',
            url: videoUrl,
            quality: 'auto',
            headers: { 'User-Agent': UA, 'Referer': origin + '/' }
        }];
    } catch (e) {
        console.log('[extractors] UPNS error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Player4Me  (player4me.online / player4me.vip / rpmplay.online / my.player4me / vip.player4me)
// ─────────────────────────────────────────────
// BUG FIX: tidak muncul di list
//   Penyebab: PLAYER4ME_HOSTS tidak mencakup subdomain "my." & "vip."
//   Sample URL: my.player4me.online/#vq5uh  dan  vip.player4me.vip/#vq5uh
//   Fix: tambahkan 'my.player4me' dan 'vip.player4me' ke host list.
//
// BUG FIX: raw.startsWith('<html>') terlalu spesifik
//   Server bisa kirim '<HTML>' kapital atau '<!DOCTYPE html>' → lolos check.
//   Fix: cek raw.startsWith('<') saja.
// ─────────────────────────────────────────────

const PLAYER4ME_HOSTS = [
    'player4me.online', 'player4me.vip',
    'rpmplay.online',
    'my.player4me',   // ← FIX: subdomain my.
    'vip.player4me',  // ← FIX: subdomain vip.
];

export function isPlayer4Me(url) {
    return PLAYER4ME_HOSTS.some(h => url.includes(h));
}

export async function extractPlayer4Me(url) {
    try {
        const origin = new URL(url).origin;
        const id     = url.split('#')[1] || url.split('/').pop().split('?')[0];
        if (!id) return null;

        const apiUrl = `${origin}/api/v1/video?id=${id}`;
        const raw    = (await fetchText(apiUrl, {
            headers: {
                'Host': new URL(url).host,
                'User-Agent': UA,
                'Accept': '*/*',
                'Cookie': 'popunderCount/=1',
                'Referer': origin + '/'
            }
        })).trim();

        // FIX: cek '<' bukan '<html>' agar tangkap semua bentuk HTML error
        if (!raw || raw.startsWith('<')) return null;

        const plain    = await aesCbcDecrypt(raw, 'kiemtienmua911ca', '1234567890oiuytr');
        const data     = JSON.parse(plain);
        const videoUrl = data.source || data.hls || data.cf
            || data.sources?.[0]?.file || data.url;

        if (!videoUrl) return null;

        return [{
            name: 'Player4Me',
            title: 'Player4Me',
            url: videoUrl,
            quality: 'auto',
            headers: { 'User-Agent': UA, 'Referer': origin + '/' }
        }];
    } catch (e) {
        console.log('[extractors] Player4Me error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Streamtape  (streamtape.com / streamtape.net / tapecontent.net)
// ─────────────────────────────────────────────
// Belum ada di extractors.js original, ditambahkan sebagai extractor baru.
// Pola: fetch embed → cari 'robotlink' div atau JS concat string → URL video.
// ─────────────────────────────────────────────

const STREAMTAPE_HOSTS = [
    'streamtape.com', 'streamtape.net', 'streamtape.to',
    'tapecontent.net', 'streamta.pe',
];

export function isStreamtape(url) {
    return STREAMTAPE_HOSTS.some(h => url.includes(h));
}

export async function extractStreamtape(url) {
    try {
        // Pastikan pakai URL embed bukan download
        const embedUrl = url.replace('/get_video/', '/e/').replace('/download/', '/e/');
        const origin   = new URL(embedUrl).origin;

        const html = await fetchText(embedUrl, {
            headers: { 'User-Agent': UA, 'Referer': origin + '/' }
        });

        // Streamtape menyembunyikan URL dengan JS concat:
        // document.getElementById('robotlink').innerHTML = '...part1' + ('...part2').substring(X)
        const m = html.match(
            /document\.getElementById\(['"]robotlink['"]\)\.innerHTML\s*=\s*["']([^"']+)["']\s*\+\s*\(['"]([^"']+)['"]\)\.substring\((\d+)\)/
        );
        if (m) {
            const part1    = m[1];
            const part2    = m[2].substring(parseInt(m[3], 10));
            const videoUrl = 'https:' + part1 + part2;
            return [{
                name: 'Streamtape',
                title: 'Streamtape',
                url: videoUrl,
                quality: 'auto',
                headers: { 'User-Agent': UA, 'Referer': origin + '/' }
            }];
        }

        // Fallback: cari link langsung di innerHTML
        const m2 = html.match(/id=['"]robotlink['"][^>]*>\s*(\/\/[^<\s]+)/);
        if (m2) {
            return [{
                name: 'Streamtape',
                title: 'Streamtape',
                url: 'https:' + m2[1],
                quality: 'auto',
                headers: { 'User-Agent': UA, 'Referer': origin + '/' }
            }];
        }

        return null;
    } catch (e) {
        console.log('[extractors] Streamtape error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Vidguard
// ─────────────────────────────────────────────

export function isVidguard(url) {
    return url.includes('vidguard.to') || url.includes('vidguard.nu');
}

export async function extractVidguard(url) {
    try {
        const html     = await fetchText(url, { headers: { 'User-Agent': UA } });
        const sigMatch = html.match(/sig=([a-fA-F0-9]+)/);
        if (!sigMatch) return null;

        let sig = sigMatch[1];
        let t   = '';
        for (let i = 0; i < sig.length; i += 2) {
            t += String.fromCharCode(parseInt(sig.slice(i, i + 2), 16) ^ 2);
        }
        const padding = [0, 0, 2, 1][t.length % 4];
        const decoded = atob(t + '='.repeat(padding));
        let s         = decoded.slice(0, -5).split('').reverse().join('');
        const arr     = s.split('');
        for (let i = 0; i < arr.length - 1; i += 2) {
            [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        }
        const modifiedSig = arr.join('').slice(0, -5);
        const streamUrl   = url.replace(sigMatch[1], modifiedSig);

        return [{
            name: 'Vidguard',
            title: 'Vidguard',
            url: streamUrl,
            quality: 'auto',
            headers: { 'Referer': 'https://vidguard.to', 'User-Agent': UA }
        }];
    } catch (e) {
        console.log('[extractors] Vidguard error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// VidNest  (vidnest.io / vidnest.app / vidnest.xyz dll.)
// ─────────────────────────────────────────────
// BUG FIX: isVidNest() hanya cek 'vidnest.io', padahal ada banyak TLD lain.
// ─────────────────────────────────────────────

const VIDNEST_HOSTS = [
    'vidnest.io', 'vidnest.app', 'vidnest.xyz',
    'vidnest.lol', 'vidnest.fun',
];

export function isVidNest(url) {
    return VIDNEST_HOSTS.some(h => url.includes(h));
}

export async function extractVidNest(url) {
    try {
        const origin = new URL(url).origin;
        const html   = await fetchText(url, {
            headers: {
                'User-Agent': UA,
                'Referer': origin + '/',
                'Origin': origin,
            }
        });

        // Coba file mp4 dulu, fallback m3u8
        const fileMatch  = html.match(/file\s*:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i);
        const labelMatch = html.match(/label\s*:\s*["']([^"']+)["']/);
        if (!fileMatch) return null;

        return [{
            name: 'VidNest',
            title: `VidNest ${labelMatch?.[1] || ''}`.trim(),
            url: fileMatch[1],
            quality: labelMatch?.[1] || 'auto',
            headers: { 'User-Agent': UA, 'Referer': origin + '/', 'Origin': origin }
        }];
    } catch (e) {
        console.log('[extractors] VidNest error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Streamwish  (streamwish.to / streamhihi.com / javsw.me / swhoi.com / muvicloud.com / dll.)
// ─────────────────────────────────────────────

const STREAMWISH_HOSTS = [
    'streamwish.to', 'streamwish.com', 'streamhihi.com',
    'javsw.me', 'swhoi.com', 'muvicloud.com',
    'stream.lol', 'playerwish.com', 'wishfast.top',
];

export function isStreamwish(url) {
    return STREAMWISH_HOSTS.some(h => url.includes(h));
}

export async function extractStreamwish(url) {
    try {
        const origin = new URL(url).origin;
        const html   = await fetchText(url, {
            headers: {
                'User-Agent': UA,
                'Referer': origin + '/',
                'Origin': origin,
            }
        });

        // Streamwish sering pakai packed JS
        let fileUrl = null;
        const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
        for (const [, raw] of scripts) {
            const unpacked = unpackJS(raw) || raw;
            const m = unpacked.match(/(?:sources?\s*:\s*\[\s*\{[^}]*file|file)\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
            if (m) { fileUrl = m[1]; break; }
        }

        if (!fileUrl) return null;

        return [{
            name: 'Streamwish',
            title: 'Streamwish',
            url: fileUrl,
            quality: 'auto',
            headers: { 'User-Agent': UA, 'Referer': origin + '/', 'Origin': origin }
        }];
    } catch (e) {
        console.log('[extractors] Streamwish error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Vidhidepro  (vidhidepro.com / vidhidevip.com / vidhide.com / javlion.xyz / hideguard.com)
// ─────────────────────────────────────────────

const VIDHIDE_HOSTS = [
    'vidhidepro.com', 'vidhidevip.com', 'vidhide.com',
    'javlion.xyz', 'hideguard.com',
];

export function isVidhidepro(url) {
    return VIDHIDE_HOSTS.some(h => url.includes(h));
}

export async function extractVidhidepro(url) {
    try {
        const origin = new URL(url).origin;
        const html   = await fetchText(url, {
            headers: {
                'User-Agent': UA,
                'Referer': origin + '/',
                'Origin': origin,
            }
        });

        let fileUrl = null;
        const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
        for (const [, raw] of scripts) {
            const unpacked = unpackJS(raw) || raw;
            const m = unpacked.match(/sources?\s*:\s*\[\s*\{[^}]*file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
            if (m) { fileUrl = m[1]; break; }
        }

        if (!fileUrl) return null;

        return [{
            name: 'Vidhidepro',
            title: 'Vidhidepro',
            url: fileUrl,
            quality: 'auto',
            headers: { 'Referer': origin + '/', 'Origin': origin, 'User-Agent': UA }
        }];
    } catch (e) {
        console.log('[extractors] Vidhidepro error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Maxstream
// ─────────────────────────────────────────────

export function isMaxstream(url) {
    return url.includes('maxstream.org');
}

export async function extractMaxstream(url) {
    try {
        const html   = await fetchText(url, { headers: { 'User-Agent': UA } });
        const packed = html.match(/function\(p,a,c,k,e,d\)[\s\S]+?(?=<\/script>)/)?.[0];
        if (!packed) return null;

        const decoded  = unpackJS(packed);
        const fileMatch = decoded?.match(/file:\s*["']([^"']+)["']/);
        if (!fileMatch) return null;

        return [{
            name: 'Maxstream',
            title: 'Maxstream',
            url: fileMatch[1],
            quality: 'auto',
            headers: { 'User-Agent': UA }
        }];
    } catch (e) {
        console.log('[extractors] Maxstream error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Javclan
// ─────────────────────────────────────────────

export function isJavclan(url) {
    return url.includes('javclan.com');
}

export async function extractJavclan(url, referer) {
    try {
        const origin = new URL(url).origin;
        const res    = await fetch(url, {
            headers: { 'User-Agent': UA, 'Referer': referer || origin + '/' }
        });
        if (!res.ok) return null;
        const html = await res.text();

        let fileUrl = null;
        const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
        for (const [, raw] of scripts) {
            const unpacked = unpackJS(raw) || raw;
            const m = unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
            if (m) { fileUrl = m[1]; break; }
        }

        if (!fileUrl) return null;

        return [{
            name: 'Javclan',
            title: 'Javclan',
            url: fileUrl,
            quality: 'auto',
            headers: { 'Referer': referer || origin + '/', 'User-Agent': UA }
        }];
    } catch (e) {
        console.log('[extractors] Javclan error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Javggvideo
// ─────────────────────────────────────────────

export function isJavggvideo(url) {
    return url.includes('javggvideo.xyz') || url.includes('javgg.net');
}

export async function extractJavggvideo(url) {
    try {
        const html = await fetchText(url, { headers: { 'User-Agent': UA } });
        const link = html.split("var urlPlay = '")[1]?.split("';")[0];
        if (!link) return null;

        return [{
            name: 'Javggvideo',
            title: 'Javggvideo',
            url: link,
            quality: 'auto',
            headers: { 'User-Agent': UA }
        }];
    } catch (e) {
        console.log('[extractors] Javggvideo error:', e?.message);
        return null;
    }
}

// ─────────────────────────────────────────────
// Shared: p,a,c,k,e,d Unpacker
// ─────────────────────────────────────────────

function unpackJS(packed) {
    if (!packed || packed.indexOf('eval(function(p,a,c,k,e,') === -1) return null;
    try {
        const match = packed.match(/\('([\s\S]*?)',\s*(\d+),\s*\d+,\s*'([\s\S]*?)'\.split\('([|]?)'\)/);
        if (!match) return null;
        const [, p, a, k, sep] = match;
        const keywords = k.split(sep || '|');
        const base     = parseInt(a, 10);
        return p.replace(/\b\w+\b/g, w => {
            const n = parseInt(w, base);
            return (n >= 0 && n < keywords.length && keywords[n] !== '') ? keywords[n] : w;
        });
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Generic extractor dispatcher
// ─────────────────────────────────────────────

export async function extractFromUrl(url, referer) {
    if (isDoodStream(url))   return extractDoodStream(url);
    if (isFilemoon(url))     return extractFilemoon(url);
    if (isLuluStream(url))   return extractLuluStream(url);
    if (isMixDrop(url))      return extractMixDrop(url);       // ← BARU (pindah ke sini biar check duluan)
    if (isUpns(url))         return extractUpns(url);          // ← BARU
    if (isPlayer4Me(url))    return extractPlayer4Me(url);
    if (isVue(url))          return extractVue(url, referer);  // ← BARU
    if (isStreamtape(url))   return extractStreamtape(url);    // ← BARU
    if (isVidguard(url))     return extractVidguard(url);
    if (isVidNest(url))      return extractVidNest(url);
    if (isStreamwish(url))   return extractStreamwish(url);
    if (isVidhidepro(url))   return extractVidhidepro(url);
    if (isMaxstream(url))    return extractMaxstream(url);
    if (isJavclan(url))      return extractJavclan(url, referer);
    if (isJavggvideo(url))   return extractJavggvideo(url);
    return null;
}
