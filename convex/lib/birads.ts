// The inference service (#25) returns a malignancy probability, not a BI-RADS
// category, so the category shown to the radiologist is derived here. These
// cutoffs are the ones introduced in #25; change them only with clinical
// sign-off, and update birads.test.ts with the reason.

/** Approximate BI-RADS category from a malignancy probability in [0, 1]. */
export function approxBiradsFromMalignancy(probability: number): 2 | 3 | 4 | 5 {
  if (probability >= 0.7) return 5
  if (probability >= 0.4) return 4
  if (probability >= 0.1) return 3
  return 2
}
