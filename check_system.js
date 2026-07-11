const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const providers = [
    { id: 'mangoporn', name: 'Mangoporn', site: 'https://mangoporn.net' },
    { id: 'pornwatch', name: 'PornWatch', site: 'https://pornwatch.ws' },
    { id: 'xxxparodyhd', name: 'XXXParodyHD', site: 'https://xxxparodyhd.net' }
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
    party: '🎉', timer: '⏱', stream: '📡', gear: '⚙', pkg: '📦', server: '🖥',
};

function header(title) {
    const line = '═'.repeat(75);
    console.log(`\n${c.cyan(line)}`);
    console.log(`  ${c.bold(title)}`);
    console.log(`${c.cyan(line)}`);
}

function subHeader(title) {
    console.log(`\n  ${c.magenta('─'.repeat(60))}`);
    console.log(`  ${c.bold(title)}`);
    console.log(`  ${c.magenta('─'.repeat(60))}`);
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

async function run() {
    header('🚀 BAGOL REPO COMPREHENSIVE PROVIDER VERIFICATION');

    // 1. Check Dependencies
    console.log(`\n${ICONS.pkg} Step 1: Checking Dependencies...`);
    const startTime = Date.now();
    try {
        if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
            console.log(c.yellow('  - node_modules not found, installing...'));
            execSync('npm install', { stdio: 'inherit' });
        }
        console.log(`  - Dependencies: ${c.green(ICONS.pass + ' OK')}`);
    } catch (e) {
        console.error(c.red(`  - Dependencies: ${ICONS.fail} FAILED: ${e.message}`));
    }
    console.log(`  Step 1 selesai dalam ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

    // 2. Build Providers
    console.log(`\n${ICONS.gear} Step 2: Building Providers...`);
    const buildStart = Date.now();
    try {
        execSync('node build.js', { stdio: 'inherit' });
        console.log(`  - Build: ${c.green(ICONS.pass + ' OK')}`);
    } catch (e) {
        console.error(c.red(`  - Build: ${ICONS.fail} FAILED`));
    }
    console.log(`  Step 2 selesai dalam ${((Date.now() - buildStart) / 1000).toFixed(2)}s`);

    // 3. Check Upstream Sites
    console.log(`\n${ICONS.server} Step 3: Checking Upstream Sites...`);
    const siteStart = Date.now();
    for (const p of providers) {
        try {
            const start = Date.now();
            const res = await fetch(p.site, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            console.log(`  - [${p.name}] ${p.site}: ${c.green(ICONS.pass + ' ' + res.status + ' OK')} (${((Date.now() - start) / 1000).toFixed(2)}s)`);
        } catch (e) {
            console.log(`  - [${p.name}] ${p.site}: ${c.red(ICONS.fail + ' FAILED (' + e.message + ')')}`);
        }
    }
    console.log(`  Step 3 selesai dalam ${((Date.now() - siteStart) / 1000).toFixed(2)}s`);

    // 4. Test Stream Extraction
    console.log(`\n${ICONS.rocket} Step 4: Testing Stream Extraction...`);
    const extractStart = Date.now();
    const results = [];

    for (const p of providers) {
        subHeader(`Testing: ${p.name}`);
        const pStart = Date.now();
        let status = 'FAIL';
        let streamCount = 0;

        try {
            const providerPath = path.join(__dirname, 'providers', `${p.id}.js`);
            if (!fs.existsSync(providerPath)) throw new Error(`Provider file not found: ${p.id}.js`);
            
            const { getStreams } = require(providerPath);
            
            // Search query for testing
            // Sample uses real adult content that actually exists on these providers'
            // upstream sites, so the strict title/year matcher can produce a positive match.
            const testQuery = "Step Siblings with Benefits 2";
            console.log(`  ${ICONS.gear} Searching for "${testQuery}" via ${p.name}...`);

            // Using "Step Siblings with Benefits 2" (2020) - TMDB 839733
            const streams = await getStreams("839733", "movie");
            
            streamCount = streams.length;
            if (streamCount > 0) {
                status = 'PASS';
                console.log(`  ${c.green(ICONS.pass)} Found ${streamCount} streams:`);
                streams.slice(0, 3).forEach((s, i) => {
                    console.log(`    └─ [#${i+1}] ${s.name} • ${s.quality} [${s.title}]`);
                    console.log(`       ${c.dim(s.url.substring(0, 80) + '...')}`);
                });
            } else {
                console.log(`  ${c.yellow(ICONS.warn)} No streams found.`);
            }
        } catch (e) {
            console.log(`  ${c.red(ICONS.fail)} Error: ${e.message}`);
        }

        results.push({
            name: p.name,
            status,
            streams: streamCount,
            time: `${((Date.now() - pStart) / 1000).toFixed(2)}s`
        });
    }
    console.log(`\n  Step 4 selesai dalam ${((Date.now() - extractStart) / 1000).toFixed(2)}s`);

    // 5. Final Report
    header('📊 FINAL INTEGRATION REPORT');
    console.log(`  ${c.bold('Provider')}             | ${c.bold('Status')} | ${c.bold('Streams')} | ${c.bold('Time')}`);
    console.log(`  ${'─'.repeat(65)}`);
    results.forEach(r => {
        const name = r.name.padEnd(20);
        const stat = r.status === 'PASS' ? c.bgGreen(' PASS ') : c.bgRed(' FAIL ');
        const streams = String(r.streams).padEnd(7);
        console.log(`  ${name} | ${stat} | ${streams} | ${r.time}`);
    });
    console.log(`  ${'─'.repeat(65)}`);
    console.log(`\n  ${ICONS.timer} Total Waktu Eksekusi: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    
    const allPass = results.every(r => r.status === 'PASS');
    if (allPass) {
        console.log(`\n ${ICONS.party} ${c.green(c.bold('ALL CHECKS PASSED'))}  System ready for production! 🚀\n`);
    } else {
        console.log(`\n ${ICONS.fail} ${c.red(c.bold('SOME CHECKS FAILED'))}  Please review the logs.\n`);
    }
}

run();
