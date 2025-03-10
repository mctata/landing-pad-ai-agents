/**
 * Storage Service
 * Provides database access for the agent system
 */

const { ObjectId } = require('mongodb');

class StorageService {
  /**
   * Create a new storage service
   * @param {Object} db - MongoDB database instance
   */
  constructor(db) {
    this.db = db;
    this.ObjectId = ObjectId;
    this.collections = {
      // Agent collections
      content_briefs: db.collection('content_briefs'),
      content_calendars: db.collection('content_calendars'),
      content_items: db.collection('content_items'),
      content_metadata: db.collection('content_metadata'),
      content_metrics: db.collection('content_metrics'),
      content_recommendations: db.collection('content_recommendations'),
      content_suggestions: db.collection('content_suggestions'),
      content_freshness: db.collection('content_freshness'),
      brand_guidelines: db.collection('brand_guidelines'),
      brand_patterns: db.collection('brand_patterns'),
      brand_terminology: db.collection('brand_terminology'),
      brand_consistency_reviews: db.collection('brand_consistency_reviews'),
      seo_recommendations: db.collection('seo_recommendations'),
      ab_testing_suggestions: db.collection('ab_testing_suggestions'),
      performance_analyses: db.collection('performance_analyses'),
      headlines: db.collection('headlines'),
      category_taxonomy: db.collection('category_taxonomy'),
      hashtags: db.collection('hashtags'),
      product_features: db.collection('product_features'),
      campaigns: db.collection('campaigns'),
      
      // User and auth collections
      users: db.collection('users'),
      sessions: db.collection('sessions'),
      api_keys: db.collection('api_keys'),
      
      // System collections
      system_logs: db.collection('system_logs'),
      system_metrics: db.collection('system_metrics')
    };
  }
  
  /**
   * Initialize storage service
   * Creates indexes for collections
   */
  async initialize() {
    // Create indexes for content_items collection
    await this.collections.content_items.createIndexes([
      { key: { type: 1 } },
      { key: { status: 1 } },
      { key: { created_at: 1 } },
      { key: { categories: 1 } },
      { key: { brief_id: 1 } },
      { key: { campaign_id: 1 } },
      { key: { keywords: 1 } },
      { key: { title: 'text', content: 'text' } }
    ]);
    
    // Create indexes for content_briefs collection
    await this.collections.content_briefs.createIndexes([
      { key: { type: 1 } },
      { key: { status: 1 } },
      { key: { created_at: 1 } },
      { key: { topic: 'text' } }
    ]);
    
    // Create indexes for content_metrics collection
    await this.collections.content_metrics.createIndexes([
      { key: { content_id: 1 } },
      { key: { timestamp: 1 } },
      { key: { metric_type: 1 } }
    ]);
    
    // Create indexes for content_calendars collection
    await this.collections.content_calendars.createIndexes([
      { key: { startDate: 1 } },
      { key: { endDate: 1 } },
      { key: { created_at: 1 } }
    ]);
    
    // Create indexes for brand_consistency_reviews collection
    await this.collections.brand_consistency_reviews.createIndexes([
      { key: { content_id: 1 } },
      { key: { status: 1 } },
      { key: { score: 1 } },
      { key: { review_date: 1 } }
    ]);
    
    // Create indexes for seo_recommendations collection
    await this.collections.seo_recommendations.createIndexes([
      { key: { content_id: 1 } },
      { key: { generated_at: 1 } },
      { key: { applied: 1 } }
    ]);
    
    // Create indexes for performance_analyses collection
    await this.collections.performance_analyses.createIndexes([
      { key: { content_id: 1 } },
      { key: { analysis_date: 1 } }
    ]);
    
    // Create indexes for content_freshness collection
    await this.collections.content_freshness.createIndexes([
      { key: { content_id: 1 } },
      { key: { analysis_date: 1 } },
      { key: { freshness_score: 1 } }
    ]);
    
    // Create indexes for users collection
    await this.collections.users.createIndexes([
      { key: { email: 1 }, unique: true },
      { key: { username: 1 }, unique: true }
    ]);
    
    // Create indexes for api_keys collection
    await this.collections.api_keys.createIndexes([
      { key: { key_hash: 1 }, unique: true },
      { key: { user_id: 1 } },
      { key: { expires_at: 1 } }
    ]);
    
    // Create indexes for sessions collection
    await this.collections.sessions.createIndexes([
      { key: { user_id: 1 } },
      { key: { expires_at: 1 } }
    ]);
    
    // Create indexes for system_logs collection
    await this.collections.system_logs.createIndexes([
      { key: { timestamp: 1 } },
      { key: { level: 1 } },
      { key: { agent: 1 } }
    ]);
    
    // Create indexes for system_metrics collection
    await this.collections.system_metrics.createIndexes([
      { key: { timestamp: 1 } },
      { key: { metric_type: 1 } }
    ]);
  }
  
  /**
   * Perform a database transaction
   * @param {Function} callback - Transaction callback
   * @returns {Promise<any>} Result of the transaction
   */
  async transaction(callback) {
    const session = this.db.client.startSession();
    
    try {
      let result;
      await session.withTransaction(async () => {
        result = await callback(session);
      });
      
      return result;
    } finally {
      await session.endSession();
    }
  }
  
  /**
   * Create a unique object ID
   * @returns {ObjectId} New object ID
   */
  createId() {
    return new ObjectId();
  }
  
  /**
   * Convert string ID to ObjectId
   * @param {string} id - String ID
   * @returns {ObjectId} MongoDB ObjectId
   */
  toObjectId(id) {
    return new ObjectId(id);
  }
  
  /**
   * Check if a string is a valid ObjectId
   * @param {string} id - String to check
   * @returns {boolean} True if valid ObjectId
   */
  isValidObjectId(id) {
    return ObjectId.isValid(id);
  }
  
  /**
   * Get DB stats
   * @returns {Promise<Object>} Database statistics
   */
  async getStats() {
    return await this.db.stats();
  }
  
  /**
   * Get collection stats
   * @param {string} collectionName - Name of the collection
   * @returns {Promise<Object>} Collection statistics
   */
  async getCollectionStats(collectionName) {
    return await this.db.command({ collStats: collectionName });
  }
  
  /**
   * Run a database query with error handling
   * @param {Function} queryFunc - Query function to execute
   * @param {string} errorMessage - Error message prefix
   * @returns {Promise<any>} Query result
   */
  async safeQuery(queryFunc, errorMessage = 'Database error') {
    try {
      return await queryFunc();
    } catch (error) {
      throw new Error(`${errorMessage}: ${error.message}`);
    }
  }
}

module.exports = StorageService;