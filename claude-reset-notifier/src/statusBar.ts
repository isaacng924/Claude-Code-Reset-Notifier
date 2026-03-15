// src/statusBar.ts
import * as vscode from 'vscode';
import { getWindowInfo, formatCountdown } from './resetTracker';

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

  start() {
    this.update();
    this.intervalId = setInterval(() => this.update(), 60_000);
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

    const msRemaining = info.resetTime.getTime() - Date.now();
    if (msRemaining <= 0) {
      this.item.text = '✅ Claude reset';
      return;
    }

    this.item.text = `⏱️ Claude resets in ${formatCountdown(msRemaining)}`;
  }
}
