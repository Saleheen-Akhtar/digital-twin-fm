module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(ts|tsx)$',
  // The package tsconfig uses jsx: "preserve" for Next/SWC, but ts-jest
  // needs an actual transform. Override just for Jest.
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      { tsconfig: { jsx: 'react-jsx', esModuleInterop: true } },
    ],
  },
  moduleNameMapper: {
    // CSS imports via @/ alias must be caught before the general @/ mapper,
    // otherwise Jest resolves them to actual file paths and tries to
    // execute CSS as JavaScript (SyntaxError on @keyframes etc.).
    '^@/(.+\\.css)$': '<rootDir>/__mocks__/styleMock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
