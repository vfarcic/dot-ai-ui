#!/usr/bin/env node
/**
 * Merge every coverage layer into one report.
 *
 * Inputs (each optional — whatever exists is merged, and the rest is reported as missing):
 *   coverage/unit/coverage-final.json    Vitest unit tests      (istanbul provider)
 *   coverage/e2e-frontend/*.json         Playwright browser run (vite-plugin-istanbul)
 *   coverage/server-v8/*.json            Express server         (raw V8, remapped by c8)
 *
 * Output:
 *   coverage/merged/combined.json        merged istanbul JSON, the nyc input
 *   coverage/combined/index.html         browsable report
 *   coverage/combined/lcov.info          for external coverage services
 *
 * HOW THE MERGE WORKS, AND WHY IT IS NOT A PLAIN istanbul MERGE
 *
 * Each layer instruments the same sources through a different pipeline (Vitest's SSR
 * transform, Vite's client transform, tsx + V8 remapping). All of them report positions
 * in the original TypeScript, but they disagree on how source maps to *statements*: for
 * src/api/client.ts both frontend layers emit 48 statements under completely different
 * statementMap entries. istanbul's own merge matches counters by map key, so merging
 * mismatched maps silently produces wrong numbers rather than an error.
 *
 * Original source line numbers are the one key every layer agrees on — which is why
 * coverage services merge lcov line records instead of statement maps. So:
 *   - Files present in a single layer keep that layer's data exactly (all metrics precise).
 *   - Files present in several layers keep the richest layer's maps, and the other layers
 *     are credited onto them by line: a statement/branch/function is marked covered if any
 *     layer executed its line. Precision is therefore line-level for those files, never
 *     inflated beyond what actually ran.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const COVERAGE_DIR = path.join(ROOT, 'coverage')
const MERGED_DIR = path.join(COVERAGE_DIR, 'merged')
const COMBINED_DIR = path.join(COVERAGE_DIR, 'combined')
const SERVER_V8_DIR = path.join(COVERAGE_DIR, 'server-v8')
const SERVER_DIR = path.join(COVERAGE_DIR, 'server')

/** Files that exist but should not count towards coverage. */
const EXCLUDED = [
  (p) => p.startsWith('e2e/'),
  (p) => p.startsWith('scripts/'),
  (p) => p.includes('node_modules/'),
  (p) => p.endsWith('.d.ts'),
  (p) => /\.test\.[cm]?[jt]sx?$/.test(p),
  (p) => p.startsWith('src/test/'),
  (p) => p === 'src/main.tsx',
  (p) => p.startsWith('src/api/generated/'),
  (p) => p.startsWith('src/types/'), // type declarations only, no runtime code
  (p) => p.startsWith('src/') && p.endsWith('/index.ts'), // barrel re-exports
]

const relative = (file) => path.relative(ROOT, file).split(path.sep).join('/')
const isExcluded = (file) => EXCLUDED.some((matches) => matches(relative(file)))
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

// ---------------------------------------------------------------- merge helpers

/** Every source line this file coverage proves was executed, with its hit count. */
function executedLines(fileCoverage) {
  const lines = new Map()
  const bump = (location, count) => {
    const line = location?.start?.line ?? location?.line
    if (typeof line !== 'number' || count <= 0) return
    lines.set(line, Math.max(lines.get(line) ?? 0, count))
  }

  for (const [key, count] of Object.entries(fileCoverage.s ?? {})) {
    bump(fileCoverage.statementMap?.[key], count)
  }
  for (const [key, count] of Object.entries(fileCoverage.f ?? {})) {
    const fn = fileCoverage.fnMap?.[key]
    bump(fn?.decl ?? fn?.loc, count)
  }
  for (const [key, counts] of Object.entries(fileCoverage.b ?? {})) {
    const branch = fileCoverage.branchMap?.[key]
    counts.forEach((count, index) => bump(branch?.locations?.[index] ?? branch?.loc, count))
  }
  return lines
}

const sameShape = (a, b) => JSON.stringify(a.statementMap) === JSON.stringify(b.statementMap)

/** Sum counters key-by-key. Only valid when both sides were instrumented identically. */
function mergeIdentical(base, other) {
  for (const [key, count] of Object.entries(other.s ?? {})) base.s[key] = (base.s[key] ?? 0) + count
  for (const [key, count] of Object.entries(other.f ?? {})) base.f[key] = (base.f[key] ?? 0) + count
  for (const [key, counts] of Object.entries(other.b ?? {})) {
    base.b[key] = counts.map((count, index) => (base.b[key]?.[index] ?? 0) + count)
  }
}

/** Credit `other`'s executed lines onto `base`'s own maps. Safe across instrumenters. */
function mergeByLine(base, other) {
  const lines = executedLines(other)
  const credit = (location, current) => {
    const line = location?.start?.line ?? location?.line
    const hits = lines.get(line) ?? 0
    return Math.max(current, hits)
  }

  for (const key of Object.keys(base.s)) {
    base.s[key] = credit(base.statementMap?.[key], base.s[key])
  }
  for (const key of Object.keys(base.f)) {
    const fn = base.fnMap?.[key]
    base.f[key] = credit(fn?.decl ?? fn?.loc, base.f[key])
  }
  for (const key of Object.keys(base.b)) {
    const branch = base.branchMap?.[key]
    base.b[key] = base.b[key].map((count, index) =>
      credit(branch?.locations?.[index] ?? branch?.loc, count)
    )
  }
}

const statementCount = (fileCoverage) => Object.keys(fileCoverage.s ?? {}).length

function mergeInto(target, coverage) {
  for (const [file, fileCoverage] of Object.entries(coverage)) {
    const existing = target[file]
    if (!existing) {
      target[file] = fileCoverage
    } else if (sameShape(existing, fileCoverage)) {
      mergeIdentical(existing, fileCoverage)
    } else if (statementCount(fileCoverage) > statementCount(existing)) {
      // Keep the richer map as the base so the report stays as detailed as possible.
      mergeByLine(fileCoverage, existing)
      target[file] = fileCoverage
    } else {
      mergeByLine(existing, fileCoverage)
    }
  }
}

/** Sum istanbul hit maps into { covered, total } pairs. */
function summarize(coverage) {
  const totals = { statements: [0, 0], branches: [0, 0], functions: [0, 0] }
  for (const fileCoverage of Object.values(coverage)) {
    const metrics = {
      statements: Object.values(fileCoverage.s ?? {}),
      functions: Object.values(fileCoverage.f ?? {}),
      branches: Object.values(fileCoverage.b ?? {}).flat(),
    }
    for (const [metric, hits] of Object.entries(metrics)) {
      totals[metric][0] += hits.filter((hit) => hit > 0).length
      totals[metric][1] += hits.length
    }
  }
  return totals
}

const percent = ([covered, total]) =>
  total === 0 ? '  n/a' : `${((covered / total) * 100).toFixed(2).padStart(6)}%`

// ---------------------------------------------------------------- layer inputs

/**
 * Remap the server's raw V8 profiles onto its TypeScript sources.
 * tsx transpiles server/*.ts in memory, so this relies on the inline source maps tsx
 * emits — hence --exclude-after-remap, which filters on post-remap paths.
 */
function serverFiles() {
  if (!existsSync(SERVER_V8_DIR) || readdirSync(SERVER_V8_DIR).length === 0) return null

  execFileSync(
    'npx',
    [
      'c8',
      'report',
      '--temp-directory',
      SERVER_V8_DIR,
      '--report-dir',
      SERVER_DIR,
      '--reporter',
      'json',
      '--include',
      'server/**',
      '--exclude-after-remap',
    ],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] }
  )

  const report = path.join(SERVER_DIR, 'coverage-final.json')
  return existsSync(report) ? [report] : null
}

function unitFiles() {
  const report = path.join(COVERAGE_DIR, 'unit', 'coverage-final.json')
  return existsSync(report) ? [report] : null
}

function e2eFrontendFiles() {
  const dir = path.join(COVERAGE_DIR, 'e2e-frontend')
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(dir, name))
  return files.length > 0 ? files : null
}

const LAYERS = [
  { name: 'unit', hint: 'npm run test:unit:coverage', collect: unitFiles },
  { name: 'e2e-frontend', hint: 'npm run test:e2e:coverage', collect: e2eFrontendFiles },
  { name: 'server', hint: 'npm run test:e2e:coverage', collect: serverFiles },
]

// ---------------------------------------------------------------- build report

const combined = {}
const summaries = []

for (const layer of LAYERS) {
  const files = layer.collect()
  if (!files) {
    summaries.push({ name: layer.name, missing: layer.hint })
    continue
  }

  // Merge the layer with itself first (one dump per test, for the E2E layers), then fold
  // the layer into the combined result. Within a layer the maps match, so counters sum.
  const layerCoverage = {}
  for (const file of files) {
    const coverage = readJson(file)
    for (const key of Object.keys(coverage)) {
      if (isExcluded(key)) delete coverage[key]
    }
    mergeInto(layerCoverage, coverage)
  }

  summaries.push({
    name: layer.name,
    files: Object.keys(layerCoverage).length,
    totals: summarize(layerCoverage),
  })
  mergeInto(combined, layerCoverage)
}

if (Object.keys(combined).length === 0) {
  console.error('No coverage data found. Run `npm run test:coverage` to produce it.')
  process.exit(1)
}

rmSync(MERGED_DIR, { recursive: true, force: true })
mkdirSync(MERGED_DIR, { recursive: true })
writeFileSync(path.join(MERGED_DIR, 'combined.json'), JSON.stringify(combined))

execFileSync(
  'npx',
  [
    'nyc',
    'report',
    '--temp-directory',
    MERGED_DIR,
    '--report-dir',
    COMBINED_DIR,
    '--reporter',
    'text-summary',
    '--reporter',
    'html',
    '--reporter',
    'lcov',
  ],
  { cwd: ROOT, stdio: 'inherit' }
)

console.log('Per-layer contribution (layers overlap, so these do not add up to the total):')
for (const summary of summaries) {
  if (summary.missing) {
    console.log(`  ${summary.name.padEnd(13)} not collected — run \`${summary.missing}\``)
    continue
  }
  const { statements, branches, functions } = summary.totals
  console.log(
    `  ${summary.name.padEnd(13)} ${String(summary.files).padStart(3)} files` +
      `   statements ${percent(statements)}   branches ${percent(branches)}` +
      `   functions ${percent(functions)}`
  )
}

console.log(`\nHTML report: ${relative(path.join(COMBINED_DIR, 'index.html'))} (npm run coverage:open)`)
