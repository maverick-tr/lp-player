#!/usr/bin/env node

const path = require('path');

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

// npm usage: don't auto-open browser (server.cjs has its own openAppWindow
// that's meant for standalone binaries/DMG only). Pass --no-open to suppress it.
if (!args.includes('--no-open')) {
  args.push('--no-open');
}

// Start the server
require(serverPath);
