import { t } from '@lingui/macro'
import { allowAnalyticsAtom } from 'analytics'
import { useAtom } from 'jotai'

import { SettingsToggle } from './SettingsToggle'

export function AnalyticsToggle() {
  const [allowAnalytics, updateAllowAnalytics] = useAtom(allowAnalyticsAtom)

  return (
    <SettingsToggle
      title={t`Allow analytics`}
      description={t`We use anonymized device and browser data to enhance your experience with Taiko DEX. No personal information or IP addresses are collected.`}
      isActive={allowAnalytics}
      toggle={() => void updateAllowAnalytics((value) => !value)}
    />
  )
}
