export type RiskPredictionResult = {
  oneYearRisk: number
  twoYearRisk: number
  threeYearRisk: number
  fourYearRisk: number
  fiveYearRisk: number
  riskCategory: 'low' | 'moderate' | 'high'
  modelName: string
  modelVersion: string
  disclaimer: string
}

export async function predictBreastCancerRisk(
  caseId: string
): Promise<RiskPredictionResult> {
  // Temporary mock response.
  void caseId

  const fiveYearRisk = 0.14

  return {
    oneYearRisk: 0.03,
    twoYearRisk: 0.06,
    threeYearRisk: 0.09,
    fourYearRisk: 0.11,
    fiveYearRisk,
    riskCategory:
      fiveYearRisk < 0.1 ? 'low' : fiveYearRisk < 0.2 ? 'moderate' : 'high',
    modelName: 'mirai',
    modelVersion: '0.14.1',
    disclaimer:
      'This AI output is for research support only and is not a diagnosis.',
  }
}