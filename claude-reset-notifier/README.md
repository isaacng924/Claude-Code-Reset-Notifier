# Claude Code Reset Notifier

Get a **10-minute warning** before your Claude Code 5-hour quota resets — and a nudge if you've barely used it.

## Features

- **⏰ Reset Warning** — VS Code notification fires 10 minutes before your quota resets
- **⚡ Use It or Lose It** — if you've sent fewer than 20 messages, a nudge encourages one more task
- **⏱️ Status Bar Countdown** — always-visible timer in the bottom-right of VS Code

## How It Works

Claude Code stores conversation history at `~/.claude/projects/**/*.jsonl`. Each line contains a `timestamp` field. This extension reads those files to find the oldest message in your current 5-hour window, then schedules a notification at exactly the right moment.

No external services. No API calls. Just file reads and timers.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `claudeReset.warningMinutes` | `10` | Minutes before reset to fire the notification |
| `claudeReset.lowUsageThreshold` | `20` | Message count below which the nudge appears |
| `claudeReset.enabled` | `true` | Toggle all notifications on/off |

## Why Not Use Claude Code Hooks?

The `Notification` hook only intercepts events Claude Code already generates — it has no time-based scheduling. `Stop` fires per-response but misses idle sessions. `permission_prompt` and `idle_prompt` hooks are confirmed broken in the VS Code extension (issues #11156, #16114, #20169). Background timers are the correct approach.
