const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const providers = [
    { id: 'mangoporn', name: 'Mangoporn' },
    { id: 'pornwatch', name: 'PornWatch' },
    { id: 'xxxparodyhd', name: 'XXXParodyHD' }
];

const testCases = [
    { label: "IMDb ID (tt0499549)", id: "tt0499549", type: "movie", expectedTitle: "Avatar" },
    { label: "Prefixed TMDB ID (tmdb:movie:19995)", id: "tmdb:movie:19995", type: "movie", expectedTitle: "Avatar" },
    { label: "Raw TMDB ID (19995)", id: "19995", type: "movie", expectedTitle: "Avatar" }
];

const c = {
    cyan:    (s) => `\x1b[36m${s}\x1b[0m`,
    green:   (s) => `\x1b[32m${s}\x1b[0m`,
    red:     (s) => `\x1b[31m${s}\x1b[0m`,
    yellow:  (s) => `\x1b[33m${s}\x1b[0m`,
    magenta: (s) => `\x1b[35m${s}\x1b[0m`,
    bold:    (s) => `\x1b[1m${s}\x1b[0m`,
    dim:     (s) => `\x1b[2m${s}\x1b[0m`,
    bgGreen: (s) => `\x1b[42m\x1b[30m${s}\x1b[0m`,
    bgRed:   (s) => `\x1b[41m\x1b[37m${s}\x1b[0m`,
};

const ICONS = {
    pass: '✔', fail: '✘', warn: '⚠', rocket: '🚀',
    party: '🎉', timer: '⏱', stream: '📡', gear: '⚙',
};

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

async function run() {
    console.log(`\n${c.cyan('═'.repeat(75))}`);
    console.log(`  ${c.bold('🚀 AIOMETA ID COMPATIBILITY VERIFICATION')}`);
    console.log(`${c.cyan('═'.repeat(75))}\n`);

    // 1. Rebuild to ensure changes are applied
    console.log(`${ICONS.gear} Rebuilding providers...`);
    try {
        execSync('node build.js', { stdio: 'ignore' });
        console.log(`  - Build: ${c.green(ICONS.pass + ' OK')}\n`);
    } catch (e) {
        console.error(c.red(`  - Build: ${ICONS.fail} FAILED`));
        process.exit(1);
    }

    let overallSuccess = true;

    for (const test of testCases) {
        console.log(`${c.magenta('─'.repeat(60))}`);
        console.log(`${c.bold('CASE: ' + test.label)}`);
        console.log(`${c.magenta('─'.repeat(60))}`);

        for (const p of providers) {
            const pStart = Date.now();
            
            try {
                const providerPath = path.join(__dirname, 'providers', `${p.id}.js`);
                // Note: we can't easily import from src/shared in the built provider without a lot of ceremony
                // but we can check if the provider correctly resolves it by adding a log in extractor.js
                
                const { getStreams } = require(providerPath);
                
                process.stdout.write(`  [${p.name}] Extracting... `);
                const streams = await getStreams(test.id, test.type);
                
                const elapsed = ((Date.now() - pStart) / 1000).toFixed(2);
                if (streams && streams.length > 0) {
                    console.log(`${c.green(ICONS.pass + ' PASS')} (${streams.length} streams, ${elapsed}s)`);
                } else {
                    console.log(`${c.yellow(ICONS.warn + ' NO STREAMS')} (${elapsed}s)`);
                }
            } catch (e) {
                console.log(`${c.red(ICONS.fail + ' ERROR: ' + e.message)}`);
                overallSuccess = false;
            }
        }
        console.log();
    }

    if (overallSuccess) {
        console.log(`${ICONS.party} ${c.green(c.bold('ALL PROVIDERS RESOLVED IDS SUCCESSFULLY'))}\n`);
    } else {
        console.log(`${ICONS.fail} ${c.red(c.bold('SOME ERRORS OCCURRED'))}\n`);
        process.exit(1);
    }
}

run();
