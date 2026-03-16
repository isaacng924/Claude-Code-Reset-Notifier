// src/config.ts
import * as vscode from 'vscode';

export function getConfig() {
  const cfg = vscode.workspace.getConfiguration('claudeReset');
  return {
    warningMinutes: cfg.get<number>('warningMinutes', 10),
    lowUsageThreshold: cfg.get<number>('lowUsageThreshold', 20),
    enabled: cfg.get<boolean>('enabled', true),
    tokenLimit: cfg.get<number>('tokenLimit', 0),
    tokenNudgeThreshold: cfg.get<number>('tokenNudgeThreshold', 0),
    resetTimeOffsetMinutes: cfg.get<number>('resetTimeOffsetMinutes', 0),
  };
}
