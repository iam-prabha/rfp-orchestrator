module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@repo/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@repo/retrieval$': '<rootDir>/../../packages/retrieval/src/index.ts',
    '^@repo/ingestion$': '<rootDir>/../../packages/ingestion/src/index.ts',
    '^@repo/drafting$': '<rootDir>/../../packages/drafting/src/index.ts',
    '^@repo/orchestrator$': '<rootDir>/../../packages/orchestrator/src/index.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
};
