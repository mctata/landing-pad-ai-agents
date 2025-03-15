# Testing Guide

This document provides an overview of the testing framework and guidelines for writing tests for the Landing Pad AI Agents project.

## Testing Structure

The project uses Jest as its primary testing framework and follows a four-tiered testing approach:

1. **Unit Tests** - Test individual functions and classes in isolation
2. **Integration Tests** - Test how components work together
3. **API Tests** - Test HTTP endpoints and API functionality
4. **End-to-End Tests** - Test complete workflows across multiple components

### Directory Structure

```
__tests__/
├── unit/                  # Unit tests
│   ├── agents/            # Tests for agent modules
│   ├── services/          # Tests for services
│   ├── models/            # Tests for data models
│   ├── core/              # Tests for core components
│   │   ├── error/         # Tests for error handling systems
│   │   ├── monitoring/    # Tests for monitoring systems
│   │   └── ...
│   ├── utils/             # Tests for utility functions
│   └── ...
├── integration/           # Integration tests
│   ├── agents/            # Tests for agent interactions
│   │   ├── content-workflow.test.js      # Tests for content workflow
│   │   └── content-end-to-end.test.js    # Full end-to-end tests
│   ├── api/               # API integration tests
│   │   └── monitoring.test.js            # Tests for monitoring API
│   ├── core/              # Core component integration
│   │   ├── error/         # Error handling integration
│   │   │   ├── agentRecoveryService.test.js    # Agent recovery tests
│   │   │   └── errorHandlingService.test.js    # Error handling tests
│   │   ├── monitoring/    # Monitoring integration
│   │   │   └── healthMonitoringService.test.js # Health monitoring tests
│   │   └── ...
│   └── services/          # Service integrations
└── api/                   # API tests
    ├── controllers/       # Tests for API controllers
    └── ...
```

## Running Tests

The following npm scripts are available for running tests:

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:api

# Run tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:coverage

# Run tests for CI environment
npm run test:ci
```

## Writing Tests

### Unit Tests

Unit tests should:

- Focus on testing a single unit of code in isolation
- Mock all external dependencies
- Be fast and deterministic
- Cover all edge cases and error conditions

Example:

```javascript
// __tests__/unit/services/AIProviderService.test.js
describe('AIProviderService', () => {
  let aiProviderService;
  
  beforeEach(() => {
    // Setup and mocks
    jest.clearAllMocks();
    aiProviderService = AIProviderService.getInstance();
  });
  
  it('should generate text using OpenAI', async () => {
    // Arrange
    const prompt = 'Test prompt';
    
    // Act
    const result = await aiProviderService.generateText(prompt);
    
    // Assert
    expect(result.text).toBeDefined();
    expect(result.provider).toBe('openai');
  });
});
```

### Integration Tests

Integration tests should:

- Test how components work together
- Use the in-memory MongoDB for database operations
- Minimize external dependencies or use controlled test doubles
- Test the most important integration points

Example:

```javascript
// __tests__/integration/services/databaseService.test.js
describe('DatabaseService Integration', () => {
  let databaseService;

  beforeAll(async () => {
    // Connect to test database
    await testDatabase.connect();
    databaseService = new DatabaseService({uri: process.env.MONGODB_URI});
    await databaseService.connect();
  });

  afterAll(async () => {
    await databaseService.disconnect();
    await testDatabase.closeDatabase();
  });

  it('should create and retrieve documents', async () => {
    // Test code here
  });
});
```

### API Tests

API tests should:

- Test HTTP endpoints and API functionality
- Use supertest for making HTTP requests
- Set up and tear down the test environment properly
- Test authentication and authorization

Example:

```javascript
// __tests__/api/controllers/agentController.test.js
describe('Agent Controller API', () => {
  let testUtils;
  
  beforeAll(async () => {
    const app = createTestApp();
    testUtils = await setupApiTest(app);
  });
  
  afterAll(async () => {
    await testUtils.closeApiTest();
  });
  
  it('should return all agents', async () => {
    // Make a request and assert on the response
    const response = await testUtils.authRequest()
      .get('/api/agents')
      .expect(200);
      
    expect(Array.isArray(response.body)).toBe(true);
  });
});
```

## Testing Utilities

The project provides several utilities to make testing easier:

1. `testing/testHelpers.js` - Common test helpers for database setup, token generation, etc.
2. `testing/mockFactories.js` - Factories for creating mock objects
3. `testing/setupTestDatabase.js` - MongoDB memory server setup
4. `testing/setupApiTests.js` - API test environment setup

## Mocking

For effective unit testing, external dependencies should be mocked. The project uses Jest's mocking capabilities:

```javascript
// Mock a module
jest.mock('../../../src/services/LoggerService', () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }));
});

// Mock a specific method
const mockMethod = jest.fn().mockResolvedValue({ success: true });
SomeClass.prototype.someMethod = mockMethod;
```

## Test Coverage

The project aims for high test coverage. Coverage reports are generated using Jest's built-in coverage tool:

```bash
npm run test:coverage
```

The coverage report is available in the `coverage/` directory.

## End-to-End Testing

End-to-end tests verify that the complete system works together correctly. These tests are particularly important for testing agent interactions and workflows.

### Content Workflow Testing

The `__tests__/integration/agents/content-end-to-end.test.js` file provides comprehensive end-to-end tests for the content creation workflow, including:

1. Content Strategy Agent creating a brief
2. Content Creation Agent generating content
3. Brand Consistency Agent checking content
4. Content Creation Agent revising content based on brand feedback
5. Optimization Agent generating SEO recommendations
6. Content Creation Agent applying SEO recommendations
7. Social media content generation
8. Content Management Agent categorizing and scheduling content

These tests use mocked AI services to simulate the expected responses while testing the actual interactions between agents.

### Error Recovery Testing

The `__tests__/integration/core/error/agentRecoveryService.test.js` file tests the system's ability to detect and recover from errors:

1. Detection of unresponsive agents
2. Recovery from agent errors
3. Resumption of interrupted operations
4. Resource optimization for resource-constrained agents
5. Tracking of recovery statistics
6. Isolation of problematic agents

### Health Monitoring Testing

The `__tests__/integration/core/monitoring/healthMonitoringService.test.js` file tests the health monitoring system:

1. Agent registration and status updates
2. Detection of unresponsive agents
3. Recovery initiation for failed agents
4. Status change handling
5. Metrics tracking and reporting
6. System health score calculation

## Best Practices

1. **Follow AAA pattern**: Arrange, Act, Assert
2. **Test the public API**: Focus on testing the interface, not implementation details
3. **Isolate tests**: Each test should be independent of others
4. **Use descriptive names**: Test names should describe the behavior being tested
5. **Clean up after tests**: Ensure tests clean up any resources they use
6. **Test edge cases**: Include tests for error conditions, edge cases, and invalid inputs
7. **Keep tests fast**: Slow tests discourage regular testing
8. **Don't test third-party code**: Focus on testing your own code
9. **Use snapshots sparingly**: Snapshot tests can be brittle
10. **Mock external services**: Use mocks for AI services, databases, and message queues
11. **Test recovery paths**: Test how the system handles failures and recovers from them

## Troubleshooting Tests

When tests are failing, consider these common issues and solutions:

### Path and Import Issues

- Ensure import paths are correct. Remember that Jest's `moduleNameMapper` maps `@/` to `<rootDir>/src/`
- Check for duplicate test files with the same name in different directories
- Verify that test files import the correct modules

### Database Connection Issues

- For integration tests, check that MongoDB Memory Server is starting correctly
- Look for connection timeouts or auth errors in the test output
- Ensure the `setupTestDatabase.js` is being used correctly

### Timeouts

- Tests that involve async operations might time out. Increase timeout with:
  ```javascript
  jest.setTimeout(10000); // 10 seconds
  ```
- Use the global timeout setting in jest.config.js for all tests

### Mock Issues

- Ensure mocks are set up before importing the modules that use them
- Verify mock implementations return expected values
- Check that mocks are reset between tests with `jest.clearAllMocks()`

### Running Specific Tests

To debug a specific test file or test case:

```bash
# Run a specific test file
npm test -- path/to/test.js

# Run tests matching a pattern
npm test -- -t "should update user profile"

# Run only integration tests for a specific component
npm run test:integration -- --testPathPattern=agents/content-workflow
```

## Continuous Integration

Tests run automatically on GitHub Actions for:
- Pull requests to main branch
- Direct pushes to main branch

The CI workflow:
1. Runs linting
2. Runs all test types separately
3. Generates coverage report
4. Uploads coverage as an artifact

## Test Development Plan

As the project continues to develop, these areas should receive additional test coverage:

1. **Agent Modules**: Each agent module should have dedicated unit tests
2. **API Controllers**: Complete test coverage for all API endpoints
3. **Error Cases**: Tests for error handling and recovery scenarios
4. **Performance Tests**: Tests that measure and verify system performance
5. **Security Tests**: Tests that verify authentication, authorization, and data protection

Priority should be given to testing critical paths and components that impact multiple parts of the system.