// src/resetTracker.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getWindowInfo, formatCountdown } from './resetTracker';

// ─── formatCountdown ──────────────────────────────────────────────────────────

describe('formatCountdown', () => {
  it('returns hours and minutes when >= 1 hour', () => {
    expect(formatCountdown(2 * 3600_000 + 15 * 60_000)).toBe('2h 15m');
  });

  it('returns minutes only when < 1 hour', () => {
    expect(formatCountdown(45 * 60_000)).toBe('45m');
  });

  it('returns <1m when < 1 minute', () => {
    expect(formatCountdown(30_000)).toBe('<1m');
  });
});

// ─── getWindowInfo ────────────────────────────────────────────────────────────

describe('getWindowInfo', () => {
  let tmpDir: string;
  let projectDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-test-'));
    projectDir = path.join(tmpDir, 'test-project');
    fs.mkdirSync(projectDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeJsonl(file: string, timestamps: number[]) {
    const lines = timestamps.map(ts =>
      JSON.stringify({ timestamp: new Date(ts).toISOString(), role: 'user' })
    );
    fs.writeFileSync(file, lines.join('\n') + '\n');
  }

  it('returns null when no JSONL files exist', () => {
    const real = os.homedir;
    (os as any).homedir = () => '/nonexistent-path-xyz';
    try {
      expect(getWindowInfo()).toBeNull();
    } finally {
      (os as any).homedir = real;
    }
  });

  it('returns null when all messages are older than 5 hours', () => {
    const real = os.homedir;
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'fakehome-'));
    const claudeProjects = path.join(fakeHome, '.claude', 'projects', 'proj');
    fs.mkdirSync(claudeProjects, { recursive: true });
    const old = Date.now() - 6 * 3600_000;
    const content = [
      JSON.stringify({ timestamp: new Date(old).toISOString() }),
      JSON.stringify({ timestamp: new Date(old + 60_000).toISOString() }),
    ].join('\n');
    fs.writeFileSync(path.join(claudeProjects, 'session.jsonl'), content);

    (os as any).homedir = () => fakeHome;
    try {
      expect(getWindowInfo()).toBeNull();
    } finally {
      (os as any).homedir = real;
      fs.rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  it('returns resetTime = oldest + 5h and correct message count', () => {
    const real = os.homedir;
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'fakehome-'));
    const claudeProjects = path.join(fakeHome, '.claude', 'projects', 'proj');
    fs.mkdirSync(claudeProjects, { recursive: true });

    const now = Date.now();
    const oldest = now - 2 * 3600_000;
    const newer  = now - 1 * 3600_000;

    const content = [
      JSON.stringify({ timestamp: new Date(oldest).toISOString() }),
      JSON.stringify({ timestamp: new Date(newer).toISOString() }),
    ].join('\n');
    fs.writeFileSync(path.join(claudeProjects, 'session.jsonl'), content);

    (os as any).homedir = () => fakeHome;
    try {
      const info = getWindowInfo();
      expect(info).not.toBeNull();
      expect(info!.messageCount).toBe(2);
      expect(info!.resetTime.getTime()).toBeCloseTo(oldest + 5 * 3600_000, -2);
    } finally {
      (os as any).homedir = real;
      fs.rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  it('skips malformed lines without throwing', () => {
    const real = os.homedir;
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'fakehome-'));
    const claudeProjects = path.join(fakeHome, '.claude', 'projects', 'proj');
    fs.mkdirSync(claudeProjects, { recursive: true });

    const now = Date.now();
    const valid = now - 1 * 3600_000;
    const content = [
      'not-json-at-all',
      JSON.stringify({ noTimestamp: true }),
      JSON.stringify({ timestamp: 'bad-date' }),
      JSON.stringify({ timestamp: new Date(valid).toISOString() }),
    ].join('\n');
    fs.writeFileSync(path.join(claudeProjects, 'session.jsonl'), content);

    (os as any).homedir = () => fakeHome;
    try {
      const info = getWindowInfo();
      expect(info).not.toBeNull();
      expect(info!.messageCount).toBe(1);
    } finally {
      (os as any).homedir = real;
      fs.rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});
