/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Handle module aliases (if any)
    // Example: '^@/(.*)$': '<rootDir>/src/$1'
    // Handle .js extension in imports for ES modules
    '^(\.{1,2}/.*)\.js$': '$1',
  },
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",
  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: "v8",
};
