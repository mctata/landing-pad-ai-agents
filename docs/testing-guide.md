# Testing Guide

This document provides an overview of the testing framework and guidelines for writing tests for the Landing Pad AI Agents project.

## Testing Structure

The project uses Jest as its primary testing framework and follows a three-tiered testing approach:

1. **Unit Tests** - Test individual functions and classes in isolation
2. **Integration Tests** - Test how components work together
3. **API Tests** - Test HTTP endpoints and API functionality

### Directory Structure

```
__tests__/
├── unit/           # Unit tests
│   ├── agents/     # Tests for agent modules
│   ├── services/   # Tests for services
│   ├── models/     # Tests for data models
│   ├── utils/      # Tests for utility functions
│   └── ...
├── integration/    # Integration tests
│   ├── agents/     # Tests for agent interactions
│   ├── services/   # Tests for service interactions
│   └── ...
└── api/            # API tests
    ├── controllers/  # Tests for API controllers
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

## Continuous Integration

Tests run automatically on GitHub Actions for:
- Pull requests to main branch
- Direct pushes to main branch

The CI workflow:
1. Runs linting
2. Runs all test types separately
3. Generates coverage report
4. Uploads coverage as an artifact