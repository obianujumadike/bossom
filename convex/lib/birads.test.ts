import { test } from 'node:test'
import assert from 'node:assert/strict'
import { approxBiradsFromMalignancy } from './birads'

// Cutoffs from #25 (connect mammogram analysis to inference service).
test('malignancy probability maps to the #25 BI-RADS cutoffs, inclusive at each boundary', () => {
  assert.equal(approxBiradsFromMalignancy(0), 2)
  assert.equal(approxBiradsFromMalignancy(0.0999), 2)
  assert.equal(approxBiradsFromMalignancy(0.1), 3)
  assert.equal(approxBiradsFromMalignancy(0.3999), 3)
  assert.equal(approxBiradsFromMalignancy(0.4), 4)
  assert.equal(approxBiradsFromMalignancy(0.6999), 4)
  assert.equal(approxBiradsFromMalignancy(0.7), 5)
  assert.equal(approxBiradsFromMalignancy(1), 5)
})
