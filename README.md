# Claude Code Reset Notifier

Get a **10-minute warning** before your Claude Code 5-hour quota resets — visible even when VS Code is minimised.

## Features

- **⏰ Reset Warning** — notification fires before your quota resets, both inside VS Code and as a macOS system alert
- **⚡ Use It or Lose It** — shows real token usage so you know how much quota you have left
- **⏱️ Status Bar Countdown** — always-visible timer in the bottom-right of VS Code

## How It Works

Claude Code stores conversation history at `~/.claude/projects/**/*.jsonl`. Each assistant entry contains a `usage` field with token counts. This extension reads those files to:

1. Find the oldest message in your current 5-hour window → calculates exact reset time
2. Sum `input + output + cache_creation` tokens → shows real usage in the nudge
3. Schedule a notification at exactly the right moment

No external services. No API calls. Just file reads and timers.

## Notification Examples

Without token limit configured:
> ⏰ Your Claude Code quota resets in 10 minutes.
> ⚡ You've used ~127.4k tokens this window. Good time to start one more task.

With token limit configured:
> ⏰ Your Claude Code quota resets in 10 minutes.
> ⚡ You've used ~127.4k / 500.0k tokens (25%). Good time to start one more task.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `claudeReset.warningMinutes` | `10` | Minutes before reset to fire the notification |
| `claudeReset.enabled` | `true` | Toggle all notifications on/off |
| `claudeReset.tokenLimit` | `0` | Your plan's token limit per 5-hour window (0 = show count only). See plan limits below |
| `claudeReset.tokenNudgeThreshold` | `0` | Only show the nudge if token usage is below this value (0 = always show) |
| `claudeReset.lowUsageThreshold` | `20` | Message count fallback nudge threshold (used only when no token data is available) |
| `claudeReset.resetTimeOffsetMinutes` | `0` | Shift the reset time by N minutes (positive = later, negative = earlier). Use this when your window was started by a non-Claude Code Claude product (see below) |

### Plan Token Limits

Set `claudeReset.tokenLimit` to your plan's approximate limit:

| Plan | Recommended `tokenLimit` |
|------|--------------------------|
| Claude Max 5x | `500000` |
| Claude Max 1x | `100000` |
| Pro | `45000` |

## Reset Time Offset

The extension calculates your reset time by finding the **oldest message in `~/.claude/projects/`** within the last 5 hours. This only covers Claude Code conversations — usage from **claude.ai web, Claude mobile, or other Claude products** is not logged there.

If you started your usage window from another Claude product, the extension will find an older Claude Code message and show a reset time that's **too early**. Use `resetTimeOffsetMinutes` to compensate:

```json
// If the countdown is consistently 30 minutes too early:
"claudeReset.resetTimeOffsetMinutes": 30
```

The offset updates the status bar and warning notification immediately when you change the setting.

## macOS System Notifications

Notifications fire as macOS Notification Center alerts — visible even when VS Code is in the background or minimised.

**If notifications don't appear outside VS Code:**
Go to **System Settings → Notifications → Visual Studio Code** and enable "Allow Notifications".

## Why Not Use Claude Code Hooks?

The `Notification` hook only intercepts events Claude Code already generates — it has no time-based scheduling. `Stop` fires per-response but misses idle sessions. `permission_prompt` and `idle_prompt` hooks are confirmed broken in the VS Code extension (issues #11156, #16114, #20169). Background timers are the correct approach.
