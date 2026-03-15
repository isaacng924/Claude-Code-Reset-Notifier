// src/extension.ts
import * as vscode from 'vscode';
import { getWindowInfo } from './resetTracker';
import { StatusBarManager } from './statusBar';
import { getConfig } from './config';

let statusBar: StatusBarManager | undefined;
let warningTimeout: NodeJS.Timeout | undefined;
let recalcInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Reset Notifier activated');

  statusBar = new StatusBarManager(context);
  statusBar.start();

  scheduleWarning();

  // Recalculate every 5 minutes in case new messages were sent
  recalcInterval = setInterval(scheduleWarning, 5 * 60_000);

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
  const { enabled, warningMinutes, lowUsageThreshold } = getConfig();

  if (warningTimeout) {
    clearTimeout(warningTimeout);
    warningTimeout = undefined;
  }

  if (!enabled) return;

  const info = getWindowInfo();
  if (!info) return;

  const now = Date.now();
  const warningMs = warningMinutes * 60_000;
  const msUntilWarning = info.resetTime.getTime() - warningMs - now;

  if (msUntilWarning <= 0) {
    const msUntilReset = info.resetTime.getTime() - now;
    if (msUntilReset > 0) {
      fireNotification(info.messageCount, lowUsageThreshold, warningMinutes);
    }
    return;
  }

  console.log(
    `Claude Reset Notifier: warning scheduled in ${Math.round(msUntilWarning / 60_000)} min`
  );

  warningTimeout = setTimeout(() => {
    const currentInfo = getWindowInfo();
    const count = currentInfo?.messageCount ?? info.messageCount;
    fireNotification(count, lowUsageThreshold, warningMinutes);
  }, msUntilWarning);
}

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
}

export function deactivate() {
  if (warningTimeout) clearTimeout(warningTimeout);
  if (recalcInterval) clearInterval(recalcInterval);
  statusBar?.stop();
}
