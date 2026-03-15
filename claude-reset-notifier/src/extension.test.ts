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
