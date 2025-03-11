/**
 * Tests for the Migration Service
 */

const MigrationService = require('../../../src/common/services/migrationService');
const fs = require('fs');
const path = require('path');

// Mock the Database object from migrate-mongo
jest.mock('migrate-mongo', () => ({
  Database: {
    connect: jest.fn().mockResolvedValue({
      db: {},
      client: { close: jest.fn() }
    }),
    status: jest.fn(),
    up: jest.fn(),
    down: jest.fn()
  }
}));

// Mock the fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readdirSync: jest.fn().mockReturnValue(['20250311000000-test.js']),
  writeFileSync: jest.fn()
}));

// Mock the Logger
jest.mock('../../../src/common/services/logger', () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }));
});

describe('MigrationService', () => {
  let migrationService;
  let mockConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a mock config
    mockConfig = {
      configFilePath: '/mock/path/migrate-mongo-config.js',
      migrationsDir: '/mock/path/migrations/scripts'
    };
    
    // Mock the migration config loaded from require
    jest.mock('/mock/path/migrate-mongo-config.js', () => ({
      mongodb: { url: 'mongodb://localhost:27017/test' }
    }), { virtual: true });
    
    migrationService = new MigrationService(mockConfig);
  });

  describe('initialize', () => {
    it('should initialize the migration service successfully', async () => {
      const result = await migrationService.initialize();
      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(mockConfig.configFilePath);
      expect(require('migrate-mongo').Database.connect).toHaveBeenCalled();
    });

    it('should throw an error if config file does not exist', async () => {
      fs.existsSync.mockReturnValueOnce(false);
      await expect(migrationService.initialize()).rejects.toThrow('Migration config file not found');
    });
  });

  describe('status', () => {
    it('should return migration status', async () => {
      const mockStatus = [
        { fileName: '20250311000000-test.js', appliedAt: new Date() }
      ];
      require('migrate-mongo').Database.status.mockResolvedValueOnce(mockStatus);
      
      const status = await migrationService.status();
      expect(status).toEqual(mockStatus);
      expect(require('migrate-mongo').Database.status).toHaveBeenCalled();
    });

    it('should initialize if the service is not already initialized', async () => {
      const mockStatus = [];
      require('migrate-mongo').Database.status.mockResolvedValueOnce(mockStatus);
      
      const initSpy = jest.spyOn(migrationService, 'initialize');
      migrationService.database = null;
      
      await migrationService.status();
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('listMigrations', () => {
    it('should return a list of migration files', async () => {
      const result = await migrationService.listMigrations();
      expect(result).toEqual(['20250311000000-test.js']);
      expect(fs.readdirSync).toHaveBeenCalledWith(mockConfig.migrationsDir);
    });
  });

  describe('up', () => {
    it('should apply pending migrations', async () => {
      const mockMigrated = ['20250311000000-test.js'];
      require('migrate-mongo').Database.up.mockResolvedValueOnce(mockMigrated);
      
      const result = await migrationService.up();
      expect(result).toEqual(mockMigrated);
      expect(require('migrate-mongo').Database.up).toHaveBeenCalled();
    });

    it('should handle the case where no migrations are applied', async () => {
      require('migrate-mongo').Database.up.mockResolvedValueOnce([]);
      
      const result = await migrationService.up();
      expect(result).toEqual([]);
    });
  });

  describe('down', () => {
    it('should revert the last applied migration', async () => {
      require('migrate-mongo').Database.down.mockResolvedValueOnce('20250311000000-test.js');
      
      const result = await migrationService.down();
      expect(result).toBe('20250311000000-test.js');
      expect(require('migrate-mongo').Database.down).toHaveBeenCalled();
    });

    it('should handle the case where no migrations are reverted', async () => {
      require('migrate-mongo').Database.down.mockResolvedValueOnce(null);
      
      const result = await migrationService.down();
      expect(result).toBeNull();
    });
  });

  describe('createMigration', () => {
    it('should create a new migration file', () => {
      const migrationName = 'test migration';
      const result = migrationService.createMigration(migrationName);
      
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(result).toContain('test-migration.js');
    });
  });

  describe('close', () => {
    it('should close the database connection', async () => {
      await migrationService.initialize();
      await migrationService.close();
      
      expect(migrationService.database.client.close).toHaveBeenCalled();
    });

    it('should handle the case where the database is not initialized', async () => {
      migrationService.database = null;
      await migrationService.close();
      // Should not throw any errors
    });
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = MigrationService.getInstance(mockConfig);
      const instance2 = MigrationService.getInstance(mockConfig);
      
      expect(instance1).toBe(instance2);
    });
  });
});