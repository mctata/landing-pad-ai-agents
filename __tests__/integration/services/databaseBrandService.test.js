/**
 * Integration tests for the Database Service - Brand Guidelines Operations
 */

const testDatabase = require('../../../testing/setupTestDatabase');
const { mockFactories } = require('../../../testing/testHelpers');
const DatabaseService = require('../../../src/common/services/databaseService');
const mongoose = require('mongoose');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

describe('DatabaseService Brand Guidelines Operations', () => {
  let databaseService;

  // Connect to test database before all tests
  beforeAll(async () => {
    await testDatabase.connect();
    
    // Initialize database service with test config
    const config = {
      uri: global.__MONGO_URI__,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    };
    
    databaseService = new DatabaseService(config, mockLogger);
    await databaseService.connect();
  });

  // Clear database before each test
  beforeEach(async () => {
    await testDatabase.clearDatabase();
    jest.clearAllMocks();
  });

  // Disconnect from database after all tests
  afterAll(async () => {
    await databaseService.disconnect();
    await testDatabase.closeDatabase();
  });

  describe('Brand Guidelines CRUD Operations', () => {
    it('should create brand guidelines with generated ID', async () => {
      // Arrange
      const guidelineData = {
        name: 'Test Brand Guidelines',
        version: '1.0',
        brandValues: ['Innovation', 'Reliability', 'Customer-centric'],
        colors: {
          primary: '#0077CC',
          secondary: '#33AAFF',
          accent: '#FF5500'
        },
        typography: {
          headingFont: 'Montserrat',
          bodyFont: 'Open Sans'
        },
        voiceAndTone: {
          description: 'Professional but friendly, clear and concise',
          examples: [
            'Do: Use active voice and direct language',
            'Don\'t: Use jargon or complex technical terms unnecessarily'
          ]
        },
        terminology: {
          preferred: [
            { term: 'customers', avoid: 'users' },
            { term: 'platform', avoid: 'software' }
          ]
        },
        createdBy: 'brand-manager'
      };
      
      // Act
      const guidelines = await databaseService.createBrandGuideline(guidelineData);
      
      // Assert
      expect(guidelines).toBeDefined();
      expect(guidelines.guidelineId).toBeDefined();
      expect(guidelines.name).toBe('Test Brand Guidelines');
      expect(guidelines.version).toBe('1.0');
      expect(guidelines.brandValues).toContain('Innovation');
      expect(guidelines.colors.primary).toBe('#0077CC');
      expect(guidelines.typography.headingFont).toBe('Montserrat');
      expect(guidelines.voiceAndTone.description).toContain('Professional');
      expect(guidelines.terminology.preferred).toHaveLength(2);
      
      // Verify guidelines were saved
      const savedGuidelines = await databaseService.getBrandGuideline(guidelines.guidelineId);
      expect(savedGuidelines).toBeDefined();
      expect(savedGuidelines.guidelineId).toBe(guidelines.guidelineId);
    });
    
    it('should create brand guidelines with provided ID', async () => {
      // Arrange
      const guidelineId = 'custom-guideline-id';
      const guidelineData = {
        guidelineId,
        name: 'Custom ID Guidelines',
        version: '1.0',
        colors: {
          primary: '#FF0000'
        },
        createdBy: 'test-user'
      };
      
      // Act
      const guidelines = await databaseService.createBrandGuideline(guidelineData);
      
      // Assert
      expect(guidelines.guidelineId).toBe(guidelineId);
    });
    
    it('should retrieve brand guidelines by ID', async () => {
      // Arrange
      const guidelineData = {
        name: 'Retrievable Guidelines',
        version: '1.0',
        brandValues: ['Transparency', 'Quality'],
        createdBy: 'test-user'
      };
      
      const created = await databaseService.createBrandGuideline(guidelineData);
      
      // Act
      const retrieved = await databaseService.getBrandGuideline(created.guidelineId);
      
      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.guidelineId).toBe(created.guidelineId);
      expect(retrieved.name).toBe('Retrievable Guidelines');
      expect(retrieved.brandValues).toContain('Transparency');
    });
    
    it('should update brand guidelines', async () => {
      // Arrange
      const guidelineData = {
        name: 'Original Guidelines',
        version: '1.0',
        brandValues: ['Original Values'],
        colors: {
          primary: '#000000'
        },
        createdBy: 'test-user'
      };
      
      const guidelines = await databaseService.createBrandGuideline(guidelineData);
      const updateData = {
        name: 'Updated Guidelines',
        version: '1.1',
        brandValues: ['Updated Values'],
        colors: {
          primary: '#000000',
          secondary: '#FFFFFF'
        },
        updatedBy: 'brand-manager'
      };
      
      // Act
      const updated = await databaseService.updateBrandGuideline(guidelines.guidelineId, updateData);
      
      // Assert
      expect(updated).toBeDefined();
      expect(updated.guidelineId).toBe(guidelines.guidelineId);
      expect(updated.name).toBe('Updated Guidelines');
      expect(updated.version).toBe('1.1');
      expect(updated.brandValues).toContain('Updated Values');
      expect(updated.colors.secondary).toBe('#FFFFFF');
      expect(updated.updatedBy).toBe('brand-manager');
    });
    
    it('should throw error when updating non-existent guidelines', async () => {
      // Arrange
      const nonExistentId = 'non-existent-guideline-id';
      const updateData = {
        name: 'Will Fail',
        version: '1.0'
      };
      
      // Act & Assert
      await expect(databaseService.updateBrandGuideline(nonExistentId, updateData))
        .rejects.toThrow(`Brand guideline with ID ${nonExistentId} not found`);
    });
  });
  
  describe('Latest Brand Guidelines Retrieval', () => {
    it('should retrieve the latest brand guidelines by update date', async () => {
      // Arrange - Create multiple guidelines with different dates
      const guideline1 = {
        name: 'Old Guidelines',
        version: '1.0',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      };
      
      const guideline2 = {
        name: 'Mid Guidelines',
        version: '1.1',
        createdAt: new Date('2023-02-01'),
        updatedAt: new Date('2023-02-01')
      };
      
      const guideline3 = {
        name: 'Latest Guidelines',
        version: '1.2',
        createdAt: new Date('2023-03-01'),
        updatedAt: new Date('2023-03-01')
      };
      
      // Insert in non-chronological order
      await databaseService.createBrandGuideline(guideline2);
      await databaseService.createBrandGuideline(guideline1);
      await databaseService.createBrandGuideline(guideline3);
      
      // Act
      const latest = await databaseService.getLatestBrandGuideline();
      
      // Assert
      expect(latest).toBeDefined();
      expect(latest.name).toBe('Latest Guidelines');
      expect(latest.version).toBe('1.2');
    });
    
    it('should return null when no guidelines exist', async () => {
      // Act
      const latest = await databaseService.getLatestBrandGuideline();
      
      // Assert
      expect(latest).toBeNull();
    });
  });
});