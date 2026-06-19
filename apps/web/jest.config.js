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
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};
