import { fetchText, fetchJson, UA } from './http.js';
// crypto-js is provided by the Nuvio app runtime (external, not bundled)
import CryptoJS from 'crypto-js';

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

// base64url → string (atob is available as a global in React Native / Hermes)
function base64UrlDecode(str) {
    return atob(str.replace(/-/g, '+').replace(/_/g, '/').padEnd(
        str.length + (4 - str.length % 4) % 4, '='
    ));
}

// AES-CBC decrypt using crypto-js (works in Hermes)
function aesCbcDecrypt(cipherB64, keyStr, ivStr) {
    const normalized = cipherB64.replace(/-/g, '+').replace(/_/g, '/');
    const key = CryptoJS.enc.Utf8.parse(keyStr);
    const iv  = CryptoJS.enc.Utf8.parse(ivStr);
    const decrypted = CryptoJS.AES.decrypt(normalized, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

// NOTE: AES-GCM is NOT supported by crypto-js and crypto.subtle is unavailable
// in Hermes (React Native). Filemoon's encrypted API path will fall through to
// the HTML fallback — that's intentional.

// ─────────────────────────────────────────────
// DoodStream  (myvidplay.com / doply.net / playmogo.com / dood.*)
// ─────────────────────────────────────────────

const DOOD_HOSTS = [
    'myvidplay.com', 'doply.net', 'playmogo.com', 'dood.pm',
    'ds2play.com', 'd000d.com', 'doodstream.com', 'dood.to',
    'dood.watch', 'dooood.com', 'doodad.pro', 'dood.wf',
    'dood.cx', 'dood.la', 'dood.sh', 'dood.re', 'dood.so',
    'dood.yt', 'dood.stream', 'doodcdn.com', 'doods.pro',
];

export function isDoodStream(url) {
    return DOOD_HOSTS.some(h => url.includes(h));
}

export async function extractDoodStream(url) {
    try {
        // Normalize known aliases to their canonical host
        const embedUrl = url
            .replace('doply.net', 'myvidplay.com')
            .replace('d000d.com', 'myvidplay.com');
        const embedOrigin = new URL(embedUrl).origin;

        const html = await fetchText(embedUrl, {
            headers: { 'User-Agent': UA, 'Referer': embedOrigin + '/' }
        });

        const md5Match = html.match(/\/pass_md5\/([^/]*)\/([^/']*)/);
        if (!md5Match) return null;

        // md5Match[0] = full path, [1] = id/expiry segment, [2] = token
        const [fullPath, expiry, token] = md5Match;
        // IMPORTANT: use same origin as embed, not hardcoded myvidplay.com
        const md5Url = embedOrigin + fullPath;

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
            headers: { 'User-Agent': UA, 'Referer': embedOrigin + '/' }
        }];
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Filemoon  (filemoon.to / filemoon.in / filemoon.sx / etc.)
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
            || url.split('/').filter(Boolean).pop().split('?')[0];
        const host = new URL(url).host;
        const rootRef = `https://${host}/`;
        const embedUrl = `https://${host}/e/${mediaId}`;

        const headers = {
            'User-Agent': UA,
            'Referer': rootRef,
            'Origin': `https://${host}`,
            'X-Requested-With': 'XMLHttpRequest'
        };

        // Try API first (unencrypted sources only — AES-GCM not available in Hermes)
        try {
            const apiUrl = `https://${host}/api/videos/${mediaId}/embed/playback`;
            const json = await fetchJson(apiUrl, { headers });
            const sources = json.sources;

            if (sources && sources.length) {
                return sources.map(s => ({
                    name: 'Filemoon',
                    title: s.label ? `Filemoon ${s.label}p` : 'Filemoon',
                    url: s.url,
                    quality: s.label || 'auto',
                    headers: { 'Referer': rootRef, 'User-Agent': UA }
                }));
            }
        } catch {}

        // Fallback: parse embed HTML
        const html = await fetchText(embedUrl, {
            headers: { 'User-Agent': UA, 'Referer': rootRef }
        });

        // sources:[{file:"...",...}]
        const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
        if (sourcesMatch) {
            return [{
                name: 'Filemoon',
                title: 'Filemoon',
                url: sourcesMatch[1],
                quality: 'auto',
                headers: { 'Referer': rootRef, 'User-Agent': UA }
            }];
        }

        // jwplayer file
        const jwMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (jwMatch) {
            return [{
                name: 'Filemoon',
                title: 'Filemoon',
                url: jwMatch[1],
                quality: 'auto',
                headers: { 'Referer': rootRef, 'User-Agent': UA }
            }];
        }

        // bare m3u8 URL in quotes
        const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
        if (m3u8Match) {
            return [{
                name: 'Filemoon',
                title: 'Filemoon',
                url: m3u8Match[1],
                quality: 'auto',
                headers: { 'Referer': rootRef, 'User-Agent': UA }
            }];
        }

        return null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// LuluStream  (lulustream.com / luluvid.com / etc.)
// ─────────────────────────────────────────────

const LULU_HOSTS = [
    'lulustream.com', 'luluvid.com', 'luluvdo.com',
    'luluvdoo.com', 'lulupvp.com', 'lulu.dlc.ovh', 'lulu0.ovh',
];

export function isLuluStream(url) {
    return LULU_HOSTS.some(h => url.includes(h));
}

export async function extractLuluStream(url) {
    try {
        const embedUrl = url.includes('/e/') ? url : url.replace('/d/', '/e/');
        const origin = new URL(embedUrl).origin;
        const html = await fetchText(embedUrl, {
            headers: {
                'User-Agent': UA,
                'Referer': url,
                'Origin': origin
            }
        });

        // sources:[{file:"..."}]
        const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
        if (sourcesMatch) {
            return [{
                name: 'LuluStream',
                title: 'LuluStream',
                url: sourcesMatch[1],
                quality: 'auto',
                headers: { 'Referer': embedUrl, 'Origin': origin, 'User-Agent': UA }
            }];
        }

        // m3u8 in quotes
        const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
        if (m3u8Match) {
            return [{
                name: 'LuluStream',
                title: 'LuluStream',
                url: m3u8Match[1],
                quality: 'auto',
                headers: { 'Referer': embedUrl, 'Origin': origin, 'User-Agent': UA }
            }];
        }

        // relative m3u8
        const relMatch = html.match(/["']([^"']+\.m3u8[^"']*)["']/);
        if (relMatch) {
            const videoUrl = relMatch[1].startsWith('http')
                ? relMatch[1]
                : `${origin}${relMatch[1].startsWith('/') ? '' : '/'}${relMatch[1]}`;
            return [{
                name: 'LuluStream',
                title: 'LuluStream',
                url: videoUrl,
                quality: 'auto',
                headers: { 'Referer': embedUrl, 'Origin': origin, 'User-Agent': UA }
            }];
        }

        return null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Player4Me  (player4me.online / player4me.vip / rpmplay.online)
// ─────────────────────────────────────────────

const PLAYER4ME_HOSTS = [
    'player4me.online', 'player4me.vip', 'rpmplay.online',
];

export function isPlayer4Me(url) {
    return PLAYER4ME_HOSTS.some(h => url.includes(h));
}

export async function extractPlayer4Me(url) {
    try {
        const parsedUrl = new URL(url);
        const mainUrl = parsedUrl.origin;
        const id = parsedUrl.hash.slice(1) || parsedUrl.searchParams.get('id') || parsedUrl.pathname.split('/').filter(Boolean).pop();
        const apiUrl = `${mainUrl}/api/v1/video?id=${id}`;

        const raw = (await fetchText(apiUrl, {
            headers: {
                'Host': parsedUrl.host,
                'User-Agent': UA,
                'Accept': '*/*',
                'Cookie': 'popunderCount/=1',
                'Referer': mainUrl + '/'
            }
        })).trim();

        if (!raw || raw.startsWith('<')) return null;

        // Try direct JSON first (unencrypted response)
        try {
            const data = JSON.parse(raw);
            const videoUrl = data.source || data.hls || data.cf || data.url;
            if (videoUrl) {
                return [{
                    name: 'Player4Me',
                    title: 'Player4Me',
                    url: videoUrl,
                    quality: 'auto',
                    headers: { 'User-Agent': UA, 'Referer': mainUrl + '/' }
                }];
            }
        } catch {}

        // Try with known keys
        const KEYS = [
            { key: 'kiemtienmua911ca', iv: '1234567890oiuytr' },
            { key: 'kiemtienmua911ab', iv: '1234567890abcdef' },
        ];

        for (const { key, iv } of KEYS) {
            try {
                const plain = await aesCbcDecrypt(raw, key, iv);
                const data = JSON.parse(plain);
                const videoUrl = data.source || data.hls || data.cf || data.url;
                if (videoUrl) {
                    return [{
                        name: 'Player4Me',
                        title: 'Player4Me',
                        url: videoUrl,
                        quality: 'auto',
                        headers: { 'User-Agent': UA, 'Referer': mainUrl + '/' }
                    }];
                }
            } catch {}
        }

        return null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Vidguard
// ─────────────────────────────────────────────

export function isVidguard(url) {
    return url.includes('vidguard.to') || url.includes('listeamed.net') || url.includes('bembed.net');
}

export async function extractVidguard(url) {
    try {
        const html = await fetchText(url, { headers: { 'User-Agent': UA, 'Referer': 'https://vidguard.to/' } });

        // Try direct stream URL in HTML (e.g. jwplayer sources)
        const jwMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (jwMatch) {
            return [{
                name: 'Vidguard',
                title: 'Vidguard',
                url: jwMatch[1],
                quality: 'auto',
                headers: { 'Referer': 'https://vidguard.to/', 'User-Agent': UA }
            }];
        }

        // sig-based decoding
        const sigMatch = html.match(/sig=([a-fA-F0-9]{20,})/);
        if (sigMatch) {
            let sig = sigMatch[1];
            let t = '';
            for (let i = 0; i < sig.length; i += 2) {
                t += String.fromCharCode(parseInt(sig.slice(i, i + 2), 16) ^ 2);
            }
            try {
                const padding = [0, 0, 2, 1][t.length % 4];
                const decoded = atob(t + '='.repeat(padding));
                let s = decoded.slice(0, -5).split('').reverse().join('');
                const arr = s.split('');
                for (let i = 0; i < arr.length - 1; i += 2) {
                    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                }
                const modifiedSig = arr.join('').slice(0, -5);

                // Find the CDN URL pattern in HTML that contains sig=
                const cdnMatch = html.match(/["'](https?:\/\/[^"']*sig=[a-fA-F0-9]+[^"']*)["']/);
                if (cdnMatch) {
                    const streamUrl = cdnMatch[1].replace(sigMatch[1], modifiedSig);
                    return [{
                        name: 'Vidguard',
                        title: 'Vidguard',
                        url: streamUrl,
                        quality: 'auto',
                        headers: { 'Referer': 'https://vidguard.to/', 'User-Agent': UA }
                    }];
                }
            } catch {}
        }

        // Fallback: any m3u8 or mp4 in HTML
        const fallback = html.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (fallback) {
            return [{
                name: 'Vidguard',
                title: 'Vidguard',
                url: fallback[1],
                quality: 'auto',
                headers: { 'Referer': 'https://vidguard.to/', 'User-Agent': UA }
            }];
        }

        return null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// VidNest
// ─────────────────────────────────────────────

export function isVidNest(url) {
    return url.includes('vidnest.io') || url.includes('vidnest.net');
}

export async function extractVidNest(url) {
    try {
        const host = new URL(url).origin;
        const html = await fetchText(url, {
            headers: { 'User-Agent': UA, 'Referer': `${host}/` }
        });

        // sources array
        const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
        if (sourcesMatch) {
            const labelMatch = html.match(/label\s*:\s*["']([^"']+)["']/);
            return [{
                name: 'VidNest',
                title: `VidNest ${labelMatch?.[1] || ''}`.trim(),
                url: sourcesMatch[1],
                quality: labelMatch?.[1] || 'auto',
                headers: { 'User-Agent': UA, 'Referer': `${host}/`, 'Origin': host }
            }];
        }

        // file: pattern (mp4 or m3u8)
        const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/);
        if (fileMatch) {
            const labelMatch = html.match(/label\s*:\s*["']([^"']+)["']/);
            return [{
                name: 'VidNest',
                title: `VidNest ${labelMatch?.[1] || ''}`.trim(),
                url: fileMatch[1],
                quality: labelMatch?.[1] || 'auto',
                headers: { 'User-Agent': UA, 'Referer': `${host}/`, 'Origin': host }
            }];
        }

        return null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Streamwish  (streamwish.to / streamhihi.com / javsw.me / swhoi.com)
// ─────────────────────────────────────────────

const STREAMWISH_HOSTS = [
    'streamwish.to', 'streamhihi.com', 'javsw.me', 'swhoi.com',
    'swdyu.com', 'swhhd.com', 'awish.net', 'streamwish.com',
];

export function isStreamwish(url) {
    return STREAMWISH_HOSTS.some(h => url.includes(h));
}

export async function extractStreamwish(url) {
    try {
        const html = await fetchText(url, { headers: { 'User-Agent': UA, 'Referer': url } });

        // sources:[{file:"..."}]
        const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
        if (sourcesMatch) {
            return [{
                name: 'Streamwish',
                title: 'Streamwish',
                url: sourcesMatch[1],
                quality: 'auto',
                headers: { 'User-Agent': UA }
            }];
        }

        // file: "..." or file: '...'
        const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (fileMatch) {
            return [{
                name: 'Streamwish',
                title: 'Streamwish',
                url: fileMatch[1],
                quality: 'auto',
                headers: { 'User-Agent': UA }
            }];
        }

        // bare m3u8
        const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
        if (m3u8Match) {
            return [{
                name: 'Streamwish',
                title: 'Streamwish',
                url: m3u8Match[1],
                quality: 'auto',
                headers: { 'User-Agent': UA }
            }];
        }

        return null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Vidhidepro  (vidhidepro.com / vidhidevip.com / javlion.xyz)
// ─────────────────────────────────────────────

const VIDHIDE_HOSTS = ['vidhidepro.com', 'vidhidevip.com', 'javlion.xyz', 'vidhide.com'];

export function isVidhidepro(url) {
    return VIDHIDE_HOSTS.some(h => url.includes(h));
}

export async function extractVidhidepro(url) {
    try {
        const origin = new URL(url).origin;
        const html = await fetchText(url, {
            headers: { 'User-Agent': UA, 'Referer': origin + '/' }
        });

        // sources:[{file:"..."}] — accept any URL (not just m3u8)
        const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
        if (sourcesMatch) {
            return [{
                name: 'Vidhidepro',
                title: 'Vidhidepro',
                url: sourcesMatch[1],
                quality: 'auto',
                headers: { 'Referer': origin + '/', 'User-Agent': UA }
            }];
        }

        // file: "..." pattern
        const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (fileMatch) {
            return [{
                name: 'Vidhidepro',
                title: 'Vidhidepro',
                url: fileMatch[1],
                quality: 'auto',
                headers: { 'Referer': origin + '/', 'User-Agent': UA }
            }];
        }

        // bare m3u8
        const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
        if (m3u8Match) {
            return [{
                name: 'Vidhidepro',
                title: 'Vidhidepro',
                url: m3u8Match[1],
                quality: 'auto',
                headers: { 'Referer': origin + '/', 'User-Agent': UA }
            }];
        }

        return null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Maxstream
// ─────────────────────────────────────────────

export function isMaxstream(url) {
    return url.includes('maxstream.org') || url.includes('maxstream.video');
}

export async function extractMaxstream(url) {
    try {
        const html = await fetchText(url, { headers: { 'User-Agent': UA } });

        // direct file: pattern
        const directMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (directMatch) {
            return [{
                name: 'Maxstream',
                title: 'Maxstream',
                url: directMatch[1],
                quality: 'auto',
                headers: { 'User-Agent': UA }
            }];
        }

        // p,a,c,k obfuscated JS
        const packed = html.match(/\}\s*\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/)?.[0]
            || html.match(/function\(p,a,c,k,e,d\)[\s\S]+?(?=<\/script>)/)?.[0];

        if (packed) {
            const decoded = unpackJS(packed);
            if (decoded) {
                const fileMatch = decoded.match(/file\s*:\s*["']([^"']+)["']/);
                if (fileMatch) {
                    return [{
                        name: 'Maxstream',
                        title: 'Maxstream',
                        url: fileMatch[1],
                        quality: 'auto',
                        headers: { 'User-Agent': UA }
                    }];
                }
            }
        }

        // bare m3u8
        const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
        if (m3u8Match) {
            return [{
                name: 'Maxstream',
                title: 'Maxstream',
                url: m3u8Match[1],
                quality: 'auto',
                headers: { 'User-Agent': UA }
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
        if (!match) return null;
        const [, p, a, , k] = match;
        const keywords = k.split('|');
        const base = parseInt(a);
        return p.replace(/\b\w+\b/g, w => {
            const n = parseInt(w, base);
            return (isNaN(n) ? w : keywords[n]) || w;
        });
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
        const html = await fetchText(url, {
            headers: { 'User-Agent': UA, 'Referer': referer || url }
        });

        // sources:[{file:"..."}]
        const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
        if (sourcesMatch) {
            return [{
                name: 'Javclan',
                title: 'Javclan',
                url: sourcesMatch[1],
                quality: 'auto',
                headers: { 'Referer': referer || url, 'User-Agent': UA }
            }];
        }

        // file: pattern
        const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (fileMatch) {
            return [{
                name: 'Javclan',
                title: 'Javclan',
                url: fileMatch[1],
                quality: 'auto',
                headers: { 'Referer': referer || url, 'User-Agent': UA }
            }];
        }

        return null;
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

        // Multiple variable name patterns
        const varPatterns = [
            /var\s+urlPlay\s*=\s*['"]([^'"]+)['"]/,
            /urlPlay\s*=\s*['"]([^'"]+)['"]/,
            /var\s+videoUrl\s*=\s*['"]([^'"]+)['"]/,
            /var\s+streamUrl\s*=\s*['"]([^'"]+)['"]/,
            /var\s+src\s*=\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/,
        ];

        for (const pattern of varPatterns) {
            const match = html.match(pattern);
            if (match && match[1].startsWith('http')) {
                return [{
                    name: 'Javggvideo',
                    title: 'Javggvideo',
                    url: match[1],
                    quality: 'auto',
                    headers: { 'User-Agent': UA }
                }];
            }
        }

        // sources:[{file:"..."}]
        const sourcesMatch = html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*["']([^"']+)["']/);
        if (sourcesMatch) {
            return [{
                name: 'Javggvideo',
                title: 'Javggvideo',
                url: sourcesMatch[1],
                quality: 'auto',
                headers: { 'User-Agent': UA }
            }];
        }

        // file: pattern
        const fileMatch = html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/);
        if (fileMatch) {
            return [{
                name: 'Javggvideo',
                title: 'Javggvideo',
                url: fileMatch[1],
                quality: 'auto',
                headers: { 'User-Agent': UA }
            }];
        }

        // bare m3u8
        const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
        if (m3u8Match) {
            return [{
                name: 'Javggvideo',
                title: 'Javggvideo',
                url: m3u8Match[1],
                quality: 'auto',
                headers: { 'User-Agent': UA }
            }];
        }

        return null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// MixDrop
// ─────────────────────────────────────────────

export function isMixDrop(url) {
    return url.includes('mixdrop.') || url.includes('mixdrp.');
}

export async function extractMixDrop(url) {
    try {
        const html = await fetchText(url, { headers: { 'User-Agent': UA } });

        // Unpacked wideo source
        const packed = html.match(/\}\s*\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/)?.[0];
        if (packed) {
            const decoded = unpackJS(packed);
            if (decoded) {
                const srcMatch = decoded.match(/(?:MDCore\.wurl|wurl)\s*=\s*["']([^"']+)["']/);
                if (srcMatch) {
                    const videoUrl = srcMatch[1].startsWith('//') ? 'https:' + srcMatch[1] : srcMatch[1];
                    return [{
                        name: 'MixDrop',
                        title: 'MixDrop',
                        url: videoUrl,
                        quality: 'auto',
                        headers: { 'User-Agent': UA, 'Referer': 'https://mixdrop.ag/' }
                    }];
                }
            }
        }

        // wurl direct
        const wurlMatch = html.match(/(?:MDCore\.wurl|wurl)\s*=\s*["']([^"']+)["']/);
        if (wurlMatch) {
            const videoUrl = wurlMatch[1].startsWith('//') ? 'https:' + wurlMatch[1] : wurlMatch[1];
            return [{
                name: 'MixDrop',
                title: 'MixDrop',
                url: videoUrl,
                quality: 'auto',
                headers: { 'User-Agent': UA, 'Referer': 'https://mixdrop.ag/' }
            }];
        }

        return null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// StreamTape  (streamtape.com / streamtape.to / streamtape.net / etc.)
// ─────────────────────────────────────────────

const STREAMTAPE_HOSTS = [
    'streamtape.com', 'streamtape.to', 'streamtape.net', 'streamtape.xyz',
    'streamtape.site', 'shavetape.cash', 'tapecontent.net',
];

export function isStreamtape(url) {
    return STREAMTAPE_HOSTS.some(h => url.includes(h));
}

export async function extractStreamtape(url) {
    try {
        const html = await fetchText(url, { headers: { 'User-Agent': UA, 'Referer': url } });

        // StreamTape obfuscates the link across two parts in the HTML
        // Pattern: document.getElementById('...').innerHTML = "..."; + another partial string
        const tokenMatch = html.match(/document\.getElementById\('[^']+'\)\.innerHTML\s*=\s*["']([^"']+)["']/);
        const token2Match = html.match(/\+\s*["']([^"']+)["']\s*;/);
        if (tokenMatch && token2Match) {
            const raw = (tokenMatch[1] + token2Match[1]).replace(/\s/g, '');
            const videoUrl = raw.startsWith('//') ? 'https:' + raw : (raw.startsWith('http') ? raw : 'https://' + raw);
            return [{
                name: 'StreamTape',
                title: 'StreamTape',
                url: videoUrl,
                quality: 'auto',
                headers: { 'User-Agent': UA, 'Referer': url }
            }];
        }

        // Alternative: robotlink / idelink pattern
        const robotMatch = html.match(/id=["']robotlink["'][^>]*>([^<]+)<\/[^>]+>\s*<[^>]+>([^<]+)</);
        if (robotMatch) {
            const videoUrl = 'https:' + robotMatch[1] + robotMatch[2].trim();
            return [{
                name: 'StreamTape',
                title: 'StreamTape',
                url: videoUrl,
                quality: 'auto',
                headers: { 'User-Agent': UA, 'Referer': url }
            }];
        }

        // bare mp4
        const mp4Match = html.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/);
        if (mp4Match) {
            return [{
                name: 'StreamTape',
                title: 'StreamTape',
                url: mp4Match[1],
                quality: 'auto',
                headers: { 'User-Agent': UA, 'Referer': url }
            }];
        }

        return null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// Known embed host checker (used by scrapers as fallback)
// ─────────────────────────────────────────────

const ALL_KNOWN_HOSTS = [
    ...DOOD_HOSTS,
    ...FILEMOON_HOSTS,
    ...LULU_HOSTS,
    ...PLAYER4ME_HOSTS,
    'vidguard.to', 'listeamed.net', 'bembed.net',
    'vidnest.io', 'vidnest.net',
    ...STREAMWISH_HOSTS,
    ...VIDHIDE_HOSTS,
    'maxstream.org', 'maxstream.video',
    'javclan.com',
    'javggvideo.xyz', 'javgg.net',
    'mixdrop.', 'mixdrp.',
    ...STREAMTAPE_HOSTS,
];

export function isKnownEmbedHost(url) {
    try {
        return ALL_KNOWN_HOSTS.some(h => url.includes(h));
    } catch {
        return false;
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
    if (isMixDrop(url))        return extractMixDrop(url);
    if (isStreamtape(url))     return extractStreamtape(url);
    return null;
}
