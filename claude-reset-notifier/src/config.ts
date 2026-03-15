// src/config.ts
import * as vscode from 'vscode';

export function getConfig() {
  const cfg = vscode.workspace.getConfiguration('claudeReset');
  return {
    warningMinutes: cfg.get<number>('warningMinutes', 10),
    lowUsageThreshold: cfg.get<number>('lowUsageThreshold', 20),
    enabled: cfg.get<boolean>('enabled', true),
  };
}
