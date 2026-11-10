import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Sample } from '../types'

const PANE = 'usage-meter'
const TITLE = 'Usage'
const EVERY_MS = 60_000
const KEEP = 300 // samples kept: 5 hours at one a minute

const samples = atom({ plugin: 'usage-meter', key: 'samples' } as const, [] as Sample[], {
  shape: 'samples-1',
})

type Key = 'five' | 'week' | 'ctx'
const KEYS: Key[] = ['week', 'ctx', 'five'] // drawn in this order, so the 5-hour line sits on top
const COLORS: Record<Key, string> = { five: '#e07a4f', week: '#5b8def', ctx: '#3fae7a' }

async function takeSample($: EngineInterface) {
  const u = await $.session.usage()
  const t = await $.clock.now()
  const five = u.rateLimits.find(r => r.kind === 'five_hour')
  const week = u.rateLimits.find(r => r.kind === 'seven_day')
  const s: Sample = {
    t,
    five: five?.percentUsed,
    week: week?.percentUsed,
    fiveReset: five?.resetsAt,
    weekReset: week?.resetsAt,
    ctx: u.context.percent,
    ctxWindow: u.context.window,
    usd: u.cost?.usd,
  }
  await update($, samples, list => {
    const prev = list ?? []
    const last = prev[prev.length - 1]
    // A reading within 20 s of the last one replaces it, so pushes and the timer don't pile up.
    const kept = last && t - last.t < 20_000 ? prev.slice(0, -1) : prev
    return [...kept, s].slice(-KEEP)
  })
}

function ago(ms: number) {
  const m = Math.round(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  return `${Math.floor(m / 60)}h ${m % 60}m ago`
}

function until(iso: string | undefined, now: number) {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (!(ms > 0)) return 'resetting'
  const m = Math.round(ms / 60_000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d > 0) return `resets in ${d}d ${h}h`
  return `resets in ${h}h ${m % 60}m`
}

function pct(v: number | undefined) {
  return v === undefined ? '–' : `${Math.round(v * 10) / 10}%`
}

function bar(v: number | undefined, width = 16) {
  const n = Math.max(0, Math.min(width, Math.round(((v ?? 0) / 100) * width)))
  return '█'.repeat(n) + '░'.repeat(width - n)
}

// Percentage points per hour over the last `spanMs`, from the samples that carry the field.
function rate(list: Sample[], key: Key, spanMs: number) {
  const pts = list.filter(s => s[key] !== undefined)
  if (pts.length < 2) return undefined
  const last = pts[pts.length - 1]!
  const first = pts.find(s => last.t - s.t <= spanMs) ?? pts[0]!
  const dt = last.t - first.t
  if (dt < 60_000) return undefined
  return (((last[key] as number) - (first[key] as number)) / dt) * 3_600_000
}

function signed(v: number | undefined, unit: string) {
  return v === undefined ? '–' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}${unit}`
}

// The time span and value range both graphs share.
function frame(list: Sample[], now: number) {
  const span = Math.max(10 * 60_000, now - (list[0]?.t ?? now))
  const vals = list.flatMap(s => [s.five, s.week, s.ctx]).filter((v): v is number => v !== undefined)
  const top = Math.max(10, Math.ceil((Math.max(0, ...vals) * 1.25) / 10) * 10)
  const mins = Math.round(span / 60_000)
  const label = mins >= 60 ? `-${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `-${mins}m`
  return { span, t0: now - span, top, label }
}

// ---- desktop: an SVG line graph ----

function svgChart(list: Sample[], now: number) {
  const W = 340
  const H = 150
  const L = 30
  const R = 8
  const T = 10
  const B = 22
  const { span, t0, top, label } = frame(list, now)
  const x = (t: number) => L + ((t - t0) / span) * (W - L - R)
  const y = (v: number) => T + (1 - v / top) * (H - T - B)

  const grid: string[] = []
  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i
    grid.push(
      `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#8a8a8a" stroke-opacity="0.25"/>`,
      `<text x="${L - 4}" y="${y(v) + 3}" font-size="9" text-anchor="end" fill="#8a8a8a">${Math.round(v)}%</text>`,
    )
  }
  grid.push(
    `<text x="${L}" y="${H - 6}" font-size="9" fill="#8a8a8a">${label}</text>`,
    `<text x="${W - R}" y="${H - 6}" font-size="9" text-anchor="end" fill="#8a8a8a">now</text>`,
  )

  const lines = KEYS.map(key => {
    const pts = list.filter(s => s[key] !== undefined)
    if (pts.length === 0) return ''
    const d = pts.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s[key] as number).toFixed(1)}`).join(' ')
    const last = pts[pts.length - 1]!
    const cx = x(last.t).toFixed(1)
    const cy = y(last[key] as number).toFixed(1)
    // The line runs on to "now" as a dashed tail, and the newest point pulses.
    return (
      `<path d="${d}" fill="none" stroke="${COLORS[key]}" stroke-width="2" stroke-linejoin="round"/>` +
      `<line x1="${cx}" y1="${cy}" x2="${x(now).toFixed(1)}" y2="${cy}" stroke="${COLORS[key]}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"/>` +
      `<circle cx="${cx}" cy="${cy}" r="3" fill="${COLORS[key]}">` +
      `<animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite"/></circle>`
    )
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif">${grid.join('')}${lines.join('')}</svg>`
}

// ---- terminal: a braille line graph ----

// Braille cells are 2 dots wide and 4 tall; this is the bit for each dot.
const DOT = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
]

export type TextRow = { label: string; runs: { text: string; key?: Key }[] }

export function textChart(list: Sample[], now: number, cols: number, rows: number) {
  const { span, t0, top, label } = frame(list, now)
  const W = cols * 2
  const H = rows * 4
  const bits = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
  const owner = Array.from({ length: rows }, () => new Array<Key | undefined>(cols).fill(undefined))
  const dot = (x: number, y: number, key: Key) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return
    const r = y >> 2
    const c = x >> 1
    bits[r]![c]! |= DOT[y & 3]![x & 1]!
    owner[r]![c] = key
  }
  const toY = (v: number) => Math.round((1 - v / top) * (H - 1))

  for (const key of KEYS) {
    const pts = list.filter(s => s[key] !== undefined)
    if (pts.length === 0) continue
    const firstX = Math.round(((pts[0]!.t - t0) / span) * (W - 1))
    let i = 0
    let prevY: number | undefined
    for (let x = Math.max(0, firstX); x < W; x++) {
      const t = t0 + (x / (W - 1)) * span
      while (i < pts.length - 1 && pts[i + 1]!.t <= t) i++
      const a = pts[i]!
      const b = pts[i + 1]
      // Between two readings the line slopes; after the newest it stays flat until now.
      const v =
        b && b.t > a.t
          ? (a[key] as number) + (((b[key] as number) - (a[key] as number)) * (t - a.t)) / (b.t - a.t)
          : (a[key] as number)
      const y = toY(v)
      // Fill the gap from the last column so steep changes stay joined.
      if (prevY !== undefined) for (let k = Math.min(prevY, y); k <= Math.max(prevY, y); k++) dot(x, k, key)
      else dot(x, y, key)
      prevY = y
    }
  }

  const out: TextRow[] = []
  for (let r = 0; r < rows; r++) {
    const runs: TextRow['runs'] = []
    for (let c = 0; c < cols; c++) {
      const ch = bits[r]![c] ? String.fromCharCode(0x2800 + bits[r]![c]!) : ' '
      const key = bits[r]![c] ? owner[r]![c] : undefined
      const lastRun = runs[runs.length - 1]
      if (lastRun && lastRun.key === key) lastRun.text += ch
      else runs.push({ text: ch, key })
    }
    const axis = r === 0 ? `${top}%` : r === rows - 1 ? '0%' : ''
    out.push({ label: axis.padStart(4) + ' ┤', runs })
  }
  const footer = '     └' + label + ' '.repeat(Math.max(1, cols - label.length - 3)) + 'now'
  return { rows: out, footer }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'usage-meter', description: 'Open the live usage panel' })
    void $.ui.open({ id: PANE, title: TITLE })
    void takeSample($)
    $.clock.every(EVERY_MS, () => {
      void takeSample($)
    })
    return next(e)
  })

  on('command.run', { command: 'usage-meter' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    await takeSample($)
    return { text: 'Usage panel opened.' }
  })

  // The engine pushes a reading when a limit moves; take it straight away.
  on('session.measure', async ($, e, next) => {
    void takeSample($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text } = els
    const list = (await read($, samples)) ?? []
    const last = list[list.length - 1]
    if (!last) return <Text dimColor>Waiting for the first reading…</Text>
    const first = list[0]!
    const now = last.t

    const r5 = rate(list, 'five', 30 * 60_000)
    let runway = 'not enough data yet'
    if (r5 !== undefined && last.five !== undefined) {
      if (r5 <= 0.05) runway = 'flat: no use in the last 30 min'
      else {
        const hrs = (100 - last.five) / r5
        const resetMs = last.fiveReset ? Date.parse(last.fiveReset) - now : Infinity
        const h = Math.floor(hrs)
        const m = Math.round((hrs - h) * 60)
        runway =
          hrs * 3_600_000 > resetMs ? `safe: resets before you'd hit 100%` : `hits 100% in about ${h}h ${m}m at this pace`
      }
    }
    const spent = last.usd !== undefined && first.usd !== undefined ? last.usd - first.usd : undefined
    const hours = (last.t - first.t) / 3_600_000
    const ctxTokens =
      last.ctx !== undefined && last.ctxWindow ? Math.round(((last.ctx / 100) * last.ctxWindow) / 1000) : undefined
    const alt = `Usage over time: 5-hour ${pct(last.five)}, weekly ${pct(last.week)}, context ${pct(last.ctx)}`

    // The desktop, editor and phone draw an SVG; the terminal draws braille.
    let graph
    if (e.surface !== 'terminal' && 'Svg' in els) {
      const Svg = els.Svg
      graph = <Svg source={svgChart(list, now)} alt={alt} isInteractive />
    } else {
      const width = e.props.bodyColumns ?? 40
      const cols = Math.max(16, Math.min(80, width - 7))
      const { rows, footer } = textChart(list, now, cols, 8)
      graph = (
        <Box flexDirection="column">
          {rows.map(row => (
            <Text>
              <Text dimColor>{row.label}</Text>
              {row.runs.map(run => (run.key ? <Text color={COLORS[run.key]}>{run.text}</Text> : run.text))}
            </Text>
          ))}
          <Text dimColor>{footer}</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>Updates every minute · last reading {ago((await $.clock.now()) - last.t)}</Text>

        <Box flexDirection="column">
          <Text>
            <Text color={COLORS.five}>●</Text> 5-hour   {bar(last.five)} <Text bold>{pct(last.five)}</Text>
          </Text>
          <Text dimColor>   {until(last.fiveReset, now)}</Text>
          <Text>
            <Text color={COLORS.week}>●</Text> Weekly   {bar(last.week)} <Text bold>{pct(last.week)}</Text>
          </Text>
          <Text dimColor>   {until(last.weekReset, now)}</Text>
          <Text>
            <Text color={COLORS.ctx}>●</Text> Context  {bar(last.ctx)} <Text bold>{pct(last.ctx)}</Text>
          </Text>
          <Text dimColor>   this session{ctxTokens !== undefined ? `, ~${ctxTokens}k tokens` : ''}</Text>
        </Box>

        {graph}

        <Box flexDirection="column">
          <Text bold>Bonus stats</Text>
          <Text>Burn rate (5-hour): {signed(r5, '% per hour')}</Text>
          <Text>Runway: {runway}</Text>
          <Text>Context growth: {signed(rate(list, 'ctx', 30 * 60_000), '% per hour')}</Text>
          <Text>
            Session cost: {last.usd === undefined ? '–' : `$${last.usd.toFixed(2)}`}
            {spent !== undefined && hours > 0.1 ? ` (+$${spent.toFixed(2)} while watching, $${(spent / hours).toFixed(2)}/h)` : ''}
          </Text>
          <Text dimColor>
            Readings: {list.length} over {last.t - first.t < 60_000 ? 'under a minute' : ago(last.t - first.t).replace(' ago', '')}
          </Text>
        </Box>
      </Box>
    )
  })
}
