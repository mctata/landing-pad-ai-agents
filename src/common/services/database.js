/**
 * This file is deprecated and kept for reference only.
 * Please use databaseService.js for PostgreSQL database access.
 * 
 * @deprecated Use databaseService.js instead
 */

console.warn('DEPRECATED: The database.js MongoDB service is deprecated. Please use databaseService.js for PostgreSQL database access.');

class DeprecatedDatabaseService {
  constructor() {
    throw new Error('The MongoDB database service is deprecated. Please use databaseService.js for PostgreSQL database access.');
  }
}

module.exports = DeprecatedDatabaseService;