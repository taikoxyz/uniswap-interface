import { BaseVariant, FeatureFlag, useBaseFlag } from '../index'

export function useInfoPoolPageFlag(): BaseVariant {
  return useBaseFlag(FeatureFlag.infoPoolPage)
}

export function useInfoPoolPageEnabled(): boolean {
  // Always enable pool detail pages for Taiko DEX
  return true
}
