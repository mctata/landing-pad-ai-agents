/**
 * PostgreSQL Optimization Performance Tests
 * 
 * This file contains tests to measure the performance improvements from PostgreSQL optimizations.
 */

const DatabaseService = require('../../src/common/services/databaseService');
const { nanoid } = require('nanoid');
const faker = require('faker');

// Configure test database
const dbConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
  database: process.env.TEST_DB_NAME || 'landing_pad_test',
  username: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
  dialect: 'postgres',
  logging: false
};

// Test data sizes
const SMALL_DATASET = 10;
const MEDIUM_DATASET = 100;
const LARGE_DATASET = 1000;

// Performance threshold (milliseconds)
const SEARCH_THRESHOLD = 200;
const TRANSACTION_THRESHOLD = 100;
const RELATIONAL_THRESHOLD = 50;
const INDEX_THRESHOLD = 50;
const POOL_THRESHOLD = 1000;

let dbService;
let testData = {
  contents: [],
  workflows: [],
  users: []
};

/**
 * Measure execution time of a function
 * @param {Function} fn - Function to measure
 * @returns {Promise<{result: any, time: number}>} - Result and execution time
 */
const measurePerformance = async (fn) => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const time = Number(end - start) / 1000000; // Convert to milliseconds
  return { result, time };
};

/**
 * Create test content data
 * @param {number} count - Number of content items to create
 * @returns {Array} - Array of content data
 */
const createTestContentData = (count) => {
  const contentTypes = ['blog', 'social', 'website', 'email', 'landing_page'];
  const statuses = ['draft', 'pending_review', 'approved', 'published', 'archived'];
  
  return Array(count).fill().map((_, index) => ({
    contentId: `test-content-${nanoid(8)}`,
    type: contentTypes[index % contentTypes.length],
    title: faker.lorem.sentence(),
    content: {
      body: faker.lorem.paragraphs(5),
      summary: faker.lorem.paragraph(),
      sections: Array(3).fill().map(() => ({
        heading: faker.lorem.sentence(),
        text: faker.lorem.paragraphs(2)
      }))
    },
    meta_description: faker.lorem.paragraph(),
    keywords: Array(5).fill().map(() => faker.random.word()),
    categories: Array(3).fill().map(() => faker.random.word()),
    tags: Array(7).fill().map(() => faker.random.word()),
    status: statuses[index % statuses.length],
    createdBy: 'test-user',
    authorId: 'test-user'
  }));
};

/**
 * Create test workflow data
 * @param {number} count - Number of workflows to create
 * @returns {Array} - Array of workflow data
 */
const createTestWorkflowData = (count) => {
  const types = ['content_creation', 'content_review', 'content_approval', 'content_publishing'];
  const statuses = ['pending', 'in_progress', 'completed', 'failed'];
  
  return Array(count).fill().map((_, index) => ({
    workflowId: `test-workflow-${nanoid(8)}`,
    name: `Test Workflow ${index}`,
    description: faker.lorem.sentence(),
    type: types[index % types.length],
    contentId: testData.contents[index % testData.contents.length]?.contentId || null,
    status: statuses[index % statuses.length],
    priority: Math.floor(Math.random() * 5) + 1,
    createdBy: 'test-user',
    steps: Array(5).fill().map((_, stepIndex) => ({
      stepId: `step-${nanoid(8)}`,
      name: `Step ${stepIndex + 1}`,
      description: faker.lorem.sentence(),
      type: Math.random() > 0.5 ? 'automatic' : 'manual',
      status: stepIndex === 0 ? 'in_progress' : 'pending',
      order: stepIndex,
      config: {
        timeout: 3600,
        retries: 3
      }
    }))
  }));
};

/**
 * Create test user data
 * @param {number} count - Number of users to create
 * @returns {Array} - Array of user data
 */
const createTestUserData = (count) => {
  const roles = ['admin', 'editor', 'viewer'];
  const statuses = ['active', 'inactive'];
  
  return Array(count).fill().map((_, index) => ({
    userId: `test-user-${nanoid(8)}`,
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    email: faker.internet.email(),
    password: 'password123',
    roles: [roles[index % roles.length]],
    status: statuses[index % statuses.length],
    createdBy: 'system'
  }));
};

/**
 * Initialize test data
 * @param {number} size - Size of the test dataset
 */
const initializeTestData = async (size) => {
  console.log(`Initializing test data (size: ${size})...`);
  
  // Create test users
  testData.users = createTestUserData(Math.ceil(size / 10));
  
  // Create test content
  testData.contents = createTestContentData(size);
  
  // Create test workflows
  testData.workflows = createTestWorkflowData(size);
  
  // Insert test data into database
  for (const user of testData.users) {
    await dbService.createUser(user);
  }
  
  for (const content of testData.contents) {
    await dbService.createContent(content);
  }
  
  for (const workflow of testData.workflows) {
    await dbService.createWorkflow(workflow);
  }
  
  console.log(`Test data initialized: ${testData.contents.length} contents, ${testData.workflows.length} workflows, ${testData.users.length} users`);
};

describe('PostgreSQL Optimization Performance Tests', () => {
  beforeAll(async () => {
    // Connect to database
    dbService = new DatabaseService(dbConfig);
    await dbService.connect();
    
    // Initialize small dataset for quick tests
    await initializeTestData(SMALL_DATASET);
  }, 30000);
  
  afterAll(async () => {
    // Disconnect from database
    await dbService.disconnect();
  });
  
  describe('Full-Text Search Performance', () => {
    beforeAll(async () => {
      // For search tests, we need a larger dataset
      await initializeTestData(MEDIUM_DATASET);
    }, 60000);
    
    test('Should efficiently search content with full-text search', async () => {
      // Pick some random search terms from content
      const randomContent = testData.contents[Math.floor(Math.random() * testData.contents.length)];
      const searchText = randomContent.content.body.split(' ').slice(0, 3).join(' ');
      
      const { result, time } = await measurePerformance(() => 
        dbService.searchContent({ searchText, limit: 20 })
      );
      
      console.log(`Full-text search performance: ${time.toFixed(2)}ms (threshold: ${SEARCH_THRESHOLD}ms)`);
      console.log(`Found ${result.pagination.total} matches for "${searchText}"`);
      
      expect(time).toBeLessThan(SEARCH_THRESHOLD);
      expect(result.contents.length).toBeGreaterThan(0);
    });
    
    test('Should rank search results by relevance', async () => {
      // Use specific terms that should be in some of the content
      const searchText = 'test workflow content';
      
      const { result, time } = await measurePerformance(() => 
        dbService.searchContent({ searchText, limit: 10 })
      );
      
      console.log(`Search ranking performance: ${time.toFixed(2)}ms (threshold: ${SEARCH_THRESHOLD}ms)`);
      
      expect(time).toBeLessThan(SEARCH_THRESHOLD);
      expect(result.contents.length).toBeGreaterThan(0);
      
      // First result should be most relevant
      if (result.contents.length > 1) {
        const firstResult = result.contents[0];
        expect(firstResult.title.toLowerCase()).toEqual(
          expect.stringContaining('test') || 
          expect.stringContaining('workflow') || 
          expect.stringContaining('content')
        );
      }
    });
  });
  
  describe('Transaction Support Performance', () => {
    test('Should efficiently create content with transactions', async () => {
      const newContent = {
        contentId: `test-content-tx-${nanoid(8)}`,
        type: 'blog',
        title: 'Transaction Test Content',
        content: {
          body: faker.lorem.paragraphs(3)
        },
        keywords: ['transaction', 'test', 'performance'],
        createdBy: 'test-user'
      };
      
      const { result, time } = await measurePerformance(() => 
        dbService.createContent(newContent)
      );
      
      console.log(`Transaction performance (content creation): ${time.toFixed(2)}ms (threshold: ${TRANSACTION_THRESHOLD}ms)`);
      
      expect(time).toBeLessThan(TRANSACTION_THRESHOLD);
      expect(result).toBeDefined();
      expect(result.contentId).toBe(newContent.contentId);
      
      // Also verify that a content version was created (part of the transaction)
      const versions = await dbService.getContentVersions(newContent.contentId);
      expect(versions.length).toBe(1);
    });
    
    test('Should efficiently update content with transactions', async () => {
      // Get a random content to update
      const content = testData.contents[Math.floor(Math.random() * testData.contents.length)];
      
      const updateData = {
        title: `Updated: ${content.title}`,
        meta_description: 'Updated description for transaction test',
        updatedBy: 'test-user'
      };
      
      const { time } = await measurePerformance(() => 
        dbService.updateContent(content.contentId, updateData)
      );
      
      console.log(`Transaction performance (content update): ${time.toFixed(2)}ms (threshold: ${TRANSACTION_THRESHOLD}ms)`);
      
      expect(time).toBeLessThan(TRANSACTION_THRESHOLD);
      
      // Verify that a new content version was created
      const versions = await dbService.getContentVersions(content.contentId);
      expect(versions.length).toBeGreaterThan(0);
    });
  });
  
  describe('Relational Model vs JSONB Performance', () => {
    let workflowId;
    let steps = [];
    
    beforeAll(async () => {
      // Create a test workflow with steps
      const workflow = {
        workflowId: `rel-model-test-${nanoid(8)}`,
        name: 'Relational Model Test Workflow',
        description: 'Test workflow for relational model performance',
        type: 'content_creation',
        status: 'in_progress',
        createdBy: 'test-user'
      };
      
      workflowId = workflow.workflowId;
      await dbService.createWorkflow(workflow);
      
      // Create workflow steps in the relational model
      for (let i = 0; i < 10; i++) {
        const step = {
          stepId: `rel-step-${nanoid(8)}`,
          workflowId,
          name: `Step ${i + 1}`,
          description: `Test step ${i + 1} for relational model`,
          type: 'automatic',
          status: i === 0 ? 'in_progress' : 'pending',
          order: i,
          createdBy: 'test-user'
        };
        
        const createdStep = await dbService.createWorkflowStep(step);
        steps.push(createdStep);
      }
    });
    
    test('Should efficiently retrieve workflow steps from relational model', async () => {
      const { result, time } = await measurePerformance(() => 
        dbService.getWorkflowSteps(workflowId)
      );
      
      console.log(`Relational model performance (get steps): ${time.toFixed(2)}ms (threshold: ${RELATIONAL_THRESHOLD}ms)`);
      
      expect(time).toBeLessThan(RELATIONAL_THRESHOLD);
      expect(result.length).toBe(steps.length);
      
      // Verify steps are ordered correctly
      for (let i = 0; i < result.length; i++) {
        expect(result[i].order).toBe(i);
      }
    });
    
    test('Should efficiently update workflow step in relational model', async () => {
      // Get a step to update
      const step = steps[Math.floor(Math.random() * steps.length)];
      
      const updateData = {
        status: 'completed',
        completedAt: new Date(),
        updatedBy: 'test-user'
      };
      
      const { time } = await measurePerformance(() => 
        dbService.updateWorkflowStep(step.stepId, updateData)
      );
      
      console.log(`Relational model performance (update step): ${time.toFixed(2)}ms (threshold: ${RELATIONAL_THRESHOLD}ms)`);
      
      expect(time).toBeLessThan(RELATIONAL_THRESHOLD);
      
      // Verify the step was updated
      const updatedStep = await dbService.getWorkflowStep(step.stepId);
      expect(updatedStep.status).toBe('completed');
    });
  });
  
  describe('Index Performance', () => {
    test('Should efficiently query content using compound indexes', async () => {
      // Query using fields with a compound index (type, status)
      const { result, time } = await measurePerformance(() => 
        dbService.models.Content.findAll({
          where: { 
            type: 'blog', 
            status: 'published' 
          }
        })
      );
      
      console.log(`Index performance (compound index): ${time.toFixed(2)}ms (threshold: ${INDEX_THRESHOLD}ms)`);
      
      expect(time).toBeLessThan(INDEX_THRESHOLD);
    });
    
    test('Should efficiently query content using array indexes', async () => {
      // Get a random tag from content
      const randomContent = testData.contents[Math.floor(Math.random() * testData.contents.length)];
      const tag = randomContent.tags[0];
      
      // Query using array field with GIN index
      const { time } = await measurePerformance(() => 
        dbService.models.Content.findAll({
          where: Sequelize.literal(`'${tag}' = ANY(tags)`)
        })
      );
      
      console.log(`Index performance (GIN array index): ${time.toFixed(2)}ms (threshold: ${INDEX_THRESHOLD}ms)`);
      
      expect(time).toBeLessThan(INDEX_THRESHOLD);
    });
  });
  
  describe('Connection Pool Performance', () => {
    test('Should handle concurrent requests efficiently', async () => {
      // Create multiple concurrent requests
      const CONCURRENT_REQUESTS = 20;
      
      const { time } = await measurePerformance(async () => {
        const promises = Array(CONCURRENT_REQUESTS).fill().map(() => 
          dbService.getActiveWorkflows()
        );
        
        return Promise.all(promises);
      });
      
      console.log(`Connection pool performance (${CONCURRENT_REQUESTS} concurrent requests): ${time.toFixed(2)}ms (threshold: ${POOL_THRESHOLD}ms)`);
      
      expect(time).toBeLessThan(POOL_THRESHOLD);
    });
  });
});