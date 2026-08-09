import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(repoRoot, 'legacy-redirect');

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Opening Camelot OS</title>
    <script>
      (() => {
        const destination = 'https://camelot-os.onrender.com'
          + window.location.pathname
          + window.location.search
          + window.location.hash;
        window.location.replace(destination);
      })();
    </script>
  </head>
  <body>
    <p>Opening <a href="https://camelot-os.onrender.com/">Camelot OS</a>…</p>
  </body>
</html>
`;

fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf8');
console.log(`Legacy redirect built at ${outputDir}`);
