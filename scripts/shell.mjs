// After the build, move dist/index.html to dist/shell.html.
// Vercel serves a real index.html for "/" before any rewrite runs, which would skip the page function
// (and with it the home page's canonical link and share tags). Without an index.html, "/" goes through api/page.js like every other page.
import { renameSync, existsSync } from 'node:fs';
if (existsSync('dist/index.html')) renameSync('dist/index.html', 'dist/shell.html');
