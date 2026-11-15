export type Sample = {
  t: number
  five?: number
  week?: number
  ctx?: number
  usd?: number
  fiveReset?: string
  weekReset?: string
  /** Fable's own weekly window, 0 to 100, read from the usage endpoint. */
  fable?: number
  fableReset?: string
  /** Why there is no Fable reading, when there is none. */
  fableNote?: string
  ctxWindow?: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': { samples: Shaped<Sample[]> }
  }
}
