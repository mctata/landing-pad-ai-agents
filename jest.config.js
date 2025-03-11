/**
 * Jest Configuration for Landing Pad AI Agents
 */

module.exports = {
  // The test environment that will be used for testing
  testEnvironment: 'node',

  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // An array of regexp pattern strings used to skip coverage collection
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__mocks__/',
    '/testing/',
    '/coverage/'
  ],

  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: ['text', 'lcov', 'clover'],

  // An array of file extensions your modules use
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],

  // A map from regular expressions to module names or to arrays of module names that allow to stub out resources
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/__tests__/$1'
  },

  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],

  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js'
  ],

  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: [
    '/node_modules/'
  ],

  // A map from regular expressions to paths to transformers
  transform: {},

  // Indicates whether each individual test should be reported during the run
  verbose: true,
  
  // Setup files to run before each test file
  setupFilesAfterEnv: ['<rootDir>/testing/jest.setup.js'],
  
  // Global test timeout (20 seconds)
  testTimeout: 20000,
  
  // Custom test environment configurations
  globals: {
    TEST_ENV: process.env.NODE_ENV || 'test'
  },
  
  // Test result processor for integration with CI/CD
  testResultsProcessor: 'jest-junit',
  
  // Projects for different types of tests
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/__tests__/unit/**/*.test.js']
    },
    {
      displayName: 'integration',
      testMatch: ['**/__tests__/integration/**/*.test.js']
    },
    {
      displayName: 'api',
      testMatch: ['**/__tests__/api/**/*.test.js']
    }
  ]
};