import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AUTH_ERRORS, authErrorMessage, emailError, isValidPhone, normalizeEmail, passwordError, safeNextPath } from './rules'

// QA report: "created an account with the same email twice".
test('case and whitespace variants of an email normalise to one account key', () => {
  assert.equal(normalizeEmail('  Jane.Doe@Hospital.ORG '), 'jane.doe@hospital.org')
  assert.equal(normalizeEmail('jane.doe@hospital.org'), normalizeEmail('JANE.DOE@HOSPITAL.ORG'))
  assert.equal(normalizeEmail(undefined), '')
})

test('email and password validation', () => {
  assert.equal(emailError(''), 'Email is required')
  assert.equal(emailError('not-an-email'), 'Invalid email address')
  assert.equal(emailError('a@b.co'), null)
  assert.equal(passwordError('short'), 'Password must be at least 8 characters')
  assert.equal(passwordError(undefined), 'Password is required')
  assert.equal(passwordError('long-enough'), null)
})

test('auth error codes survive the "[Request ID] Server Error" wrapping and map to copy', () => {
  assert.equal(authErrorMessage(new Error('ACCOUNT_EXISTS')), AUTH_ERRORS.ACCOUNT_EXISTS)
  assert.equal(authErrorMessage(new Error('[CONVEX A(auth:signIn)] [Request ID: 1] Uncaught ConvexError: INVALID_CODE')), AUTH_ERRORS.INVALID_CODE)
  assert.equal(authErrorMessage(new Error('Failed to fetch')), 'Network error. Check your connection and try again.')
  assert.equal(authErrorMessage(new Error('Server Error')), 'Something went wrong. Please try again.')
})

test('post-login redirect only accepts same-origin paths', () => {
  assert.equal(safeNextPath('/cases/123/analysis'), '/cases/123/analysis')
  assert.equal(safeNextPath('https://evil.example'), '/dashboard')
  assert.equal(safeNextPath('//evil.example'), '/dashboard')
  assert.equal(safeNextPath('/\\evil.example'), '/dashboard')
  assert.equal(safeNextPath(null), '/dashboard')
})

test('phone numbers follow the same rule as the profile form', () => {
  assert.equal(isValidPhone('+234 801 234 5678'), true)
  assert.equal(isValidPhone('(080) 1234-5678'), false) // leading zero once cleaned
  assert.equal(isValidPhone('+1 (555) 010-9999'), true)
  assert.equal(isValidPhone('12345'), false)
})
