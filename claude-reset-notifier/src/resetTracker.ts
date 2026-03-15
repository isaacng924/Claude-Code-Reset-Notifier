// src/resetTracker.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface WindowInfo {
  resetTime: Date;
  messageCount: number;
  tokenCount: number;
}

/** Walk all .jsonl files under a directory recursively */
function* walkJsonl(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkJsonl(full);
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      yield full;
    }
  }
}

/**
 * Reads ~/.claude/projects/**\/*.jsonl, finds the oldest message timestamp
 * within the last 5 hours, and returns the reset time + message count.
 * Returns null if no active window found.
 */
export function getWindowInfo(): WindowInfo | null {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  const now = Date.now();
  const fiveHoursMs = 5 * 60 * 60 * 1000;
  const windowStart = now - fiveHoursMs;

  let oldestInWindow: number | null = null;
  let messageCount = 0;
  let tokenCount = 0;

  for (const file of walkJsonl(claudeDir)) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed);
        if (!entry.timestamp) continue;
        const ts = new Date(entry.timestamp).getTime();
        if (isNaN(ts)) continue;

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
      } catch {
        // malformed line — skip
      }
    }
  }

  if (oldestInWindow === null) return null;

  return {
    resetTime: new Date(oldestInWindow + fiveHoursMs),
    messageCount,
    tokenCount,
  };
}

/** Format milliseconds into a human-readable countdown string */
export function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.floor(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}
