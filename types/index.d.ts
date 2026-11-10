export type Sample = {
  t: number
  five?: number
  week?: number
  ctx?: number
  usd?: number
  fiveReset?: string
  weekReset?: string
  ctxWindow?: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': { samples: Shaped<Sample[]> }
  }
}
