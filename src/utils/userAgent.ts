import { UAParser } from 'ua-parser-js'

const parser = new UAParser(window.navigator.userAgent)
const { type } = parser.getDevice()
const { name } = parser.getBrowser()

export const isMobile = type === 'mobile' || type === 'tablet'
const platform = parser.getOS().name
export const isIOS = platform === 'iOS'

// eslint-disable-next-line import/no-unused-modules -- used by the temporarily disabled BaseWalletBanner (components/Banner/BaseAnnouncementBanner)
export const isMobileSafari = isMobile && isIOS && name?.toLowerCase().includes('safari')
