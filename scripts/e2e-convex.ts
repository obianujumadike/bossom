/**
 * End-to-end checks against a real Convex dev deployment, with unique data
 * per run. Covers the auth flows behind the QA reports (duplicate email,
 * sign-in without password, sign-up failures) and case ownership.
 *
 *   npx tsx scripts/e2e-convex.ts
 *
 * Needs NEXT_PUBLIC_CONVEX_URL in .env.local and DEV_LOG_AUTH_CODES=true on
 * the deployment: codes are read back from `npx convex logs`.
 * Never point this at production.
 */
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { ConvexHttpClient } from 'convex/browser'
import bcrypt from 'bcryptjs'
import { api } from '../convex/_generated/api'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL
if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')

const run = Date.now().toString(36)
const emailA = `QA.Radiologist+${run}@Example.com` // mixed case on purpose
const emailB = `qa.other+${run}@example.com`
const password = 'correct-horse-battery'

let passed = 0
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    console.error(`  ✗ ${name}\n`, err)
    process.exit(1)
  }
}

const anon = () => new ConvexHttpClient(url)
type SignInResult = { tokens?: { token: string } | null; started?: boolean }
const signIn = (params: Record<string, string>) =>
  anon().action(api.auth.signIn, { provider: 'password', params }) as Promise<SignInResult>

async function expectError(code: string, fn: () => Promise<unknown>) {
  await assert.rejects(fn, (err: Error) => err.message.includes(code) || (err as any).data === code)
}

/** Latest dev-logged code for an email, read from the deployment logs. */
async function latestCode(purpose: 'verify' | 'reset', email: string): Promise<string> {
  const needle = `${purpose} code for ${email.toLowerCase()}: `
  for (let attempt = 0; attempt < 5; attempt++) {
    const out = await new Promise<string>(resolve => {
      const p = spawn('npx', ['convex', 'logs', '--history', '200', '--jsonl'], { stdio: ['ignore', 'pipe', 'ignore'] })
      let buf = ''
      p.stdout.on('data', d => (buf += d))
      setTimeout(() => (p.kill(), resolve(buf)), 6000)
    })
    const codes = [...out.matchAll(new RegExp(`${needle.replace(/[.+]/g, '\\$&')}(\\d{6})`, 'g'))].map(m => m[1])
    if (codes.length) return codes.at(-1)!
  }
  throw new Error(`no ${purpose} code found in logs for ${email}`)
}

function authed(token: string) {
  const c = new ConvexHttpClient(url)
  c.setAuth(token)
  return c
}

const signUpParams = (email: string) => ({
  flow: 'signUp',
  email,
  password,
  fullName: 'Dr. QA Tester',
  medicalLicense: 'MD-QA-001',
  specialization: 'Radiology',
})

async function main() {
  console.log(`Convex e2e against ${url} (run ${run})`)
  let tokenA = ''
  let caseId = ''

  console.log('\nSign-up')
  await step('rejects a short password', () => expectError('INVALID_PASSWORD', () => signIn({ ...signUpParams(emailA), password: 'short' })))
  await step('rejects missing license number', () => expectError('MISSING_PROFILE', () => signIn({ ...signUpParams(emailA), medicalLicense: '' })))
  await step('creates the account but issues no session before the code', async () => {
    const r = await signIn(signUpParams(emailA))
    assert.ok(!r.tokens, 'sign-up must not return a session')
  })
  await step('refuses the same email in a different case (QA: same email twice)', () =>
    expectError('ACCOUNT_EXISTS', () => signIn(signUpParams(emailA.toLowerCase()))))
  await step('refuses the same email with the same password too', () =>
    expectError('ACCOUNT_EXISTS', () => signIn(signUpParams(emailA))))

  console.log('\nVerification')
  await step('rejects a wrong code', () =>
    expectError('INVALID_CODE', () => signIn({ flow: 'email-verification', email: emailA, code: '000000' })))
  await step('the emailed code signs the user in', async () => {
    const code = await latestCode('verify', emailA)
    const r = await signIn({ flow: 'email-verification', email: emailA.toUpperCase(), code })
    assert.ok(r.tokens?.token, 'expected a session after verifying')
    tokenA = r.tokens!.token
  })

  console.log('\nSign-in')
  await step('wrong password is rejected (QA: signed in without a password)', () =>
    expectError('INVALID_CREDENTIALS', () => signIn({ flow: 'signIn', email: emailA, password: 'not-the-password' })))
  await step('missing password is rejected', () =>
    expectError('INVALID_CREDENTIALS', () => signIn({ flow: 'signIn', email: emailA, password: '' })))
  await step('correct password signs in, case-insensitively', async () => {
    const r = await signIn({ flow: 'signIn', email: emailA.toLowerCase(), password })
    assert.ok(r.tokens?.token)
  })
  await step('unknown email is rejected with the same error as a wrong password', () =>
    expectError('INVALID_CREDENTIALS', () => signIn({ flow: 'signIn', email: `nobody+${run}@example.com`, password })))

  console.log('\nProfile and cases')
  await step('profile comes from the session', async () => {
    const me = await authed(tokenA).query(api.users.me, {})
    assert.equal(me?.email, emailA.toLowerCase())
    assert.equal(me?.full_name, 'Dr. QA Tester')
    assert.equal(me?.is_verified, true)
  })
  await step('signed-out callers get UNAUTHENTICATED', () => expectError('UNAUTHENTICATED', () => anon().query(api.cases.list, {})))
  await step('creates a case', async () => {
    const c = await authed(tokenA).mutation(api.cases.create, { patientId: `MRN-${run}`, patientAge: 52, patientGender: 'Female' })
    caseId = c.id
    assert.equal(c.status, 'pending')
  })
  await step('lists, searches and fetches it with nulls for empty fields', async () => {
    const list = await authed(tokenA).query(api.cases.list, { search: `mrn-${run}` })
    assert.equal(list.length, 1)
    const c = await authed(tokenA).query(api.cases.get, { id: caseId })
    assert.equal(c.patients?.patient_id, `MRN-${run}`)
    assert.equal(c.clinical_indication, null)
    const dash = await authed(tokenA).query(api.cases.dashboard, {})
    assert.equal(dash.total_cases, 1)
  })
  await step('pre-migration UUID case links resolve to NOT_FOUND', () =>
    expectError('NOT_FOUND', () => authed(tokenA).query(api.cases.get, { id: '3f2b6d1e-0000-4000-8000-000000000000' })))

  console.log('\nIsolation between radiologists')
  let tokenB = ''
  await step('second radiologist signs up and verifies', async () => {
    await signIn(signUpParams(emailB))
    const r = await signIn({ flow: 'email-verification', email: emailB, code: await latestCode('verify', emailB) })
    tokenB = r.tokens!.token
  })
  await step("cannot read another radiologist's case", () => expectError('NOT_FOUND', () => authed(tokenB).query(api.cases.get, { id: caseId })))
  await step("cannot update another radiologist's case", () =>
    expectError('NOT_FOUND', () => authed(tokenB).mutation(api.cases.update, { id: caseId, status: 'completed' })))
  await step("cannot sign uploads for another radiologist's case", () =>
    expectError('NOT_FOUND', () => authed(tokenB).action(api.images.signUpload, { caseId })))

  console.log('\nPassword reset')
  await step('unknown email gets the same response and no code', async () => {
    const r = await signIn({ flow: 'reset', email: `nobody+${run}@example.com` })
    assert.ok(!r.tokens)
  })
  await step('a reset code sets a new password and signs in', async () => {
    await signIn({ flow: 'reset', email: emailA })
    const code = await latestCode('reset', emailA)
    const r = await signIn({ flow: 'reset-verification', email: emailA, code, newPassword: 'a-brand-new-password' })
    assert.ok(r.tokens?.token)
  })
  await step('the old password no longer works', () =>
    expectError('INVALID_CREDENTIALS', () => signIn({ flow: 'signIn', email: emailA, password })))
  await step('the new password works', async () => {
    const r = await signIn({ flow: 'signIn', email: emailA, password: 'a-brand-new-password' })
    assert.ok(r.tokens?.token)
  })

  console.log('\nMigrated Supabase user')
  const legacyEmail = `legacy+${run}@example.com`
  await step('a user imported with their Supabase bcrypt hash signs in with the old password', async () => {
    const row = {
      id: `00000000-0000-4000-8000-${run.padStart(12, '0').slice(-12)}`,
      email: legacyEmail,
      password_hash: bcrypt.hashSync('old-supabase-password', 10),
      email_confirmed_at: new Date().toISOString(),
      full_name: 'Dr. Legacy',
      medical_license_number: 'MD-LEGACY',
    }
    execFileSync('npx', ['convex', 'run', 'migration:importUsers', JSON.stringify({ rows: [row] })], { stdio: 'ignore' })
    await expectError('INVALID_CREDENTIALS', () => signIn({ flow: 'signIn', email: legacyEmail, password: 'wrong' }))
    const r = await signIn({ flow: 'signIn', email: legacyEmail, password: 'old-supabase-password' })
    assert.ok(r.tokens?.token)
  })
  await step('and still signs in after the hash is upgraded to scrypt', async () => {
    const r = await signIn({ flow: 'signIn', email: legacyEmail, password: 'old-supabase-password' })
    assert.ok(r.tokens?.token)
  })
  await step('signing up again with a migrated email is refused', () =>
    expectError('ACCOUNT_EXISTS', () => signIn(signUpParams(legacyEmail))))

  console.log(`\n${passed} checks passed`)
}

main()
