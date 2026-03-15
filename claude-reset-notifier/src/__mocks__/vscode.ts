export const window = {
  createStatusBarItem: jest.fn(() => ({
    show: jest.fn(),
    dispose: jest.fn(),
    text: '',
    tooltip: '',
  })),
  showInformationMessage: jest.fn(),
};
export const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn((key: string, def: any) => def),
  })),
  onDidChangeConfiguration: jest.fn(),
};
export const StatusBarAlignment = { Left: 1, Right: 2 };
