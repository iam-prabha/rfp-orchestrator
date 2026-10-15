module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@repo/shared$': '<rootDir>/../shared/src/index.ts',
  },
};
