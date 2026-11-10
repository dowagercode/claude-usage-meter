# claude-usage-meter

Plugin name: `usage-meter`.

A live usage panel for Claude Code. It sits beside the chat, refreshes every minute, and shows how much of your plan you've used, with a moving graph and a few extra stats. It works in the terminal and in the desktop app.

```
Updates every minute · last reading 1 min ago

● 5-hour   ███░░░░░░░░░░░░░ 21.6%
   resets in 3h 31m
● Weekly   ░░░░░░░░░░░░░░░░ 2%
   resets in 4d 11h
● Context  ██░░░░░░░░░░░░░░ 10.8%
   this session, ~108k tokens

 30% ┤                                        ⢀⣀⣀⣀⣀⡤⠤⠤⠤⠖⠒⠒⠒
     ┤                       ⣀⣀⣀⣀⣠⠤⠤⠤⠴⠒⠒⠒⠒⠋⠉⠉⠉⠉
     ┤     ⢀⣀⣀⣀⣠⠤⠤⠤⠤⠖⠒⠒⠒⠚⠉⠉⠉⠉⠁
     ┤⠒⠋⠉⠉⠉⠉              ⢀⣀⣀⣀⣀⣀⣀⣀⣀⣠⠤⠤⠤⠤⠤⠤⠤⠤⠖⠒⠒⠒⠒⠒⠒⠒⠒⠋⠉⠉⠉⠉⠉
  0% ┤⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀
     └-29m                                               now

Bonus stats
Burn rate (5-hour): +24.0% per hour
Runway: hits 100% in about 3h 16m at this pace
Context growth: +12.0% per hour
Session cost: $2.45 (+$1.45 while watching, $3.00/h)
```

## What it shows

- **5-hour and weekly limits**: how much of each you've used, and when each resets.
- **Context**: how full this session's context window is.
- **Graph**: all three over time, up to the last 5 hours. In the terminal it's drawn in braille characters; in the desktop app it's a line graph whose newest points pulse.
- **Bonus stats**: how fast the 5-hour limit is filling (over the last 30 minutes), when you'd hit 100% at that pace or whether it resets first, how fast the context is growing, and what the session has cost.

The panel reads the numbers Claude Code already has, on its own timer. It makes no model calls, so watching it doesn't use up your plan. The plan figures only change after Claude replies, so the lines stay flat while nothing is happening.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-meter --marketplace dowagercode/claude-usage-meter
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```
claude plugin install usage-meter --marketplace dowagercode/claude-usage-meter
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `dowagercode/claude-usage-meter`, then **Add plugin**.

The panel opens at the start of each session. If you close it, `/usage-meter` opens it again.

## Develop

```
claude --plugin-dir .          # run a session with this folder loaded
claude plugin validate .       # check the manifest and module
claude plugin test .           # run tests/pane.test.tsx
```

Plan limits show only when you're signed in with a Claude subscription. With an API key, the panel shows context and cost alone.

## License

MIT
