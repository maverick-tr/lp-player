#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');

// Resolve the server entry point relative to the package root
const serverPath = path.join(__dirname, '..', 'server.cjs');

// Pass through CLI arguments (--port, --host, etc.)
const args = process.argv.slice(2);

// Print version if requested
if (args.includes('--version') || args.includes('-v')) {
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  console.log(`lp-player v${pkg.version}`);
  process.exit(0);
}

// Print help if requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  LP Player — Local Project Manager

  Usage: lp-player [options]

  Options:
    --port <number>   Port to listen on (default: 4243)
    --host <address>  Host to bind to (default: 0.0.0.0)
    --version, -v     Show version
    --help, -h        Show this help
  `);
  process.exit(0);
}

// Open browser after a short delay
const port = (() => {
  const idx = args.indexOf('--port');
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : (process.env.PORT || '4243');
})();

const host = (() => {
  const idx = args.indexOf('--host');
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : 'localhost';
})();

setTimeout(() => {
  const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;
  try {
    const platform = process.platform;
    if (platform === 'darwin') execSync(`open "${url}"`);
    else if (platform === 'win32') execSync(`start "${url}"`);
    else execSync(`xdg-open "${url}"`);
  } catch {
    console.log(`  Open in browser: ${url}`);
  }
}, 1500);

// Start the server
require(serverPath);
