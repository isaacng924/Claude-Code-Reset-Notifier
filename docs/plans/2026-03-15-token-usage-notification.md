# Token Usage Notification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show real token usage (summed from JSONL `message.usage` fields) in the nudge notification, with an optional percentage when the user sets their plan limit.

**Architecture:** Add `tokenCount` to `WindowInfo` by summing `input_tokens + output_tokens + cache_creation_input_tokens` from `type: "assistant"` JSONL entries within the window. Add a `tokenLimit` config setting (default `0` = not set). Update `fireNotification` to always show a token line; show percentage only when `tokenLimit > 0`. Keep message-count fallback nudge for sessions with no token data.

**Tech Stack:** TypeScript, Node `fs`, Jest + ts-jest (existing test setup).

---

### Task 1: Add failing tests for token counting

**Files:**
- Modify: `claude-reset-notifier/src/resetTracker.test.ts`

The existing `writeJsonl` helper only writes `{ timestamp, role }` entries. We need a new helper that writes realistic assistant entries with `usage` data, plus new test cases.

**Step 1: Add the new tests** — append these to the bottom of the existing `describe('getWindowInfo', ...)` block (before the closing `}`):

```typescript
  it('sums tokens from assistant entries in the window', () => {
    const real = os.homedir;
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'fakehome-'));
    const claudeProjects = path.join(fakeHome, '.claude', 'projects', 'proj');
    fs.mkdirSync(claudeProjects, { recursive: true });

    const now = Date.now();
    const ts = now - 1 * 3600_000;

    const content = [
      // user message — no usage
      JSON.stringify({ type: 'user', timestamp: new Date(ts).toISOString() }),
      // assistant message with usage
      JSON.stringify({
        type: 'assistant',
        timestamp: new Date(ts + 1000).toISOString(),
        message: {
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation_input_tokens: 200,
            cache_read_input_tokens: 999, // should NOT be counted
          },
        },
      }),
    ].join('\n');
    fs.writeFileSync(path.join(claudeProjects, 'session.jsonl'), content);

    (os as any).homedir = () => fakeHome;
    try {
      const info = getWindowInfo();
      expect(info).not.toBeNull();
      // 100 + 50 + 200 = 350 (cache_read excluded)
      expect(info!.tokenCount).toBe(350);
    } finally {
      (os as any).homedir = real;
      fs.rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  it('returns tokenCount 0 when no assistant entries have usage', () => {
    const real = os.homedir;
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'fakehome-'));
    const claudeProjects = path.join(fakeHome, '.claude', 'projects', 'proj');
    fs.mkdirSync(claudeProjects, { recursive: true });

    const now = Date.now();
    const ts = now - 1 * 3600_000;

    const content = JSON.stringify({ type: 'user', timestamp: new Date(ts).toISOString() });
    fs.writeFileSync(path.join(claudeProjects, 'session.jsonl'), content);

    (os as any).homedir = () => fakeHome;
    try {
      const info = getWindowInfo();
      expect(info).not.toBeNull();
      expect(info!.tokenCount).toBe(0);
    } finally {
      (os as any).homedir = real;
      fs.rmSync(fakeHome, { recursive: true, force: true });
    }
  });
```

**Step 2: Run tests — expect failure**

```bash
cd /Users/isaac/Documents/GitHub/Claude-Code-Reset-Notifier/claude-reset-notifier
npm run test:unit 2>&1 | tail -15
```

Expected: `Property 'tokenCount' does not exist on type 'WindowInfo'` or similar.

**Step 3: Commit the failing tests**

```bash
git add src/resetTracker.test.ts
git commit -m "test: add token count tests for getWindowInfo (red)"
```

---

### Task 2: Implement token counting in `resetTracker.ts`

**Files:**
- Modify: `claude-reset-notifier/src/resetTracker.ts`

**Step 1: Add `tokenCount` to the `WindowInfo` interface** (line 6-9):

```typescript
export interface WindowInfo {
  resetTime: Date;
  messageCount: number;
  tokenCount: number;
}
```

**Step 2: Add `tokenCount` accumulator and token-summing logic** inside `getWindowInfo`.

Replace the current variable declarations block (lines 35-36):
```typescript
  let oldestInWindow: number | null = null;
  let messageCount = 0;
```
With:
```typescript
  let oldestInWindow: number | null = null;
  let messageCount = 0;
  let tokenCount = 0;
```

Inside the inner `try` block, after the existing `if (ts > windowStart && ts <= now)` block, add token summing. Replace the existing block (lines 55-60):

```typescript
        if (ts > windowStart && ts <= now) {
          messageCount++;
          if (oldestInWindow === null || ts < oldestInWindow) {
            oldestInWindow = ts;
          }
          // Sum tokens from assistant entries (cache_read excluded — not quota-bearing)
          if (entry.type === 'assistant' && entry.message?.usage) {
            const u = entry.message.usage;
            tokenCount +=
              (u.input_tokens ?? 0) +
              (u.output_tokens ?? 0) +
              (u.cache_creation_input_tokens ?? 0);
          }
        }
```

**Step 3: Add `tokenCount` to the return value** (lines 69-72):

```typescript
  return {
    resetTime: new Date(oldestInWindow + fiveHoursMs),
    messageCount,
    tokenCount,
  };
```

**Step 4: Run tests — all 9 must pass**

```bash
npm run test:unit
```

Expected:
```
Tests: 9 passed, 9 total
```

**Step 5: Commit**

```bash
git add src/resetTracker.ts
git commit -m "feat: add tokenCount to WindowInfo — sum from assistant usage entries"
```

---

### Task 3: Add `tokenLimit` to config and `package.json`

**Files:**
- Modify: `claude-reset-notifier/src/config.ts`
- Modify: `claude-reset-notifier/package.json`

**Step 1: Update `src/config.ts`** — add `tokenLimit`:

```typescript
// src/config.ts
import * as vscode from 'vscode';

export function getConfig() {
  const cfg = vscode.workspace.getConfiguration('claudeReset');
  return {
    warningMinutes: cfg.get<number>('warningMinutes', 10),
    lowUsageThreshold: cfg.get<number>('lowUsageThreshold', 20),
    enabled: cfg.get<boolean>('enabled', true),
    tokenLimit: cfg.get<number>('tokenLimit', 0),
  };
}
```

**Step 2: Add `claudeReset.tokenLimit` to `package.json`** — inside `contributes.configuration.properties`, add after the `claudeReset.enabled` entry:

```json
"claudeReset.tokenLimit": {
  "type": "number",
  "default": 0,
  "description": "Your plan's token limit per 5-hour window (0 = show count only, no percentage). Suggested values: Claude Max 5x → 500000, Claude Max 1x → 100000, Pro → 45000"
}
```

**Step 3: Compile — must exit 0**

```bash
npm run compile 2>&1 | grep -E "error|warning" | grep -v "test" | head -10
echo "Exit: $?"
```

**Step 4: Commit**

```bash
git add src/config.ts package.json
git commit -m "feat: add tokenLimit config setting"
```

---

### Task 4: Update `fireNotification` in `extension.ts`

**Files:**
- Modify: `claude-reset-notifier/src/extension.ts`

**Step 1: Update the `fireNotification` signature and body**

Replace the entire `fireNotification` function (lines 68-84) and its two call sites with:

```typescript
function fireNotification(
  messageCount: number,
  tokenCount: number,
  threshold: number,
  tokenLimit: number,
  warningMinutes: number
) {
  const lines: string[] = [
    `⏰ Your Claude Code quota resets in ${warningMinutes} minutes.`,
  ];

  if (tokenCount > 0) {
    if (tokenLimit > 0) {
      const pct = Math.round((tokenCount / tokenLimit) * 100);
      const used = formatTokens(tokenCount);
      const limit = formatTokens(tokenLimit);
      lines.push(`⚡ You've used ~${used} / ${limit} tokens (${pct}%). Good time to start one more task.`);
    } else {
      lines.push(`⚡ You've used ~${formatTokens(tokenCount)} tokens this window. Good time to start one more task.`);
    }
  } else if (messageCount < threshold) {
    lines.push(
      `⚡ You've only used ~${messageCount} messages this window. Good time to start one more task before it resets.`
    );
  }

  vscode.window.showInformationMessage(lines.join('\n'));
}

/** Format a token count as a compact string: 127432 → "127.4k", 1200000 → "1.2M" */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
```

**Step 2: Update the two `fireNotification` call sites** in `scheduleWarning`:

First call site (immediate fire path, around line 52):
```typescript
      fireNotification(info.messageCount, info.tokenCount, lowUsageThreshold, tokenLimit, warningMinutes);
```

Second call site (setTimeout callback, around line 63):
```typescript
    const count = currentInfo?.messageCount ?? info.messageCount;
    const tokens = currentInfo?.tokenCount ?? info.tokenCount;
    fireNotification(count, tokens, lowUsageThreshold, tokenLimit, warningMinutes);
```

**Step 3: Update `scheduleWarning` destructuring** to include `tokenLimit` (line 33):
```typescript
  const { enabled, warningMinutes, lowUsageThreshold, tokenLimit } = getConfig();
```

**Step 4: Compile — must exit 0**

```bash
npm run compile 2>&1 | grep "src/extension" | head -10
echo "Exit: $?"
```

**Step 5: Run unit tests — still 9 green**

```bash
npm run test:unit
```

**Step 6: Commit**

```bash
git add src/extension.ts
git commit -m "feat: show token usage in nudge notification with optional percentage"
```

---

### Task 5: Manual smoke test

**No files changed — verification only.**

**Step 1: Press F5** in the `claude-reset-notifier/` VS Code window to relaunch the Extension Development Host.

**Step 2: Set settings in the dev host:**
```json
"claudeReset.warningMinutes": 400
```

**Step 3: Verify the notification shows a token line:**
> ⏰ Your Claude Code quota resets in 400 minutes.
> ⚡ You've used ~127.4k tokens this window. Good time to start one more task.

**Step 4: Now add the token limit:**
```json
"claudeReset.tokenLimit": 500000
```
Reload window (`Cmd+Shift+P` → "Developer: Reload Window").

**Step 5: Verify percentage appears:**
> ⚡ You've used ~127.4k / 500.0k tokens (25%). Good time to start one more task.

**Step 6: Reset settings when done:**
```json
"claudeReset.warningMinutes": 10
```
Remove `tokenLimit` (or leave it set to your plan limit).

---

### Task 6: Repackage

**Step 1: Bump the version in `package.json`** from `0.1.0` to `0.2.0`.

**Step 2: Package**

```bash
cd /Users/isaac/Documents/GitHub/Claude-Code-Reset-Notifier/claude-reset-notifier
vsce package --allow-missing-repository
```

Expected: `claude-reset-notifier-0.2.0.vsix`

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 0.2.0"
```
