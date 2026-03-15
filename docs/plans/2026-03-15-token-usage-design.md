# Token Usage in Notifications — Design

**Date:** 2026-03-15

## Problem

The current nudge notification uses message count as a proxy for quota usage. Token counts are actually stored in the JSONL files (in `message.usage` on every `type: "assistant"` entry) and are a much more accurate signal.

## Approach

Option B: token count always shown, percentage shown if user configures their plan limit.

## Data Source

Each `type: "assistant"` JSONL entry has:
```json
"usage": {
  "input_tokens": 2,
  "cache_creation_input_tokens": 23337,
  "cache_read_input_tokens": 0,
  "output_tokens": 1
}
```
Sum `input_tokens + output_tokens + cache_creation_input_tokens` across all assistant entries within the 5-hour window.

## Changes

| File | Change |
|------|--------|
| `src/resetTracker.ts` | Add `tokenCount` to `WindowInfo`; sum tokens from assistant entries |
| `src/config.ts` | Add `tokenLimit: number` (default `0` = not configured) |
| `package.json` | Add `claudeReset.tokenLimit` setting with plan guidance in description |
| `src/extension.ts` | Update `fireNotification` to show token line; add percentage if `tokenLimit > 0` |
| `src/resetTracker.test.ts` | Add fixtures with `usage` data; assert `tokenCount` |

## Notification Output

Without `tokenLimit`:
> ⚡ You've used ~127,432 tokens this window. Good time to start one more task.

With `tokenLimit: 500000`:
> ⚡ You've used ~127,432 / 500,000 tokens (25%). Good time to start one more task.

The message-count nudge (`lowUsageThreshold`) is kept as a fallback for sessions with no token data.

## Plan Limits Reference (for README/description)

| Plan | Recommended tokenLimit |
|------|----------------------|
| Claude Max 5x | 500000 |
| Claude Max 1x | 100000 |
| Pro | 45000 |
