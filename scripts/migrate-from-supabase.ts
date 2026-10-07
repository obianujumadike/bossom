/**
 * Copies Bossom's data out of Supabase into Convex, and mammogram files out of
 * Supabase Storage into Cloudinary.
 *
 *   npx tsx scripts/migrate-from-supabase.ts --dry-run   # read + back up only
 *   npx tsx scripts/migrate-from-supabase.ts             # import into the dev deployment
 *   npx tsx scripts/migrate-from-supabase.ts --prod      # import into production
 *
 * Reads (from the environment or .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   required
 *   SUPABASE_ACCESS_TOKEN   optional, a personal access token. With it, users
 *                           keep their existing passwords (bcrypt hashes are
 *                           read from auth.users); without it they must use
 *                           "Forgot password" once.
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET   required unless --dry-run
 *
 * Safe to re-run: every row carries its Supabase id as `legacy_id`, imports
 * skip rows already present, and files already copied are not copied again.
 * Before writing anything, the full Supabase export (including tables the app
 * no longer uses) is saved to migration-data/, which is git-ignored because it
 * holds patient data. Delete it once the migration is verified.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ALLOWED_FORMATS, UPLOAD_TYPE, signParams } from '../convex/lib/cloudinary'

const DRY_RUN = process.argv.includes('--dry-run')
const PROD = process.argv.includes('--prod')
const BATCH = 50
const BUCKET = 'mammograms'

const fileEnv: Record<string, string> = existsSync('.env.local')
  ? Object.fromEntries(
      readFileSync('.env.local', 'utf8')
        .split('\n')
        .filter(l => l.includes('=') && !l.trim().startsWith('#'))
        .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  : {}
const env = (name: string) => process.env[name] ?? fileEnv[name]

function required(name: string): string {
  const value = env(name)
  if (!value) {
    console.error(`Missing ${name}. Set it in the environment or .env.local.`)
    process.exit(1)
  }
  return value
}

type Row = Record<string, any>

// ---------------------------------------------------------------------------
// Supabase export
// ---------------------------------------------------------------------------

const APP_TABLES = ['users', 'patients', 'patient_clinical_history', 'cases', 'images', 'analyses', 'regions_of_interest'] as const
// Not used by the app any more; exported to the backup file so nothing is lost.
const ARCHIVE_TABLES = ['reports', 'audit_logs', 'system_settings'] as const

async function fetchAll(sb: SupabaseClient, table: string): Promise<Row[] | null> {
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999)
    if (error) {
      if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message)) return null
      throw new Error(`Reading ${table}: ${error.message}`)
    }
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) return rows
  }
}

async function fetchAuthUsers(sb: SupabaseClient) {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Listing auth users: ${error.message}`)
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

/** bcrypt hashes from auth.users, via the Management API's SQL endpoint. */
async function fetchPasswordHashes(supabaseUrl: string): Promise<Map<string, string>> {
  const token = env('SUPABASE_ACCESS_TOKEN')
  if (!token) return new Map()
  const ref = new URL(supabaseUrl).hostname.split('.')[0]
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'select id, encrypted_password from auth.users' }),
  })
  if (!res.ok) throw new Error(`Reading password hashes: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as { id: string; encrypted_password: string | null }[]
  return new Map(rows.filter(r => r.encrypted_password).map(r => [r.id, r.encrypted_password!]))
}

// ---------------------------------------------------------------------------
// Convex import (internal functions, run with the CLI's deployment credentials)
// ---------------------------------------------------------------------------

type Report = { inserted: number; skipped: number; problems: string[] }

function convexRun(fn: string, args: unknown): any {
  const out = execFileSync('npx', ['convex', 'run', ...(PROD ? ['--prod'] : []), fn, JSON.stringify(args)], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(out)
}

function importInBatches(fn: string, rows: Row[]): Report {
  const total: Report = { inserted: 0, skipped: 0, problems: [] }
  for (let i = 0; i < rows.length; i += BATCH) {
    const r: Report = convexRun(fn, { rows: rows.slice(i, i + BATCH) })
    total.inserted += r.inserted
    total.skipped += r.skipped
    total.problems.push(...r.problems)
  }
  return total
}

// ---------------------------------------------------------------------------
// Storage → Cloudinary
// ---------------------------------------------------------------------------

const hasCloudinary = () => !!(env('CLOUDINARY_CLOUD_NAME') && env('CLOUDINARY_API_KEY') && env('CLOUDINARY_API_SECRET'))

async function copyToCloudinary(sb: SupabaseClient, image: Row) {
  const cloudName = required('CLOUDINARY_CLOUD_NAME')
  const apiKey = required('CLOUDINARY_API_KEY')
  const apiSecret = required('CLOUDINARY_API_SECRET')

  const { data: blob, error } = await sb.storage.from(BUCKET).download(image.file_path)
  if (error || !blob) throw new Error(`download failed: ${error?.message ?? 'empty'}`)

  // Fixed public_id + overwrite=false: a re-run returns the existing asset.
  const params = {
    timestamp: Math.floor(Date.now() / 1000),
    public_id: `bossom/migrated/${image.case_id}/${image.id}`,
    type: UPLOAD_TYPE,
    overwrite: 'false',
    allowed_formats: ALLOWED_FORMATS,
  }
  const form = new FormData()
  for (const [k, v] of Object.entries(params)) form.append(k, String(v))
  form.append('api_key', apiKey)
  form.append('signature', await signParams(params, apiSecret))
  form.append('file', blob, image.file_name ?? 'image')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: form })
  const body = await res.json()
  if (!res.ok) throw new Error(`Cloudinary: ${body?.error?.message ?? res.status}`)
  return {
    public_id: body.public_id as string,
    version: body.version as number,
    resource_type: body.resource_type as string,
    format: body.format as string | undefined,
    bytes: body.bytes as number,
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL')
  const sb = createClient(supabaseUrl, required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

  console.log(`Supabase → Convex${PROD ? ' (PRODUCTION)' : ' (dev deployment)'}${DRY_RUN ? ' — dry run, nothing will be written' : ''}\n`)

  // 1. Export everything
  const tables: Record<string, Row[] | null> = {}
  try {
    for (const t of [...APP_TABLES, ...ARCHIVE_TABLES]) tables[t] = await fetchAll(sb, t)
  } catch (err) {
    if (String((err as Error).message).includes('fetch failed')) {
      console.error(`Can't reach ${supabaseUrl}. If the project is paused, restore it from the Supabase dashboard first.`)
      process.exit(1)
    }
    throw err
  }
  const authUsers = await fetchAuthUsers(sb)
  const hashes = await fetchPasswordHashes(supabaseUrl)

  mkdirSync('migration-data', { recursive: true })
  const backup = `migration-data/supabase-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(backup, JSON.stringify({ exportedAt: new Date().toISOString(), tables, authUsers }, null, 2), { mode: 0o600 })
  console.log(`Backup written to ${backup}\n`)

  for (const t of [...APP_TABLES, ...ARCHIVE_TABLES]) {
    console.log(`  ${t.padEnd(26)} ${tables[t] === null ? '(table not present)' : tables[t]!.length}`)
  }
  console.log(`  ${'auth users'.padEnd(26)} ${authUsers.length}`)
  console.log(`  ${'password hashes'.padEnd(26)} ${hashes.size}${env('SUPABASE_ACCESS_TOKEN') ? '' : ' (set SUPABASE_ACCESS_TOKEN to keep passwords)'}`)
  for (const t of ARCHIVE_TABLES) {
    if (tables[t]?.length) console.log(`  note: ${t} has rows; they are kept in the backup file only`)
  }

  if (DRY_RUN) return

  // 2. Users: auth.users is the source of truth for identity; the profile
  //    table and sign-up metadata fill in the rest.
  const profiles = new Map((tables.users ?? []).map(u => [u.id, u]))
  const userRows = authUsers.map(u => {
    const p = profiles.get(u.id) ?? {}
    const m = u.user_metadata ?? {}
    return {
      id: u.id,
      email: u.email,
      email_confirmed_at: u.email_confirmed_at ?? null,
      password_hash: hashes.get(u.id) ?? null,
      full_name: p.full_name ?? m.full_name,
      medical_license_number: p.medical_license_number ?? m.medical_license_number,
      specialization: p.specialization ?? m.specialization,
      hospital_affiliation: p.hospital_affiliation ?? m.hospital_affiliation,
      phone_number: p.phone_number,
      role: p.role ?? m.role,
      is_active: p.is_active,
      created_at: p.created_at ?? u.created_at,
      updated_at: p.updated_at ?? u.updated_at,
    }
  })

  const reports: Record<string, Report> = {}
  console.log('\nImporting…')
  reports.users = importInBatches('migration:importUsers', userRows)
  reports.patients = importInBatches('migration:importPatients', tables.patients ?? [])
  reports.clinical_history = importInBatches('migration:importClinicalHistory', tables.patient_clinical_history ?? [])
  reports.cases = importInBatches('migration:importCases', tables.cases ?? [])

  // 3. Images: copy each file to Cloudinary, then record it.
  const done = new Set<string>(convexRun('migration:importedImageLegacyIds', {}))
  const pending = (tables.images ?? []).filter(i => !done.has(i.id))
  const imageRows: Row[] = []
  const copyProblems: string[] = []
  if (pending.length && !hasCloudinary()) {
    copyProblems.push(`${pending.length} image(s) not copied: CLOUDINARY_* is not set. Set it and re-run; analyses of these images import then too.`)
  }
  for (const [n, image] of (hasCloudinary() ? pending : []).entries()) {
    process.stdout.write(`  copying image ${n + 1}/${pending.length}\r`)
    try {
      imageRows.push({ ...image, cloudinary: await copyToCloudinary(sb, image) })
    } catch (err) {
      copyProblems.push(`image ${image.id} (${image.file_path}): ${(err as Error).message}`)
    }
  }
  reports.images = importInBatches('migration:importImages', imageRows)
  reports.images.skipped += done.size
  reports.images.problems.unshift(...copyProblems)

  reports.analyses = importInBatches('migration:importAnalyses', tables.analyses ?? [])
  reports.regions = importInBatches('migration:importRegions', tables.regions_of_interest ?? [])

  // 4. Report
  console.log('\n\nResult')
  for (const [name, r] of Object.entries(reports)) {
    console.log(`  ${name.padEnd(18)} inserted ${r.inserted}, already present ${r.skipped}, problems ${r.problems.length}`)
  }
  const problems = Object.entries(reports).flatMap(([name, r]) => r.problems.map(p => `[${name}] ${p}`))
  if (problems.length) {
    const file = backup.replace('supabase-export', 'problems').replace('.json', '.txt')
    writeFileSync(file, problems.join('\n') + '\n', { mode: 0o600 })
    console.log(`\n${problems.length} problem(s) listed in ${file}. Re-running is safe once they're fixed.`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
