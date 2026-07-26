import { isWidgetPath } from './isWidgetPath'

describe('isWidgetPath', () => {
  it('matches the widget route', () => {
    expect(isWidgetPath('/widget')).toBe(true)
  })

  it('matches the widget route with a single trailing slash (server normalizes it away)', () => {
    expect(isWidgetPath('/widget/')).toBe(true)
  })

  it('does not match multi-slash variants, which the framing header does not cover', () => {
    expect(isWidgetPath('/widget//')).toBe(false)
    expect(isWidgetPath('/widget///')).toBe(false)
  })

  it('does not match other routes', () => {
    expect(isWidgetPath('/')).toBe(false)
    expect(isWidgetPath('/swap')).toBe(false)
    expect(isWidgetPath('/widgets')).toBe(false)
    expect(isWidgetPath('/widget/settings')).toBe(false)
    expect(isWidgetPath('/my/widget')).toBe(false)
  })
})
