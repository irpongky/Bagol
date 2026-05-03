const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const srcDir = path.join(__dirname, "src");
const outDir = path.join(__dirname, "providers");

// Modules provided by the Nuvio app runtime — do NOT bundle these
const EXTERNAL_MODULES = [
    "cheerio-without-node-native",
    "react-native-cheerio",
    "cheerio",
    "crypto-js",
    "axios",
];

const args = process.argv.slice(2).filter(a => !a.startsWith("-"));
const shouldMinify = process.argv.includes("--minify");

// If specific provider names given, use those; otherwise build all in src/
const providers = args.length
    ? args
    : fs.readdirSync(srcDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith("_"))
        .map(d => d.name);

(async () => {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    let success = 0;
    let failed = 0;

    for (const name of providers) {
        const entryPoint = path.join(srcDir, name, "index.js");
        const outfile = path.join(outDir, `${name}.js`);

        if (!fs.existsSync(entryPoint)) {
            console.warn(`⚠️  Skipping ${name}: no src/${name}/index.js found`);
            failed++;
            continue;
        }

        try {
            await esbuild.build({
                entryPoints: [entryPoint],
                bundle: true,
                platform: "neutral",   // Not "node" — Nuvio runs on Hermes (React Native)
                format: "cjs",
                target: "es2016",      // Transpile async/await → generators for Hermes
                outfile,
                minify: shouldMinify,
                sourcemap: false,
                external: EXTERNAL_MODULES,
                logLevel: "warning",
            });

            const sizeKB = (fs.statSync(outfile).size / 1024).toFixed(1);
            console.log(`✅ Built: providers/${name}.js (${sizeKB} KB)`);
            success++;
        } catch (err) {
            console.error(`❌ Failed: ${name} — ${err.message}`);
            failed++;
        }
    }

    console.log(`\nDone: ${success} built, ${failed} failed/skipped`);
})();
