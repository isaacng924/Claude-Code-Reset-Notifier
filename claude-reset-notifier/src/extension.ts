// src/extension.ts
import * as vscode from 'vscode';
import { getWindowInfo } from './resetTracker';
import { StatusBarManager } from './statusBar';
import { getConfig } from './config';
import { execFile } from 'child_process';

let statusBar: StatusBarManager | undefined;
let warningTimeout: NodeJS.Timeout | undefined;
let recalcInterval: NodeJS.Timeout | undefined;
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN_MS = 60_000; // suppress duplicates within 1 minute

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Reset Notifier activated');

  statusBar = new StatusBarManager(context);
  statusBar.start(context);

  scheduleWarning();

  // Recalculate every 5 minutes in case new messages were sent
  recalcInterval = setInterval(scheduleWarning, 5 * 60_000);
  context.subscriptions.push({ dispose: () => { if (recalcInterval) clearInterval(recalcInterval); } });

  // Also recalculate if settings change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('claudeReset')) {
        scheduleWarning();
      }
    })
  );
}

function scheduleWarning() {
  const { enabled, warningMinutes, lowUsageThreshold, tokenLimit, tokenNudgeThreshold, resetTimeOffsetMinutes } = getConfig();

  if (warningTimeout) {
    clearTimeout(warningTimeout);
    warningTimeout = undefined;
  }

  if (!enabled) return;

  const info = getWindowInfo();
  if (!info) return;

  const now = Date.now();
  const offsetMs = resetTimeOffsetMinutes * 60_000;
  const adjustedResetTime = info.resetTime.getTime() + offsetMs;
  const warningMs = warningMinutes * 60_000;
  const msUntilWarning = adjustedResetTime - warningMs - now;

  if (msUntilWarning <= 0) {
    const msUntilReset = adjustedResetTime - now;
    if (msUntilReset > 0 && now - lastNotificationTime > NOTIFICATION_COOLDOWN_MS) {
      lastNotificationTime = now;
      fireNotification(info.messageCount, info.tokenCount, lowUsageThreshold, tokenLimit, tokenNudgeThreshold, warningMinutes);
    }
    return;
  }

  console.log(
    `Claude Reset Notifier: warning scheduled in ${Math.round(msUntilWarning / 60_000)} min`
  );

  warningTimeout = setTimeout(() => {
    const currentInfo = getWindowInfo();
    const count = currentInfo?.messageCount ?? info.messageCount;
    const tokens = currentInfo?.tokenCount ?? info.tokenCount;
    lastNotificationTime = Date.now();
    fireNotification(count, tokens, lowUsageThreshold, tokenLimit, tokenNudgeThreshold, warningMinutes);
  }, msUntilWarning);
}

function fireNotification(
  messageCount: number,
  tokenCount: number,
  threshold: number,
  tokenLimit: number,
  tokenNudgeThreshold: number,
  warningMinutes: number
) {
  const lines: string[] = [
    `⏰ Your Claude Code quota resets in ${warningMinutes} minutes.`,
  ];

  const showTokenNudge = tokenCount > 0 && (tokenNudgeThreshold === 0 || tokenCount < tokenNudgeThreshold);

  if (showTokenNudge) {
    if (tokenLimit > 0) {
      const pct = Math.round((tokenCount / tokenLimit) * 100);
      const used = formatTokens(tokenCount);
      const limit = formatTokens(tokenLimit);
      lines.push(`⚡ You've used ~${used} / ${limit} tokens (${pct}%). Good time to start one more task.`);
    } else {
      lines.push(`⚡ You've used ~${formatTokens(tokenCount)} tokens this window. Good time to start one more task.`);
    }
  } else if (tokenCount === 0 && messageCount < threshold) {
    lines.push(
      `⚡ You've only used ~${messageCount} messages this window. Good time to start one more task before it resets.`
    );
  }

  vscode.window.showInformationMessage(lines.join('\n'));
  fireSystemNotification('Claude Reset Notifier', lines.join(' '));
}

/** Format a token count compactly: 127432 → "127.4k", 1200000 → "1.2M" */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function deactivate() {
  if (warningTimeout) clearTimeout(warningTimeout);
  if (recalcInterval) clearInterval(recalcInterval);
  statusBar?.stop();
}

/** Fires a macOS Notification Center alert visible outside VS Code. */
export function fireSystemNotification(title: string, body: string): void {
  const safe = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const script = `display notification "${safe(body)}" with title "${safe(title)}"`;
  execFile('/usr/bin/osascript', ['-e', script], (err) => {
    if (err) {
      console.error('Claude Reset Notifier: osascript failed:', err.message);
    }
  });
}
