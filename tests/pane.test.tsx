import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'usage-meter',
  component: 'Pane',
  requestId: 'usage-meter',
  props: {
    title: 'Usage',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const T0 = Date.parse('2026-11-10T20:00:00Z')
const SAMPLES = Array.from({ length: 30 }, (_, i) => ({
  t: T0 + i * 60_000,
  five: 10 + i * 0.4,
  week: 2,
  ctx: 5 + i * 0.2,
  usd: 1 + i * 0.05,
  fiveReset: '2026-11-11T02:00:00Z',
  weekReset: '2026-11-15T08:00:00Z',
  ctxWindow: 1_000_000,
}))

function seed(on: any) {
  on('state.get', () => ({ value: { value: { shape: 'samples-1', value: SAMPLES }, version: 1 } }))
  on('clock.now', () => ({ value: T0 + 30 * 60_000 }))
}

test('the terminal draws a braille graph', async ($, on) => {
  seed(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const rows = await ui.findAll({ type: 'Text', text: /[⠁-⣿]/ })
  expect(rows.length > 0).toBe(true)
  expect((await ui.find({ type: 'Text', text: /5-hour/ }))?.text).toMatch(/21\.6%/)
  expect((await ui.find({ type: 'Text', text: /Burn rate/ }))?.text).toMatch(/\+24\.0% per hour/)
  await ui.unmount()
})

test('the desktop draws an SVG graph', async ($, on) => {
  seed(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg !== undefined).toBe(true)
  await ui.unmount()
})

test('with no readings it waits', async ($, on) => {
  on('state.get', () => ({ value: { value: undefined, version: 0 } }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('Waiting for the first reading…')
  await ui.unmount()
})
