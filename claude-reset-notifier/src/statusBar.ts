// src/statusBar.ts
import * as vscode from 'vscode';
import { getWindowInfo, formatCountdown } from './resetTracker';
import { getConfig } from './config';

export class StatusBarManager {
  private item: vscode.StatusBarItem;
  private intervalId: NodeJS.Timeout | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.tooltip = 'Claude Code quota reset countdown';
    this.item.show();
    context.subscriptions.push(this.item);
  }

  start(context: vscode.ExtensionContext) {
    this.update();
    this.intervalId = setInterval(() => this.update(), 60_000);
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('claudeReset')) {
          this.update();
        }
      })
    );
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.item.dispose();
  }

  update() {
    const info = getWindowInfo();
    if (!info) {
      this.item.text = '✅ Claude ready';
      return;
    }

    const { resetTimeOffsetMinutes } = getConfig();
    const offsetMs = resetTimeOffsetMinutes * 60_000;
    const msRemaining = info.resetTime.getTime() + offsetMs - Date.now();
    if (msRemaining <= 0) {
      this.item.text = '✅ Claude reset';
      return;
    }

    this.item.text = `⏱️ Claude resets in ${formatCountdown(msRemaining)}`;
  }
}
