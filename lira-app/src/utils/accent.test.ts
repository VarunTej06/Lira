import { beforeEach, describe, expect, it } from 'vitest'
import { ACCENTS, DEFAULT_ACCENT, accentCss, contrast, accentVars, applyAccent, isDefaultAccent, loadAccent, parseHex, saveAccent } from './accent'

describe('accent colours', () => {
  beforeEach(() => { localStorage.clear(); document.head.innerHTML = '' })

  it('offers a good range of valid, distinct colours', () => {
    expect(ACCENTS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(ACCENTS.map(a => a.hex)).size).toBe(ACCENTS.length)
    expect(ACCENTS.every(a => parseHex(a.hex) !== undefined)).toBe(true)
    expect(ACCENTS[0].hex).toBe(DEFAULT_ACCENT)
  })

  it('parses hex with or without #, rejects the rest', () => {
    expect(parseHex('#0052CC')).toEqual([0, 82, 204])
    expect(parseHex('ff0000')).toEqual([255, 0, 0])
    expect(parseHex('red')).toBeUndefined()
    expect(parseHex('#12345')).toBeUndefined()
  })

  it('uses the colour itself in light mode, and a brighter shade in dark mode', () => {
    const light = accentVars('#6554C0', false)!
    expect(light.blue).toBe('101 84 192')
    const dark = accentVars('#6554C0', true)!
    const [lr, lg, lb] = light.blue.split(' ').map(Number)
    const [dr, dg, db] = dark.blue.split(' ').map(Number)
    expect(dr + dg + db).toBeGreaterThan(lr + lg + lb)
    expect(accentVars('nope', false)).toBeUndefined()
  })

  it('makes a pale tint in light mode and a deep tint in dark mode', () => {
    const sum = (s: string) => s.split(' ').map(Number).reduce((a, b) => a + b, 0)
    expect(sum(accentVars('#DB2777', false)!.light)).toBeGreaterThan(600)
    expect(sum(accentVars('#DB2777', true)!.light)).toBeLessThan(250)
  })

  it('measures contrast the way WCAG does', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0)
    expect(contrast([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5)
  })

  it('never reads worse in dark mode than the old fixed lightening, for every colour on offer', () => {
    const dark: [number, number, number] = [13, 17, 23]
    const white: [number, number, number] = [255, 255, 255]
    const score = (c: [number, number, number]) => Math.min(contrast(white, c), contrast(c, dark))
    for (const a of ACCENTS) {
      const base = parseHex(a.hex)!
      const old = base.map(v => Math.round(v + (255 - v) * 0.28)) as [number, number, number]
      const now = accentVars(a.hex, true)!.blue.split(' ').map(Number) as [number, number, number]
      expect(score(now), a.name).toBeGreaterThanOrEqual(score(old) - 1e-9)
    }
  })

  it('in light mode every accent reads at 4.5 or better on its own soft tint, and colours that already did are unchanged', () => {
    const tintOf = (hex: string) => accentVars(hex, false)!.light.split(' ').map(Number) as [number, number, number]
    for (const a of ACCENTS) {
      const blue = accentVars(a.hex, false)!.blue.split(' ').map(Number) as [number, number, number]
      expect(contrast(blue, tintOf(a.hex)), a.name).toBeGreaterThanOrEqual(4.5)
    }
    expect(accentVars('#0052CC', false)!.blue).toBe('0 82 204') // the default blue was already readable
  })

  it('writes no CSS for the default blue, so nothing changes', () => {
    expect(isDefaultAccent('#0052cc')).toBe(true)
    expect(accentCss('#0052CC')).toBe('')
    expect(accentCss(undefined)).toBe('')
  })

  it('writes overrides for both themes', () => {
    const css = accentCss('#059669')
    expect(css).toContain(':root{--lira-blue:')
    expect(css).toContain('.dark{--lira-blue:')
    expect(css).toContain('--lira-blue-hover')
    expect(css).toContain('--lira-blue-light')
  })

  it('applies, replaces and removes the page style', () => {
    applyAccent('#059669')
    expect(document.getElementById('lira-accent')!.textContent).toContain(':root{--lira-blue:')
    applyAccent('#DB2777')
    expect(document.querySelectorAll('#lira-accent')).toHaveLength(1)
    expect(document.getElementById('lira-accent')!.textContent).toContain('.dark{')
    applyAccent(DEFAULT_ACCENT)
    expect(document.getElementById('lira-accent')).toBeNull()
  })

  it('saves the choice (so it reaches data/settings.json) and loads it back', () => {
    expect(loadAccent()).toBe(DEFAULT_ACCENT)
    saveAccent('#8b5cf6')
    expect(localStorage.getItem('lira_accent')).toBe('#8B5CF6')
    expect(loadAccent()).toBe('#8B5CF6')
    expect(document.getElementById('lira-accent')).not.toBeNull()
  })
})
