import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chooseEmailTransport, normalizeAppPassword } from './emailTransport'

const gmail = { GMAIL_USER: 'bossom.app@gmail.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' }
const resend = { AUTH_RESEND_KEY: 're_123', AUTH_EMAIL_FROM: 'Bossom <no-reply@bossom.app>' }

test('dev code logging wins, so e2e runs never send real email', () => {
  assert.equal(chooseEmailTransport({ DEV_LOG_AUTH_CODES: 'true', ...gmail, ...resend }), 'log')
})

test('Gmail is used when both of its settings are present, ahead of Resend', () => {
  assert.equal(chooseEmailTransport(gmail), 'gmail')
  assert.equal(chooseEmailTransport({ ...gmail, ...resend }), 'gmail')
})

test('Resend is the fallback, and half-configured services are ignored', () => {
  assert.equal(chooseEmailTransport(resend), 'resend')
  assert.equal(chooseEmailTransport({ GMAIL_USER: 'x@gmail.com', ...resend }), 'resend')
  assert.equal(chooseEmailTransport({ GMAIL_USER: 'x@gmail.com' }), null)
  assert.equal(chooseEmailTransport({ DEV_LOG_AUTH_CODES: 'false' }), null)
})

test('app passwords pasted with Google’s spacing still work', () => {
  assert.equal(normalizeAppPassword('abcd efgh ijkl mnop'), 'abcdefghijklmnop')
  assert.equal(normalizeAppPassword(' abcdefghijklmnop\n'), 'abcdefghijklmnop')
})
