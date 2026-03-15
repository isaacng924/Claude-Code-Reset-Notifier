# macOS System Notification — Design

**Date:** 2026-03-15

## Problem

The current VS Code notification only appears when VS Code is focused. If the user is in another app, they miss it.

## Approach

Use `child_process.execFile` to call the built-in `/usr/bin/osascript` binary with an AppleScript `display notification` command. This fires a macOS Notification Center alert that appears regardless of whether VS Code is in the foreground.

## Implementation

Add a `fireSystemNotification(title: string, body: string)` helper in `extension.ts`:

```typescript
import { execFile } from 'child_process';

function fireSystemNotification(title: string, body: string) {
  const script = `display notification "${body}" with title "${title}"`;
  execFile('/usr/bin/osascript', ['-e', script], (err) => {
    if (err) console.error('Claude Reset Notifier: osascript failed', err.message);
  });
}
```

Call it inside `fireNotification` alongside the existing `vscode.window.showInformationMessage`.

## Error handling

If `execFile` fails (e.g. on non-macOS, or if osascript is blocked by permissions), the error is logged to the console and swallowed. The VS Code in-app notification still fires as a fallback.

## Scope

- No new settings
- No new dependencies
- No changes to `resetTracker.ts`, `statusBar.ts`, or `config.ts`
- Only `extension.ts` is modified

## Out of scope (future)

- Option B: event file hook for external tools
- Windows / Linux support (will use `node-notifier` when needed)
- Custom notification sound or app icon
