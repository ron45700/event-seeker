import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// WCAG 2.2 AA contrast for the colour tokens in both themes, read straight from tokens.css
// so the test checks what ships. Venue colours are OKLCH formulas over a hue; they are
// checked across the whole hue circle.

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')
const AA_TEXT = 4.5

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`no ${selector} block in tokens.css`)
  return css.slice(start, css.indexOf('}', start))
}

function hexTokens(selector: string): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const [, name, value] of block(selector).matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) {
    tokens[name] = value
  }
  return tokens
}

type Oklch = { l: number; c: number }

function oklchTokens(selector: string): Record<string, Oklch> {
  const tokens: Record<string, Oklch> = {}
  const pattern = /--([\w-]+):\s*oklch\(([\d.]+) ([\d.]+) var\(--venue-hue\)\)/g
  for (const [, name, l, c] of block(selector).matchAll(pattern)) tokens[name] = { l: +l, c: +c }
  return tokens
}

type Rgb = [number, number, number] // linear sRGB, 0..1

function hexToLinear(hex: string): Rgb {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return [channel(0), channel(1), channel(2)]
}

/** OKLCH to linear sRGB (Björn Ottosson's matrices), clipped to the sRGB gamut. */
function oklchToLinear({ l, c }: Oklch, hue: number): Rgb {
  const a = c * Math.cos((hue * Math.PI) / 180)
  const b = c * Math.sin((hue * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clip = (v: number) => Math.min(1, Math.max(0, v))
  return [
    clip(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clip(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clip(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ]
}

function contrast(x: Rgb, y: Rgb): number {
  const lum = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

const themes = {
  dark: hexTokens(':root'),
  light: { ...hexTokens(':root'), ...hexTokens(":root[data-theme='light']") },
}

// [foreground, background] pairs that carry text in the UI.
const TEXT_PAIRS: [string, string][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-raised'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['text-muted', 'surface-raised'],
  ['accent-ink', 'accent'], // buttons, the followed chip and date stub
  ['accent-strong', 'bg'], // active tab label, toast action
  ['accent-strong', 'surface'],
  ['danger', 'bg'],
  ['danger', 'surface-raised'],
]

// Non-text pairs that carry state (WCAG 1.4.11, 3:1).
const UI_PAIRS: [string, string][] = [
  ['track-off', 'bg'], // a switch that is off, in the filter bar
  ['track-off', 'surface'], // and in the sheet
]
const AA_UI = 3

describe.each(Object.entries(themes))('%s theme', (_name, tokens) => {
  const ratio = (fg: string, bg: string) => {
    expect(tokens[fg], `--${fg}`).toBeDefined()
    expect(tokens[bg], `--${bg}`).toBeDefined()
    return contrast(hexToLinear(tokens[fg]), hexToLinear(tokens[bg]))
  }

  it.each(TEXT_PAIRS)('%s on %s meets AA for text', (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it.each(UI_PAIRS)('%s on %s meets AA for UI components', (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(AA_UI)
  })
})

describe('venue colours across all hues', () => {
  const base = oklchTokens('[data-venue]')
  const light = { ...base, ...oklchTokens(":root[data-theme='light'] [data-venue]") }
  const hues = Array.from({ length: 72 }, (_, i) => i * 5)
  const worst = (fg: Oklch, bg: (hue: number) => Rgb) =>
    Math.min(...hues.map((hue) => contrast(oklchToLinear(fg, hue), bg(hue))))

  it('badge ink on badge fill meets AA', () => {
    expect(worst(base['venue-ink'], (h) => oklchToLinear(base.venue, h))).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it.each([
    ['dark', base, themes.dark.surface],
    ['light', light, themes.light.surface],
  ] as const)('%s: poster title and festival label meet AA', (_name, venue, surface) => {
    // Poster title on the fallback poster.
    expect(worst(venue['venue-glow'], (h) => oklchToLinear(venue['venue-deep'], h))).toBeGreaterThanOrEqual(AA_TEXT)
    // "פסטיבל" label on the card body.
    expect(worst(venue['venue-glow'], () => hexToLinear(surface))).toBeGreaterThanOrEqual(AA_TEXT)
  })
})
