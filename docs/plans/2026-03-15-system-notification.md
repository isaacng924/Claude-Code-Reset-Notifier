# macOS System Notification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fire a macOS Notification Center alert (visible outside VS Code) alongside the existing in-app notification when the quota warning triggers.

**Architecture:** Add `fireSystemNotification(title, body)` to `extension.ts` using `child_process.execFile('/usr/bin/osascript', ['-e', script])`. Call it from `fireNotification` alongside the existing `vscode.window.showInformationMessage`. Errors are swallowed silently so the in-app notification always fires as a fallback.

**Tech Stack:** Node.js built-in `child_process.execFile`, `/usr/bin/osascript` (macOS built-in), Jest for unit tests.

---

### Task 1: Add failing test for `fireSystemNotification`

**Files:**
- Create: `claude-reset-notifier/src/extension.test.ts`

`fireSystemNotification` is private inside `extension.ts`. To test it without exporting it, we'll export it as a named export and verify `execFile` is called with the right AppleScript when `fireNotification` runs.

**Step 1: Create the test file**

```typescript
// src/extension.test.ts
import { execFile } from 'child_process';
import { fireSystemNotification } from './extension';

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

const mockExecFile = execFile as jest.MockedFunction<typeof execFile>;

describe('fireSystemNotification', () => {
  beforeEach(() => {
    mockExecFile.mockClear();
  });

  it('calls osascript with the correct display notification script', () => {
    fireSystemNotification('Claude Reset Notifier', 'Quota resets in 10 minutes.');

    expect(mockExecFile).toHaveBeenCalledTimes(1);
    const [bin, args] = mockExecFile.mock.calls[0];
    expect(bin).toBe('/usr/bin/osascript');
    expect(args![0]).toBe('-e');
    expect(args![1]).toContain('display notification');
    expect(args![1]).toContain('Quota resets in 10 minutes.');
    expect(args![1]).toContain('Claude Reset Notifier');
  });

  it('does not throw if osascript fails', () => {
    mockExecFile.mockImplementationOnce((_bin, _args, cb: any) => {
      cb(new Error('osascript not found'), '', '');
      return {} as any;
    });

    expect(() =>
      fireSystemNotification('Claude Reset Notifier', 'Test message.')
    ).not.toThrow();
  });
});
```

**Step 2: Run — expect failure (export doesn't exist yet)**

```bash
cd /Users/isaac/Documents/GitHub/Claude-Code-Reset-Notifier/claude-reset-notifier
npm run test:unit 2>&1 | tail -10
```

Expected: `export 'fireSystemNotification' was not found in './extension'`

**Step 3: Commit the failing test**

```bash
git add src/extension.test.ts
git commit -m "test: add fireSystemNotification unit tests (red)"
```

---

### Task 2: Implement `fireSystemNotification` in `extension.ts`

**Files:**
- Modify: `claude-reset-notifier/src/extension.ts`

**Step 1: Add the `child_process` import** at the top of the file (after the existing imports):

```typescript
import { execFile } from 'child_process';
```

**Step 2: Add the exported helper** — insert after the `deactivate` function at the bottom of the file:

```typescript
/** Fires a macOS Notification Center alert visible outside VS Code. */
export function fireSystemNotification(title: string, body: string): void {
  const script = `display notification "${body}" with title "${title}"`;
  execFile('/usr/bin/osascript', ['-e', script], (err) => {
    if (err) {
      console.error('Claude Reset Notifier: osascript failed:', err.message);
    }
  });
}
```

**Step 3: Call it from `fireNotification`** — add one line at the end of `fireNotification`, just before the closing `}`:

```typescript
  fireSystemNotification('Claude Reset Notifier', lines.join(' '));
```

The full updated `fireNotification` should look like:

```typescript
function fireNotification(
  messageCount: number,
  threshold: number,
  warningMinutes: number
) {
  const lines: string[] = [
    `⏰ Your Claude Code quota resets in ${warningMinutes} minutes.`,
  ];

  if (messageCount < threshold) {
    lines.push(
      `⚡ You've only used ~${messageCount} messages this window. Good time to start one more task before it resets.`
    );
  }

  vscode.window.showInformationMessage(lines.join('\n'));
  fireSystemNotification('Claude Reset Notifier', lines.join(' '));
}
```

**Step 4: Run all tests — must be 9 passing**

```bash
npm run test:unit
```

Expected:
```
Test Suites: 2 passed, 2 total
Tests:       9 passed, 9 total
```

Wait — the new extension.test.ts adds 2 more tests. Total should be **11 passing**.

Expected:
```
Test Suites: 2 passed, 2 total
Tests:       11 passed, 11 total
```

**Step 5: Compile — must exit 0**

```bash
npm run compile 2>&1 | grep "error" | grep -v "test" | head -5
```

Expected: no output (no errors).

**Step 6: Commit**

```bash
git add src/extension.ts
git commit -m "feat: fire macOS system notification via osascript"
```

---

### Task 3: Manual smoke test

**No files changed — verification only.**

**Step 1: Allow notifications for VS Code in macOS**

Go to System Settings → Notifications → Code (or "Code - OSS") → ensure "Allow Notifications" is on.

**Step 2: Press F5** in the `claude-reset-notifier/` VS Code window to relaunch the Extension Development Host.

**Step 3: Minimise or switch away from VS Code** — go to another app (Finder, Safari, anything).

**Step 4: Trigger the notification** — in the Extension Development Host settings add:
```json
"claudeReset.warningMinutes": 400
```

**Step 5: Verify** — you should see a macOS Notification Center banner appear **over whatever app you're in**, not just inside VS Code:

> **Claude Reset Notifier**
> ⏰ Your Claude Code quota resets in 400 minutes. ⚡ You've only used ~X messages...

**Step 6: Reset**
```json
"claudeReset.warningMinutes": 10
```

---

### Task 4: Repackage

**Files:**
- Modify: `claude-reset-notifier/package.json` — bump `version` from `0.1.0` to `0.2.0`

**Step 1: Bump version in `package.json`**

Change line:
```json
"version": "0.1.0",
```
To:
```json
"version": "0.2.0",
```

**Step 2: Package**

```bash
cd /Users/isaac/Documents/GitHub/Claude-Code-Reset-Notifier/claude-reset-notifier
vsce package --allow-missing-repository 2>&1 | tail -5
```

Expected: `claude-reset-notifier-0.2.0.vsix`

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 0.2.0 — system notifications"
```
