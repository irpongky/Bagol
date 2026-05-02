// Mangoporn Provider for Nuvio
// Site: mangoporn.net

const cheerio = require("cheerio-without-node-native");

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE_URL = "https://mangoporn.net";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Pure JS AES-128-CBC (no external deps) ────────────────────────────────────
var _S=[99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22];
var _IS=new Array(256); _S.forEach(function(v,i){_IS[v]=i;});
function _gm(a,b){var r=0;while(b){if(b&1)r^=a;a=((a<<1)^(a&128?27:0))&255;b>>=1;}return r;}
function _aesKeyEx(key){
  var w=[],rc=[1,2,4,8,16,32,64,128,27,54],i;
  for(i=0;i<4;i++) w[i]=[key[i*4],key[i*4+1],key[i*4+2],key[i*4+3]];
  for(i=4;i<44;i++){
    var t=w[i-1].slice();
    if(i%4===0){t=[_S[t[1]],_S[t[2]],_S[t[3]],_S[t[0]]];t[0]^=rc[i/4-1];}
    w[i]=w[i-4].map(function(b,j){return b^t[j];});
  }
  var rks=[];for(i=0;i<11;i++){var rk=[];for(var j=0;j<4;j++)rk=rk.concat(w[i*4+j]);rks.push(rk);}return rks;
}
function _aesDecBlk(ct,rks){
  var s=ct.map(function(b,i){return b^rks[10][i];});
  for(var r=9;r>=1;r--){
    var t=s.slice();
    t[1]=s[13];t[5]=s[1];t[9]=s[5];t[13]=s[9];
    t[2]=s[10];t[6]=s[14];t[10]=s[2];t[14]=s[6];
    t[3]=s[7];t[7]=s[11];t[11]=s[15];t[15]=s[3];
    s=t.map(function(b,i){return _IS[b]^rks[r][i];});
    for(var c=0;c<4;c++){
      var a=s[c*4],b=s[c*4+1],cc=s[c*4+2],d=s[c*4+3];
      s[c*4]=_gm(a,14)^_gm(b,11)^_gm(cc,13)^_gm(d,9);
      s[c*4+1]=_gm(a,9)^_gm(b,14)^_gm(cc,11)^_gm(d,13);
      s[c*4+2]=_gm(a,13)^_gm(b,9)^_gm(cc,14)^_gm(d,11);
      s[c*4+3]=_gm(a,11)^_gm(b,13)^_gm(cc,9)^_gm(d,14);
    }
  }
  var t=s.slice();
  t[1]=s[13];t[5]=s[1];t[9]=s[5];t[13]=s[9];
  t[2]=s[10];t[6]=s[14];t[10]=s[2];t[14]=s[6];
  t[3]=s[7];t[7]=s[11];t[11]=s[15];t[15]=s[3];
  return t.map(function(b,i){return _IS[b]^rks[0][i];});
}
function _b64ToBytes(b64){
  b64=b64.replace(/-/g,'+').replace(/_/g,'/');
  while(b64.length%4)b64+='=';
  var bin=atob(b64),out=[];
  for(var i=0;i<bin.length;i++)out.push(bin.charCodeAt(i));
  return out;
}
function aes128cbcDecrypt(b64ct,keyStr,ivStr){
  try {
    var key=[],iv=[];
    for(var i=0;i<16;i++){key.push(keyStr.charCodeAt(i)&255);iv.push(ivStr.charCodeAt(i)&255);}
    var ct=_b64ToBytes(b64ct),rks=_aesKeyEx(key),result=[],prev=iv;
    for(var i=0;i<ct.length;i+=16){
      var blk=ct.slice(i,i+16),dec=_aesDecBlk(blk,rks);
      result=result.concat(dec.map(function(b,j){return b^prev[j];}));
      prev=blk;
    }
    var pad=result[result.length-1];
    return result.slice(0,result.length-pad).map(function(c){return String.fromCharCode(c);}).join('');
  } catch(e) { return null; }
}

// ── Blocked keywords ──────────────────────────────────────────────────────────
var BLOCKED_RE = /\b(?:gay|homosexual|queer|homo|androphile|femboy|effeminate|trap|scat|trans|Trade|Vers|Twink|Otter|Bear|Femme|Masc|Pegging|Femdom|futa|tranny|crossdress|Bisexual|Intersex|LGBTQ|tgirl|t-girl|Transsexual|T-Boy)\b/i;
function isBlocked(t){ return BLOCKED_RE.test(t); }

// ── HTTP ──────────────────────────────────────────────────────────────────────
function fetchText(url, extra) {
  return fetch(url, { headers: Object.assign({"User-Agent":UA,"Accept":"text/html,*/*","Accept-Language":"en-US,en;q=0.9"}, extra||{}) })
    .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.text(); });
}
function fixUrl(href, base) {
  if(!href) return null; href=href.trim();
  if(href.startsWith("http")) return href;
  if(href.startsWith("//")) return "https:"+href;
  return (base||BASE_URL)+(href.startsWith("/")?href:"/"+href);
}

// ── p,a,c,k,e,d unpacker ─────────────────────────────────────────────────────
function unpack(src) {
  if(src.indexOf("eval(function(p,a,c,k,e,")===-1) return src;
  try {
    var m=src.match(/\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('([|]?)'\)/);
    if(!m) return src;
    var p=m[1],base=parseInt(m[2]),keys=m[4].split(m[5]||"|");
    return p.replace(/\b\w+\b/g,function(w){var n=parseInt(w,base);return(n>=0&&n<keys.length&&keys[n]!="")?keys[n]:w;});
  } catch(e){return src;}
}
function findInScripts($, fn) {
  var r=null;
  $("script").each(function(_,el){ if(r) return false; var raw=$(el).html()||""; var found=fn(unpack(raw),raw); if(found){r=found;return false;} });
  return r;
}

// ── TMDB ──────────────────────────────────────────────────────────────────────
function getTmdbTitle(id, type) {
  return fetch("https://api.themoviedb.org/3/"+type+"/"+id+"?api_key="+TMDB_API_KEY, {headers:{"User-Agent":UA}})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(d){return d?(d.title||d.name||null):null;})
    .catch(function(){return null;});
}

// ── Hash-Player extractor ─────────────────────────────────────────────────────
// Covers: Player4Me, UPNS, EasyVidPlayer, RPMPlay, EmbedSeek, SeekPlayer
// All use same API: GET /api/v1/video?id={hash} → AES-CBC JSON → {source|hls|cf}
var HASHPLAYER_KEY = "kiemtienmua911ca";
var HASHPLAYER_IV  = "1234567890oiuytr";

function extractHashPlayer(url, label) {
  var name = label || "Player";
  try {
    var urlObj = new URL(url);
    var host = urlObj.origin;
    var id = url.includes("#") ? url.split("#")[1] : urlObj.pathname.replace(/\//g,"").split("?")[0];
    if(!id) return Promise.resolve(null);

    return fetchText(host+"/api/v1/video?id="+id, {
      "Host": urlObj.host, "Accept": "*/*", "Cookie": "popunderCount/=1", "Referer": host+"/"
    })
    .then(function(raw) {
      raw = raw.trim();
      if(!raw || raw.charAt(0)==="<") return null;
      var decrypted = aes128cbcDecrypt(raw, HASHPLAYER_KEY, HASHPLAYER_IV);
      if(!decrypted) return null;
      var data = JSON.parse(decrypted);
      var videoUrl = data.source || data.hls || data.cf ||
                     (data.sources && data.sources[0] && (data.sources[0].file || data.sources[0].src));
      if(!videoUrl) return null;
      // EmbedSeek/SeekPlayer: cf URL is a txt file → fetch to get real m3u8
      if(videoUrl.endsWith(".txt") || videoUrl.includes("cf-master")) {
        return fetchText(videoUrl, {Referer: host+"/"}).then(function(m3u8){
          m3u8 = m3u8.trim();
          if(!m3u8) return null;
          return [{name:name, title:name, url:m3u8, quality:"auto", headers:{Referer:host+"/","User-Agent":UA}}];
        });
      }
      return [{name:name, title:name, url:videoUrl, quality:"auto", headers:{Referer:host+"/","User-Agent":UA}}];
    })
    .catch(function(e){ console.log("[Mangoporn] "+name+" error: "+e.message); return null; });
  } catch(e) { return Promise.resolve(null); }
}

// ── DoodStream / PlayMogo ─────────────────────────────────────────────────────
function extractDood(url) {
  var host = url.includes("myvidplay.com") ? "https://myvidplay.com"
           : url.includes("doply.net")     ? "https://doply.net"
           : url.includes("playmogo.com")  ? "https://playmogo.com"
           : "https://dood.pm";
  return fetchText(url, {Referer:host})
    .then(function(html){
      var m=html.match(/\/pass_md5\/([^/]+)\/([^'"\s]+)/);
      if(!m) return null;
      return fetchText(host+m[0], {Referer:url}).then(function(base){
        base=base.trim();
        return [{name:"DoodStream",title:"DoodStream",url:base+"?token="+m[2]+"&expiry="+m[1]+"000",quality:"auto",
                 headers:{"User-Agent":UA,Referer:host}}];
      });
    })
    .catch(function(e){ console.log("[Mangoporn] Dood error: "+e.message); return null; });
}

// ── Filemoon ──────────────────────────────────────────────────────────────────
function extractFilemoon(url) {
  var host = new URL(url).origin;
  return fetchText(url, {Referer:BASE_URL+"/", Origin:host})
    .then(function(html){
      var $=cheerio.load(html);
      var fileUrl=findInScripts($,function(up){
        var m=up.match(/sources\s*:\s*\[\s*\{[^}]*file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if(!m) m=up.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        return m?m[1]:null;
      });
      if(!fileUrl) return null;
      return [{name:"Filemoon",title:"Filemoon",url:fileUrl,quality:"auto",headers:{Referer:host+"/",Origin:host}}];
    })
    .catch(function(e){ console.log("[Mangoporn] Filemoon error: "+e.message); return null; });
}

// ── LuluStream ────────────────────────────────────────────────────────────────
function extractLulu(url) {
  var host = new URL(url).origin;
  // Convert /d/ to /e/ if needed
  var embedUrl = url.replace("/d/","/e/");
  return fetchText(embedUrl, {Referer:host+"/", Origin:host, "X-Requested-With":"XMLHttpRequest"})
    .then(function(html){
      var $=cheerio.load(html);
      var fileUrl=findInScripts($,function(up){
        var m=up.match(/sources\s*:\s*\[\s*\{[^}]*file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
        if(!m) m=up.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
        return m?m[1]:null;
      });
      if(!fileUrl) return null;
      return [{name:"LuluStream",title:"LuluStream",url:fileUrl,quality:"auto",
               headers:{Referer:host+"/",Origin:host,"User-Agent":UA}}];
    })
    .catch(function(e){ console.log("[Mangoporn] LuluStream error: "+e.message); return null; });
}

// ── StreamTape ────────────────────────────────────────────────────────────────
function extractStreamTape(url) {
  return fetchText(url, {Referer:"https://streamtape.com/"})
    .then(function(html){
      // StreamTape embeds the URL via: robotlink.innerHTML = "//tapecontent.net/..." + token
      var m=html.match(/innerHTML\s*=\s*["'](\/\/[^"']+)["']\s*\+\s*["']([^"']+)["']/);
      if(!m) {
        // fallback: look for full URL in script
        m=html.match(/["'](https?:\/\/[^"']+tapecontent\.net[^"']+)["']/);
        if(!m) return null;
        return [{name:"StreamTape",title:"StreamTape",url:m[1],quality:"auto",headers:{"User-Agent":UA,Referer:"https://streamtape.com/"}}];
      }
      return [{name:"StreamTape",title:"StreamTape",url:"https:"+m[1]+m[2],quality:"auto",headers:{"User-Agent":UA,Referer:"https://streamtape.com/"}}];
    })
    .catch(function(e){ console.log("[Mangoporn] StreamTape error: "+e.message); return null; });
}

// ── VidNest ───────────────────────────────────────────────────────────────────
function extractVidNest(url) {
  var host = new URL(url).origin;
  return fetchText(url, {Referer:BASE_URL+"/"})
    .then(function(html){
      var $=cheerio.load(html);
      var fileUrl=findInScripts($,function(up){
        var m=up.match(/sources\s*:\s*\[\s*\{[^}]*file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if(!m) m=up.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        return m?m[1]:null;
      });
      if(!fileUrl) return null;
      return [{name:"VidNest",title:"VidNest",url:fileUrl,quality:"auto",headers:{Referer:host+"/",Origin:host}}];
    })
    .catch(function(e){ console.log("[Mangoporn] VidNest error: "+e.message); return null; });
}

// ── Generic fallback ──────────────────────────────────────────────────────────
function extractGeneric(url) {
  try { var host=new URL(url).origin; } catch(e){ return Promise.resolve(null); }
  return fetchText(url, {Referer:BASE_URL+"/"})
    .then(function(html){
      var $=cheerio.load(html);
      var fileUrl=findInScripts($,function(up){
        var m=up.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        return m?m[1]:null;
      });
      if(!fileUrl) return null;
      return [{name:"Video",title:"Video",url:fileUrl,quality:"auto",headers:{Referer:host+"/"}}];
    })
    .catch(function(){return null;});
}

// ── Host routing ──────────────────────────────────────────────────────────────
var H = {
  dood:    ["myvidplay.com","doply.net","ds2play.com","d000d.com","dood.pm","dooood.com","playmogo.com"],
  moon:    ["filemoon.to","filemoon.in","filemoon.sx","filemoon.nl","filemoon.art","filemoon.lol","javmoon.me","x08.ovh"],
  lulu:    ["lulustream.com","luluvid.com","luluvdo.com","luluvdoo.com","lulupvp.com","lulu0.ovh","lulu.dlc.ovh"],
  tape:    ["streamtape.com","streamtape.net"],
  vnest:   ["vidnest.io","vidnest.app","vidnest.xyz","vidnest.lol","vidnest.fun","vidnest.site"],
  p4me:    ["player4me.online","player4me.vip"],
  upns:    ["upns.online","upns.vip"],
  easy:    ["easyvidplayer.com"],
  rpm:     ["rpmplay.online"],
  embed:   ["embedseek.online","seekplayer.vip"]
};
function has(list,url){ return list.some(function(h){return url.includes(h);}); }

function extractFromUrl(url) {
  if(has(H.dood,url))  return extractDood(url);
  if(has(H.moon,url))  return extractFilemoon(url);
  if(has(H.lulu,url))  return extractLulu(url);
  if(has(H.tape,url))  return extractStreamTape(url);
  if(has(H.vnest,url)) return extractVidNest(url);
  if(has(H.p4me,url))  return extractHashPlayer(url,"Player4Me");
  if(has(H.upns,url))  return extractHashPlayer(url,"UPNS");
  if(has(H.easy,url))  return extractHashPlayer(url,"EasyVidPlayer");
  if(has(H.rpm,url))   return extractHashPlayer(url,"RPMPlay");
  if(has(H.embed,url)) return extractHashPlayer(url,"EmbedSeek");
  return extractGeneric(url);
}

// ── Search (better matching) ──────────────────────────────────────────────────
function cleanQuery(t) {
  return t.toLowerCase()
    .replace(/\bthe\b/g,"").replace(/[':!?,.–—]/g,"").replace(/\s+/g," ").trim();
}
function titleScore(a, b) {
  var ca=cleanQuery(a), cb=cleanQuery(b);
  if(ca===cb) return 1;
  var wa=ca.split(" "), wb=new Set(cb.split(" "));
  var hits=wa.filter(function(w){return w.length>2 && wb.has(w);}).length;
  return hits/Math.max(wa.length,wb.size);
}

function searchSite(query) {
  return fetchText(BASE_URL+"/page/1/?s="+encodeURIComponent(query))
    .then(function(html){
      var $=cheerio.load(html), results=[];
      $("article").each(function(_,el){
        var title=$(el).find("div.details a").first().text().trim();
        var href=fixUrl($(el).find("div.image a").first().attr("href"));
        if(title && href && !isBlocked(title)) results.push({title:title, href:href});
      });
      console.log("[Mangoporn] '"+query+"' → "+results.length+" results");
      return results;
    });
}

function getVideoLinks(pageUrl) {
  return fetchText(pageUrl, {Referer:BASE_URL+"/"}).then(function(html){
    var $=cheerio.load(html), links=[];
    $("div#pettabs > ul a").each(function(_,el){
      var href=fixUrl($(el).attr("href"),pageUrl);
      if(href) links.push(href);
    });
    console.log("[Mangoporn] links: "+links.join("|"));
    return links;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {
  console.log("[Mangoporn] id="+tmdbId+" type="+mediaType);
  return getTmdbTitle(tmdbId, mediaType)
    .then(function(title){
      if(!title){ console.log("[Mangoporn] no title"); return []; }
      console.log("[Mangoporn] title="+title);
      return searchSite(title).then(function(results){
        if(!results||!results.length) return [];
        // Sort by title similarity score
        results.forEach(function(r){ r.score=titleScore(title,r.title); });
        results.sort(function(a,b){ return b.score-a.score; });

        var chain=Promise.resolve([]);
        results.slice(0,3).forEach(function(result){
          chain=chain.then(function(streams){
            if(streams.length) return streams;
            return getVideoLinks(result.href)
              .then(function(links){return Promise.all(links.map(extractFromUrl));})
              .then(function(extracted){
                var found=[];
                extracted.forEach(function(items){
                  if(items) items.forEach(function(s){ found.push(Object.assign({},s,{title:"[Mangoporn] "+s.title})); });
                });
                return found;
              });
          });
        });
        return chain;
      });
    })
    .catch(function(e){ console.error("[Mangoporn] "+e.message); return []; });
}

if(typeof module!=="undefined"&&module.exports) module.exports={getStreams:getStreams};
else global.getStreams=getStreams;
