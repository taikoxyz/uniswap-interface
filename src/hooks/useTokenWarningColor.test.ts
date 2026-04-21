import { WARNING_LEVEL } from 'constants/tokenSafety'
import { renderHook } from 'test-utils/render'
import { darkTheme } from 'theme/colors'
import { darkDeprecatedTheme } from 'theme/deprecatedColors'

import { useTokenWarningColor, useTokenWarningTextColor } from './useTokenWarningColor'

// Tests assert against darkTheme since the test render provides dark mode by default.
describe('Token Warning Colors', () => {
  describe('useTokenWarningColor', () => {
    it('medium', () => {
      const { result } = renderHook(() => useTokenWarningColor(WARNING_LEVEL.MEDIUM))
      expect(result.current).toEqual(darkTheme.surface3)
    })

    it('strong', () => {
      const { result } = renderHook(() => useTokenWarningColor(WARNING_LEVEL.UNKNOWN))
      expect(result.current).toEqual(darkDeprecatedTheme.deprecated_accentFailureSoft)
    })

    it('blocked', () => {
      const { result } = renderHook(() => useTokenWarningColor(WARNING_LEVEL.BLOCKED))
      expect(result.current).toEqual(darkTheme.surface3)
    })
  })

  describe('useTokenWarningTextColor', () => {
    it('medium', () => {
      const { result } = renderHook(() => useTokenWarningTextColor(WARNING_LEVEL.MEDIUM))
      expect(result.current).toEqual(darkDeprecatedTheme.deprecated_accentWarning)
    })

    it('strong', () => {
      const { result } = renderHook(() => useTokenWarningTextColor(WARNING_LEVEL.UNKNOWN))
      expect(result.current).toEqual(darkTheme.critical)
    })

    it('blocked', () => {
      const { result } = renderHook(() => useTokenWarningTextColor(WARNING_LEVEL.BLOCKED))
      expect(result.current).toEqual(darkTheme.neutral2)
    })
  })
})
