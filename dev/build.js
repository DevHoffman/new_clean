/*
 * Builds a production copy of the theme in dist/: same structure, with the
 * CSS and JavaScript in assets/ minified. Source files stay untouched, so
 * `npm run dev` keeps working on readable code.
 *
 * Usage: npm run build     (npm run push builds first)
 *
 * Shopify's CDN compresses (gzip/brotli) but does not minify, so this saves
 * the difference between compressed-unminified and compressed-minified.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const FOLDERS = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];

fs.rmSync(DIST, { recursive: true, force: true });

const totals = { css: [0, 0, 0], js: [0, 0, 0] };
const gz = (buffer) => zlib.gzipSync(buffer, { level: 9 }).length;

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from, { withFileTypes: true }).forEach((entry) => {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) return copyDir(source, target);

    const extension = path.extname(entry.name);
    const inAssets = path.relative(ROOT, from).split(path.sep)[0] === 'assets';
    if (inAssets && (extension === '.css' || extension === '.js') && !/\.min\./.test(entry.name)) {
      const code = fs.readFileSync(source, 'utf8');
      const result = esbuild.transformSync(code, {
        loader: extension === '.css' ? 'css' : 'js',
        minify: true,
        legalComments: 'none',
        target: 'es2019',
        // Custom-element classes rely on their names in a few places
        keepNames: true,
        // Each script is a classic global script: wrapping it keeps its top-level
        // names from colliding with the ones minification shortens in other files
        format: extension === '.js' ? 'iife' : undefined,
      });
      fs.writeFileSync(target, result.code);
      const key = extension.slice(1);
      totals[key][0] += Buffer.byteLength(code);
      totals[key][1] += Buffer.byteLength(result.code);
      totals[key][2] += gz(Buffer.from(result.code));
      return;
    }
    fs.copyFileSync(source, target);
  });
}

FOLDERS.forEach((folder) => copyDir(path.join(ROOT, folder), path.join(DIST, folder)));

// Compressed size of the sources, for an honest comparison
const gzSource = { css: 0, js: 0 };
fs.readdirSync(path.join(ROOT, 'assets')).forEach((file) => {
  const extension = path.extname(file).slice(1);
  if (gzSource[extension] !== undefined) gzSource[extension] += gz(fs.readFileSync(path.join(ROOT, 'assets', file)));
});

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log('\n  Tema de produção gerado em dist/\n');
['css', 'js'].forEach((key) => {
  const [raw, min, minGz] = totals[key];
  console.log(`  ${key.toUpperCase().padEnd(3)} fonte ${kb(raw).padStart(9)} → minificado ${kb(min).padStart(9)}   |   com gzip: ${kb(gzSource[key]).padStart(8)} → ${kb(minGz).padStart(8)}`);
});
console.log('');
