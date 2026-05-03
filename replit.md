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
- `build.js` — esbuild build script
- `server.js` — HTTP file server (port 5000, host 0.0.0.0)
- `src/<provider>/` — Source files for each provider
- `providers/<provider>.js` — Bundled output files

## Scripts

- `npm start` — Start HTTP server
- `npm run build` — Build all providers
- `npm run build:<name>` — Build a specific provider

## Dependencies

- `esbuild` — Bundler
- `cheerio-without-node-native@1.0.0-rc.2` — HTML parser (used in provider source)

## Deployment

- Target: autoscale
- Run: `node server.js`
- Port: 5000
