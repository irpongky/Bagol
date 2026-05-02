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

function unpackJS(packed) {
    try {
        const match = packed.match(/\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/);
        if (!match) return null;
        const [, p, a, , k] = match;
        const keywords = k.split('|');
        return p.replace(/\b\w+\b/g, w => {
            const n = parseInt(w, parseInt(a));
            return keywords[n] || w;
        });
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// DoodStream
// ─────────────────────────────────────────────

const DOOD_HOSTS = [
    'myvidplay.com', 'doply.net', 'playmogo.com', 'dood.pm',
    'ds2play.com', 'd000d.com', 'dooood.com', 'do0od.com',
];

export function isDoodStream(url) {
    return DOOD_HOSTS.some(h => url.includes(h));
}

export async function extractDoodStream(url) {
    try {
        const embedUrl = url.replace('doply.net', 'myvidplay.com');
        const refHost = 'https://myvidplay.com';
        const html = await fetchText(embedUrl, {
            headers: { 'User-Agent': UA, 'Referer': refHost }
        });

        const md5Match = html.match(/\/pass_md5\/([^/]*)\/([^/']*)/);
        if (!md5Match) return null;

        const [fullPath, expiry, token] = md5Match;
        const md5Url = refHost + fullPath;

        const baseLink = (await fetchText(md5Url, {
            headers: { 'User-Agent': UA, 'Referer': embedUrl }
        })).trim();

        const directUrl = token && expiry
            ? `${baseLink}?token=${token}&expiry=${expiry}000`
            : baseLink;

        return [{
            name: 'DoodStream',
            title: 'DoodStream',
            url: directUrl,
            quality: 'auto',
            headers: { 'User-Agent': UA, 'Referer': refHost }
        }];
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Filemoon
// ─────────────────────────────────────────────

const FILEMOON_HOSTS = [
    'filemoon.to', 'filemoon.in', 'filemoon.sx',
    'bysedikamoum.com', 'bysezoxexe.com', 'x08.ovh', 'javmoon.me',
];

export function isFilemoon(url) {
    return FILEMOON_HOSTS.some(h => url.includes(h));
}

export async function extractFilemoon(url) {
    try {
        const mediaId = (url.match(/\/(?:e|d|v|f|download)\/([0-9a-zA-Z]+)/) || [])[1]
            || url.split('/').pop().split('?')[0];
        const host = new URL(url).host;
        const rootRef = `https://${host}/`;
        const apiUrl = `https://${host}/api/videos/${mediaId}/embed/playback`;

        const headers = {
            'User-Agent': UA,
            'Referer': rootRef,
            'Origin': `https://${host}`,
            'X-Requested-With': 'XMLHttpRequest'
        };

        const json = await fetchJson(apiUrl, { headers });

        let sources = json.sources;

        if (!sources && json.playback) {
            const pb = json.playback;
            const keyParts = pb.key_parts.map(p => base64UrlToBytes(p));
            const keyBytes = new Uint8Array(keyParts.reduce((acc, b) => [...acc, ...b], []));
            const plain = await aesGcmDecrypt(keyBytes, pb.iv, pb.payload);
            sources = JSON.parse(plain).sources;
        }

        if (!sources) return null;

        return sources.map(s => ({
            name: 'Filemoon',
            title: s.label ? `Filemoon ${s.label}p` : 'Filemoon',
            url: s.url,
            quality: s.label || 'auto',
            headers: { 'Referer': rootRef, 'User-Agent': UA }
        }));
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// LuluStream
// ─────────────────────────────────────────────

const LULU_HOSTS = [
    'lulustream.com', 'luluvid.com', 'luluvdo.com',
    'luluvdoo.com', 'lulupvp.com', 'lulu.dlc.ovh', 'lulu0.ovh',
    'ludwigurl.com', 'lulu.sx', 'luluscam.com',
];

export function isLuluStream(url) {
    return LULU_HOSTS.some(h => url.includes(h));
}

export async function extractLuluStream(url) {
    try {
        let embedUrl = url;
        if (url.includes('/d/')) embedUrl = url.replace('/d/', '/e/');
        else if (url.includes('/f/')) embedUrl = url.replace('/f/', '/e/');

        const origin = new URL(embedUrl).origin;
        const html = await fetchText(embedUrl, {
            headers: {
                'User-Agent': UA,
                'Referer': url,
                'Origin': origin,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        // Try packed scripts first
        let unpacked = '';
        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?<\/script>/);
        if (packedMatch) {
            unpacked = unpackJS(packedMatch[0]) || '';
        }

        const searchText = unpacked + html;

        // Multiple patterns for LuluStream
        let m = searchText.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
        if (!m) m = searchText.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
        if (!m) m = searchText.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
        if (!m) m = html.match(/["']([^"']+\.m3u8[^"']*)["']/);

        if (!m) return null;

        return [{
            name: 'LuluStream',
            title: 'LuluStream',
            url: m[1],
            quality: 'auto',
            headers: { 'Referer': embedUrl, 'Origin': origin, 'User-Agent': UA }
        }];
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Player4Me
// ─────────────────────────────────────────────

const PLAYER4ME_HOSTS = [
    'player4me.online', 'player4me.vip', 'rpmplay.online',
    'player4me.xyz', 'player4me.cc', 'play4me.online',
    'play4me.vip', 'p4me.xyz', 'p4mplay.xyz',
];

export function isPlayer4Me(url) {
    return PLAYER4ME_HOSTS.some(h => url.includes(h));
}

export async function extractPlayer4Me(url) {
    try {
        const mainUrl = new URL(url).origin;
        const id = url.split('#')[1] || url.split('/').pop().split('?')[0];
        const apiUrl = `${mainUrl}/api/v1/video?id=${id}`;

        const raw = (await fetchText(apiUrl, {
            headers: {
                'Host': new URL(url).host,
                'User-Agent': UA,
                'Accept': '*/*',
                'Cookie': 'popunderCount/=1',
                'Referer': mainUrl + '/'
            }
        })).trim();

        if (raw.startsWith('<html>') || raw.startsWith('<!DOCTYPE')) return null;

        const plain = await aesCbcDecrypt(raw, 'kiemtienmua911ca', '1234567890oiuytr');
        const data = JSON.parse(plain);
        const videoUrl = data.source || data.hls || data.cf || (data.sources && data.sources[0] && data.sources[0].file);
        if (!videoUrl) return null;

        return [{
            name: 'Player4Me',
            title: 'Player4Me',
            url: videoUrl,
            quality: 'auto',
            headers: { 'User-Agent': UA, 'Referer': mainUrl + '/' }
        }];
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Vidguard
// ─────────────────────────────────────────────

export function isVidguard(url) {
    return url.includes('vidguard.to');
}

export async function extractVidguard(url) {
    try {
        const html = await fetchText(url, { headers: { 'User-Agent': UA } });
        const sigMatch = html.match(/sig=([a-fA-F0-9]+)/);
        if (!sigMatch) return null;

        let sig = sigMatch[1];
        let t = '';
        for (let i = 0; i < sig.length; i += 2) {
            t += String.fromCharCode(parseInt(sig.slice(i, i + 2), 16) ^ 2);
        }
        const padding = [0, 0, 2, 1][t.length % 4];
        const decoded = atob(t + '='.repeat(padding));
        let s = decoded.slice(0, -5).split('').reverse().join('');
        const arr = s.split('');
        for (let i = 0; i < arr.length - 1; i += 2) {
            [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        }
        const modifiedSig = arr.join('').slice(0, -5);
        const streamUrl = url.replace(sigMatch[1], modifiedSig);

        return [{
            name: 'Vidguard',
            title: 'Vidguard',
            url: streamUrl,
            quality: 'auto',
            headers: { 'Referer': 'https://vidguard.to', 'User-Agent': UA }
        }];
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// VidNest
// ─────────────────────────────────────────────

export function isVidNest(url) {
    return url.includes('vidnest.io');
}

export async function extractVidNest(url) {
    try {
        const html = await fetchText(url, {
            headers: { 'User-Agent': UA, 'Referer': 'https://vidnest.io/' }
        });
        const fileMatch = html.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/);
        const labelMatch = html.match(/label\s*:\s*["']([^"']+)["']/);
        if (!fileMatch) return null;

        return [{
            name: 'VidNest',
            title: `VidNest ${labelMatch?.[1] || ''}`.trim(),
            url: fileMatch[1],
            quality: labelMatch?.[1] || 'auto',
            headers: { 'User-Agent': UA, 'Referer': 'https://vidnest.io/', 'Origin': 'https://vidnest.io' }
        }];
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Streamwish
// ─────────────────────────────────────────────

const STREAMWISH_HOSTS = [
    'streamwish.to', 'streamhihi.com', 'javsw.me', 'swhoi.com',
    'muvicloud.com', 'stream.lol', 'playerwish.com', 'wishfast.top',
];

export function isStreamwish(url) {
    return STREAMWISH_HOSTS.some(h => url.includes(h));
}

export async function extractStreamwish(url) {
    try {
        const html = await fetchText(url, { headers: { 'User-Agent': UA } });

        let unpacked = '';
        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?<\/script>/);
        if (packedMatch) {
            unpacked = unpackJS(packedMatch[0]) || '';
        }

        const searchText = unpacked + html;
        const fileMatch = searchText.match(/file:\s*["']([^"']+)["']/);
        if (!fileMatch) return null;

        return [{
            name: 'Streamwish',
            title: 'Streamwish',
            url: fileMatch[1],
            quality: 'auto',
            headers: { 'User-Agent': UA }
        }];
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Vidhidepro
// ─────────────────────────────────────────────

const VIDHIDE_HOSTS = ['vidhidepro.com', 'vidhidevip.com', 'vidhide.com', 'javlion.xyz', 'hideguard.com'];

export function isVidhidepro(url) {
    return VIDHIDE_HOSTS.some(h => url.includes(h));
}

export async function extractVidhidepro(url) {
    try {
        const html = await fetchText(url, { headers: { 'User-Agent': UA } });

        let unpacked = '';
        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?<\/script>/);
        if (packedMatch) {
            unpacked = unpackJS(packedMatch[0]) || '';
        }

        const searchText = unpacked + html;
        const fileMatch = searchText.match(/sources:\s*\[\s*\{\s*file:\s*"([^"]+\.m3u8[^"]*)"/);
        if (!fileMatch) return null;

        return [{
            name: 'Vidhidepro',
            title: 'Vidhidepro',
            url: fileMatch[1],
            quality: 'auto',
            headers: { 'Referer': new URL(url).origin + '/', 'User-Agent': UA }
        }];
    } catch {
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
        const html = await fetchText(url, { headers: { 'User-Agent': UA } });
        const packed = html.match(/function\(p,a,c,k,e,d\)[\s\S]+?(?=<\/script>)/)?.[0];
        if (!packed) return null;

        const decoded = unpackJS(packed);
        const fileMatch = decoded?.match(/file:\s*["']([^"']+)["']/);
        if (!fileMatch) return null;

        return [{
            name: 'Maxstream',
            title: 'Maxstream',
            url: fileMatch[1],
            quality: 'auto',
            headers: { 'User-Agent': UA }
        }];
    } catch {
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
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Referer': referer || url }
        });
        if (!res.ok) return null;
        const html = await res.text();

        let unpacked = '';
        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?<\/script>/);
        if (packedMatch) {
            unpacked = unpackJS(packedMatch[0]) || '';
        }

        const searchText = unpacked + html;
        const fileMatch = searchText.match(/file:\s*["']([^"']+)["']/);
        if (!fileMatch) return null;

        return [{
            name: 'Javclan',
            title: 'Javclan',
            url: fileMatch[1],
            quality: 'auto',
            headers: { 'Referer': referer || url, 'User-Agent': UA }
        }];
    } catch {
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
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// MixDrop
// ─────────────────────────────────────────────

const MIXDROP_HOSTS = [
    'mixdrop.ag', 'mixdrop.my', 'mixdrop.is', 'mixdrop.co',
    'mixdrop.ch', 'mixdrop.to', 'mixdrop.club', 'mixdrop.sx',
];

export function isMixdrop(url) {
    return MIXDROP_HOSTS.some(h => url.includes(h));
}

export async function extractMixdrop(url) {
    try {
        let embedUrl = url;
        if (url.includes('/f/')) embedUrl = url.replace('/f/', '/e/');

        const host = new URL(embedUrl).origin;
        const html = await fetchText(embedUrl, {
            headers: {
                'User-Agent': UA,
                'Referer': host + '/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });

        let unpacked = '';
        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?<\/script>/);
        if (packedMatch) {
            unpacked = unpackJS(packedMatch[0]) || '';
        }

        const searchText = unpacked + html;

        // Multiple patterns for MixDrop
        let m = searchText.match(/MDCore\.\w+\s*=\s*["']([^"']+)["']/);
        if (!m) m = searchText.match(/(?:var\s+)?\b(wurl|vurl|surl|href)\s*=\s*["']([^"']+)["']/);
        if (!m) m = searchText.match(/src\s*:\s*["']([^"']+\.mp4[^"']*)["']/);
        if (!m) m = searchText.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/);

        if (!m) return null;

        let videoUrl = m[1] || m[2];

        // Decode if base64 encoded
        if (videoUrl && videoUrl.match(/^[A-Za-z0-9+/=]{20,}$/)) {
            try { videoUrl = atob(videoUrl); } catch (e) {}
        }

        if (videoUrl && videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
        if (videoUrl && !videoUrl.startsWith('http')) {
            videoUrl = host + (videoUrl.startsWith('/') ? '' : '/') + videoUrl;
        }

        if (!videoUrl || !videoUrl.startsWith('http')) return null;

        return [{
            name: 'MixDrop',
            title: 'MixDrop',
            url: videoUrl,
            quality: 'auto',
            headers: { 'User-Agent': UA, 'Referer': host + '/' }
        }];
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Vue
// ─────────────────────────────────────────────

const VUE_HOSTS = ['vue.to', 'vue.tv', 'vueplayer.xyz', 'vueplay.xyz', 'vue.watch'];

export function isVue(url) {
    return VUE_HOSTS.some(h => url.includes(h));
}

export async function extractVue(url) {
    try {
        const host = new URL(url).origin;
        const html = await fetchText(url, {
            headers: {
                'User-Agent': UA,
                'Referer': host + '/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        });

        let unpacked = '';
        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?<\/script>/);
        if (packedMatch) {
            unpacked = unpackJS(packedMatch[0]) || '';
        }

        const searchText = unpacked + html;

        let m = searchText.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (!m) m = searchText.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (!m) m = searchText.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (!m) m = searchText.match(/src\s*=\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);

        if (!m) return null;

        return [{
            name: 'Vue',
            title: 'Vue',
            url: m[1],
            quality: 'auto',
            headers: { 'User-Agent': UA, 'Referer': host + '/' }
        }];
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Upns
// ─────────────────────────────────────────────

const UPNS_HOSTS = ['upns.xyz', 'upns.live', 'upns.cc', 'upns.to', 'upns.click'];

export function isUpns(url) {
    return UPNS_HOSTS.some(h => url.includes(h));
}

export async function extractUpns(url) {
    try {
        const host = new URL(url).origin;
        const html = await fetchText(url, {
            headers: {
                'User-Agent': UA,
                'Referer': host + '/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        });

        let unpacked = '';
        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?<\/script>/);
        if (packedMatch) {
            unpacked = unpackJS(packedMatch[0]) || '';
        }

        const searchText = unpacked + html;

        let m = searchText.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/);
        if (!m) m = searchText.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (!m) m = searchText.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/);

        if (!m) return null;

        return [{
            name: 'Upns',
            title: 'Upns',
            url: m[1],
            quality: 'auto',
            headers: { 'User-Agent': UA, 'Referer': host + '/' }
        }];
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// FilmCDN
// ─────────────────────────────────────────────

const FILMCDN_HOSTS = ['filmcdm.top', 'filmcdn.xyz', 'filmcdn.top'];

export function isFilmcdn(url) {
    return FILMCDN_HOSTS.some(h => url.includes(h));
}

export async function extractFilmcdn(url, referer) {
    try {
        const host = new URL(url).origin;
        let embedUrl = url;
        if (url.includes('/d/')) embedUrl = url.replace('/d/', '/v/');
        else if (url.includes('/download/')) embedUrl = url.replace('/download/', '/v/');
        else if (url.includes('/file/')) embedUrl = url.replace('/file/', '/v/');
        else if (url.includes('/f/')) embedUrl = url.replace('/f/', '/v/');

        const html = await fetchText(embedUrl, {
            headers: {
                'User-Agent': UA,
                'Referer': referer || host + '/',
                'Origin': host,
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'cross-site'
            }
        });

        let script = html;

        const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?<\/script>/);
        if (packedMatch) {
            let unpacked = unpackJS(packedMatch[0]) || '';
            if (unpacked.includes('var links')) {
                unpacked = unpacked.substring(unpacked.indexOf('var links'));
            }
            script = unpacked;
        } else {
            const sourcesMatch = html.match(/<script[^>]*>([\s\S]*?sources:[\s\S]*?)<\/script>/);
            if (sourcesMatch) script = sourcesMatch[1];
        }

        if (!script) return null;

        const streams = [];
        const regex = /:\s*"(.*?m3u8.*?)"/g;
        let match;
        while ((match = regex.exec(script)) !== null) {
            const m3u8Url = match[1];
            if (m3u8Url.startsWith('http')) {
                streams.push({
                    name: 'FilmCDN',
                    title: 'FilmCDN',
                    url: m3u8Url,
                    quality: 'auto',
                    headers: {
                        'User-Agent': UA,
                        'Referer': referer || host + '/',
                        'Origin': host,
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'cross-site'
                    }
                });
            }
        }

        return streams.length ? streams : null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Generic extractor dispatcher
// ─────────────────────────────────────────────

export async function extractFromUrl(url, referer) {
    if (isDoodStream(url))     return extractDoodStream(url);
    if (isFilemoon(url))       return extractFilemoon(url);
    if (isLuluStream(url))     return extractLuluStream(url);
    if (isPlayer4Me(url))      return extractPlayer4Me(url);
    if (isVidguard(url))       return extractVidguard(url);
    if (isVidNest(url))        return extractVidNest(url);
    if (isStreamwish(url))     return extractStreamwish(url);
    if (isVidhidepro(url))     return extractVidhidepro(url);
    if (isMaxstream(url))      return extractMaxstream(url);
    if (isJavclan(url))        return extractJavclan(url, referer);
    if (isJavggvideo(url))     return extractJavggvideo(url);
    if (isMixdrop(url))        return extractMixdrop(url);
    if (isVue(url))            return extractVue(url);
    if (isUpns(url))           return extractUpns(url);
    if (isFilmcdn(url))        return extractFilmcdn(url, referer);
    return null;
}
