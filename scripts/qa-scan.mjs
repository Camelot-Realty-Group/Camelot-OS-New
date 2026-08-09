#!/usr/bin/env node
/**
 * Camelot Scout QA Scanner
 * --------------------------------------------------------------------------
 * Static, dependency-free diagnostic pass over the frontend. Produces a JSON
 * report consumed by the in-app QA console (/#/qa).
 *
 * What it does (no node_modules required):
 *   1. Parses src/App.tsx and enumerates every <Route> and its lazy page.
 *   2. Resolves the import graph for each page (@/ alias + relative + .ts/.tsx
 *      /index), flagging any import that does not resolve on disk.
 *   3. Detects bare (external) imports and checks them against package.json
 *      dependencies + devDependencies + node builtins.
 *   4. Records results of build/lint/typecheck scripts if a prior run wrote
 *      them to .qa-cache/ (the npm script wrapper does this), otherwise marks
 *      them "not-run".
 *   5. Emits a GitHub blob base so the console can deep-link to source files.
 *
 * Output: public/qa-report.json  (served statically, fetched by the SPA)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { builtinModules } from 'node:module';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const srcDir = resolve(root, 'src');
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Strip comments + template literals only. We intentionally KEEP quoted strings,
 * because import/require specifiers live in quotes. Template literals are blanked
 * so interpolated text like `${x} EAST 79` cannot be misread as a bare import.
 */
function stripNonImportNoise(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // line comments (avoid http://)
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, '``'); // template literals
}

/** Pull module specifiers from import/export-from/dynamic-import/require statements. */
function extractImports(code) {
  const specs = new Set();
  const patterns = [
    /import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
    /export\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) specs.add(m[1]);
  }
  return [...specs];
}

const RESOLVE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css'];

/** Resolve a local (@/ or relative) specifier to an on-disk file, or null. */
function resolveLocal(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = resolve(srcDir, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return undefined; // not local

  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of RESOLVE_EXT) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of RESOLVE_EXT) {
    const idx = join(base, 'index' + ext);
    if (existsSync(idx)) return idx;
  }
  return null; // local but missing
}

/** Bare package name from a specifier (handles scoped + subpaths). */
function pkgName(spec) {
  if (spec.startsWith('@')) return spec.split('/').slice(0, 2).join('/');
  return spec.split('/')[0];
}

// ---- package.json deps ----
const pkg = JSON.parse(read(resolve(root, 'package.json')) || '{}');
const declaredDeps = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
]);

// ---- git context for blob links ----
function git(cmd) {
  try {
    return execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}
const commit = git('git rev-parse HEAD');
const shortCommit = git('git rev-parse --short HEAD');
const branch = git('git rev-parse --abbrev-ref HEAD');
let remoteUrl = git('git config --get remote.origin.url');
// Normalize to a github.com slug if possible (proxy URLs won't link, fall back to env override).
const GH_SLUG = process.env.QA_GITHUB_SLUG || 'Camelot-Realty-Group/Camelot-OS-New';
const blobBase = `https://github.com/${GH_SLUG}/blob/${commit || branch || 'main'}`;
function blob(absFile, line) {
  const rel = relative(root, absFile).split('\\').join('/');
  return `${blobBase}/${rel}${line ? `#L${line}` : ''}`;
}

// ---- baseline comparison (last-known-good reference) ----
// No alternate branches/tags exist in this repo, so the baseline is a commit.
// 124e56c is the last commit before the "bot split / HubSpot / Daily-Hunt-on-static-Render"
// fix cascade began. Override with QA_BASELINE_REF if a better reference appears.
const baselineRef = process.env.QA_BASELINE_REF || '124e56c';
let baseline = null;
if (commit) {
  const baselineSha = git(`git rev-parse ${baselineRef}`);
  if (baselineSha) {
    const stat = git(`git diff --stat ${baselineRef} HEAD -- src`);
    const files = git(`git diff --name-status ${baselineRef} HEAD -- src`)
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [status, ...rest] = line.split('\t');
        const file = rest.join('\t');
        return { status, file, link: `${blobBase}/${file}` };
      });
    const subject = git(`git log -1 --format=%s ${baselineRef}`);
    baseline = {
      ref: baselineRef,
      sha: baselineSha,
      shortSha: baselineSha.slice(0, 7),
      subject,
      rationale:
        'Last commit before the bot-split / HubSpot / Daily-Hunt-on-static-Render fix cascade. ' +
        'No alternate branches or tags exist in this repo, so a commit is used as the last-known-good baseline.',
      changedFiles: files,
      changedFileCount: files.length,
      diffStatTail: stat.split('\n').slice(-1)[0] || '',
    };
  }
}

// ---- 1 + 2: parse routes from App.tsx and resolve each page's import graph ----
const appFile = resolve(srcDir, 'App.tsx');
const appCode = read(appFile) || '';

// lazy const Name = lazy(() => import('@/pages/Name'))
const lazyMap = {};
{
  const re = /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)\s*\)/g;
  let m;
  while ((m = re.exec(appCode)) !== null) lazyMap[m[1]] = m[2];
}
// direct imports (e.g. Layout) too
{
  const re = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(appCode)) !== null) if (!lazyMap[m[1]]) lazyMap[m[1]] = m[2];
}

// <Route path="..." element={page(Comp)} /> or element={<Comp .../>}
const routes = [];
{
  const re = /<Route\s+path=["']([^"']+)["'][^>]*element=\{(?:page\(\s*(\w+)\s*\)|<\s*(\w+))/g;
  let m;
  while ((m = re.exec(appCode)) !== null) {
    const path = m[1];
    const comp = m[2] || m[3];
    routes.push({ path, component: comp });
  }
}

const missingPackages = new Map(); // pkg -> [{importer, spec}]
const fileCache = new Map();

function analyzeFile(file, graph, visited) {
  if (visited.has(file)) return;
  visited.add(file);
  let code = fileCache.get(file);
  if (code === undefined) {
    const raw = read(file);
    code = raw == null ? null : stripNonImportNoise(raw);
    fileCache.set(file, code);
  }
  if (code == null) return;
  for (const spec of extractImports(code)) {
    const local = resolveLocal(spec, file);
    if (local === undefined) {
      // external package
      if (spec.startsWith('.')) continue;
      const name = pkgName(spec);
      if (BUILTINS.has(name) || BUILTINS.has(spec)) continue;
      if (!declaredDeps.has(name)) {
        if (!missingPackages.has(name)) missingPackages.set(name, []);
        missingPackages.get(name).push({ importer: relative(root, file), spec });
      }
    } else if (local === null) {
      graph.broken.push({ spec, from: relative(root, file), fromAbs: file });
    } else {
      graph.resolved.push(local);
      analyzeFile(local, graph, visited);
    }
  }
}

// Router built-ins that are valid <Route element=...> targets but are not pages.
const ROUTER_BUILTINS = new Set(['Navigate', 'Outlet']);

const pages = [];
for (const route of routes) {
  if (ROUTER_BUILTINS.has(route.component)) {
    pages.push({ ...route, importSpec: null, status: 'redirect', issues: [], file: null, fileLink: null, brokenImports: [], note: `Redirect/router element (<${route.component}>)` });
    continue;
  }
  const spec = lazyMap[route.component];
  const entry = { ...route, importSpec: spec || null, status: 'ok', issues: [], file: null, fileLink: null, brokenImports: [] };
  if (!spec) {
    entry.status = 'broken';
    entry.issues.push(`No import found for component <${route.component}> referenced in App.tsx`);
    pages.push(entry);
    continue;
  }
  const file = resolveLocal(spec, appFile);
  if (!file) {
    entry.status = 'broken';
    entry.issues.push(`Page module '${spec}' does not resolve to a file on disk`);
    pages.push(entry);
    continue;
  }
  entry.file = relative(root, file);
  entry.fileLink = blob(file);
  const graph = { resolved: [], broken: [] };
  analyzeFile(file, graph, new Set());
  if (graph.broken.length) {
    entry.status = 'broken';
    for (const b of graph.broken) {
      entry.issues.push(`Unresolved import '${b.spec}' in ${b.from}`);
      entry.brokenImports.push({ spec: b.spec, from: b.from, fromLink: blob(b.fromAbs) });
    }
  }
  entry.importedModuleCount = graph.resolved.length;
  pages.push(entry);
}

// ---- 3: pick up cached build/lint/typecheck results if present ----
const cacheDir = resolve(root, '.qa-cache');
function loadCheck(name) {
  const f = resolve(cacheDir, `${name}.json`);
  const raw = read(f);
  if (!raw) return { name, status: 'not-run', detail: 'No result recorded. Run `npm run qa` (or the individual script) to populate.' };
  try {
    return JSON.parse(raw);
  } catch {
    return { name, status: 'error', detail: 'Cached result was unreadable.' };
  }
}
const checks = ['typecheck', 'lint', 'build'].map(loadCheck);

// ---- count component files for context ----
function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}
const allSrcFiles = existsSync(srcDir) ? walk(srcDir) : [];

// ---- assemble report ----
const brokenPages = pages.filter((p) => p.status === 'broken');
const workingPages = pages.filter((p) => p.status === 'ok');
const redirectPages = pages.filter((p) => p.status === 'redirect');
const missingPackagesList = [...missingPackages.entries()].map(([name, uses]) => ({ name, uses }));

const report = {
  generatedAt: new Date().toISOString(),
  git: { branch, commit, shortCommit, remoteUrl, githubSlug: GH_SLUG, blobBase },
  baseline,
  summary: {
    totalRoutes: routes.length,
    workingPages: workingPages.length,
    brokenPages: brokenPages.length,
    redirectRoutes: redirectPages.length,
    missingPackages: missingPackagesList.length,
    sourceFiles: allSrcFiles.length,
    checks: Object.fromEntries(checks.map((c) => [c.name, c.status])),
  },
  pages,
  missingPackages: missingPackagesList,
  checks,
};

if (!existsSync(resolve(root, 'public'))) mkdirSync(resolve(root, 'public'), { recursive: true });
const outFile = resolve(root, 'public', 'qa-report.json');
writeFileSync(outFile, JSON.stringify(report, null, 2));

// human summary to stdout
console.log(`QA scan complete -> ${relative(root, outFile)}`);
console.log(`  routes: ${report.summary.totalRoutes}  working: ${report.summary.workingPages}  broken: ${report.summary.brokenPages}`);
console.log(`  missing packages: ${report.summary.missingPackages}`);
console.log(`  checks: ${JSON.stringify(report.summary.checks)}`);
if (brokenPages.length) {
  console.log('  BROKEN:');
  for (const p of brokenPages) console.log(`    ${p.path} -> ${p.issues.join('; ')}`);
}
