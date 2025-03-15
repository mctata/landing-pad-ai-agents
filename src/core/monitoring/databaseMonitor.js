/**
 * Database Monitoring Service
 * Monitors database health and performance metrics
 */

const { Sequelize } = require('sequelize');
const logger = require('../../common/services/logger');
const { register, Gauge, Counter, Histogram } = require('prom-client');

// Initialize metrics
const dbConnectionGauge = new Gauge({
  name: 'postgres_connection_status',
  help: 'Status of PostgreSQL connection (1 = connected, 0 = disconnected)',
  labelNames: ['database', 'host']
});

const dbQueryCounter = new Counter({
  name: 'postgres_queries_total',
  help: 'Total number of PostgreSQL queries executed',
  labelNames: ['type', 'model', 'status']
});

const dbQueryDurationHistogram = new Histogram({
  name: 'postgres_query_duration_seconds',
  help: 'Duration of PostgreSQL queries in seconds',
  labelNames: ['type', 'model'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

const dbConnectionPoolGauge = new Gauge({
  name: 'postgres_connection_pool',
  help: 'PostgreSQL connection pool metrics',
  labelNames: ['database', 'state']
});

class DatabaseMonitor {
  constructor(sequelize) {
    this.sequelize = sequelize;
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.collectInterval = 15000; // 15 seconds
    this.logger = logger;
  }

  /**
   * Start monitoring database health and metrics
   */
  start() {
    if (this.isMonitoring) {
      this.logger.warn('Database monitoring is already running');
      return;
    }

    this.logger.info('Starting database monitoring');
    
    // Set up query logging hooks
    this._setupQueryHooks();
    
    // Start regular collection
    this.monitorInterval = setInterval(() => {
      this._collectMetrics();
    }, this.collectInterval);
    
    this.isMonitoring = true;
  }

  /**
   * Stop monitoring database health
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    this.logger.info('Stopping database monitoring');
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    this._removeQueryHooks();
    
    this.isMonitoring = false;
  }

  /**
   * Check database connectivity
   * @returns {Promise<boolean>} - Connection status
   */
  async checkConnection() {
    try {
      await this.sequelize.authenticate();
      return true;
    } catch (error) {
      this.logger.error('Database connection check failed:', error);
      return false;
    }
  }

  /**
   * Get connection pool stats
   * @returns {Promise<Object>} - Pool stats
   */
  async getPoolStats() {
    try {
      const pool = this.sequelize.connectionManager.pool;
      return {
        size: pool.size,
        available: pool.available,
        pending: pool.pending,
        max: pool.max,
        min: pool.min
      };
    } catch (error) {
      this.logger.error('Failed to get connection pool stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Run database health checks
   * @returns {Promise<Object>} - Health check results
   */
  async runHealthCheck() {
    const results = {
      status: 'unknown',
      connection: false,
      poolStats: {},
      queryLatency: null,
      dbSize: null,
      errors: []
    };

    try {
      // Check connection
      results.connection = await this.checkConnection();
      
      // Get pool stats
      results.poolStats = await this.getPoolStats();
      
      // Check query latency
      const startTime = Date.now();
      await this.sequelize.query('SELECT 1');
      results.queryLatency = Date.now() - startTime;
      
      // Get database size (requires permissions)
      try {
        const [dbSizeResult] = await this.sequelize.query(`
          SELECT pg_size_pretty(pg_database_size(current_database())) as size,
                 pg_database_size(current_database()) as bytes
        `);
        results.dbSize = dbSizeResult[0];
      } catch (error) {
        results.errors.push(`Failed to get database size: ${error.message}`);
      }
      
      results.status = results.connection ? 'healthy' : 'unhealthy';
    } catch (error) {
      results.status = 'unhealthy';
      results.errors.push(error.message);
      this.logger.error('Database health check failed:', error);
    }

    return results;
  }

  /**
   * Set up query tracking hooks on Sequelize
   * @private
   */
  _setupQueryHooks() {
    // Store original logging function
    this._originalLogging = this.sequelize.options.logging;
    
    // Replace with our instrumented version
    this.sequelize.options.logging = (query, options) => {
      // Get query type (SELECT, INSERT, UPDATE, DELETE)
      const queryType = query.split(' ')[0].toUpperCase();
      
      // Get model name from options if available
      const model = options && options.model ? options.model.name : 'unknown';
      
      // Increment query counter
      dbQueryCounter.inc({ type: queryType, model, status: 'success' });
      
      // Call original logging function if it exists
      if (typeof this._originalLogging === 'function') {
        this._originalLogging(query, options);
      }
    };
    
    // Instrument the query method
    this._originalQueryMethod = this.sequelize.query;
    this.sequelize.query = async (...args) => {
      const startTime = Date.now();
      let queryType = 'unknown';
      let status = 'success';
      
      try {
        // Extract query type from first argument if it's a string
        if (typeof args[0] === 'string') {
          queryType = args[0].split(' ')[0].toUpperCase();
        }
        
        // Execute the query
        const result = await this._originalQueryMethod.apply(this.sequelize, args);
        
        // Record query duration
        const duration = (Date.now() - startTime) / 1000; // Convert to seconds
        dbQueryDurationHistogram.observe({ type: queryType, model: 'raw' }, duration);
        
        return result;
      } catch (error) {
        status = 'error';
        // Increment error counter
        dbQueryCounter.inc({ type: queryType, model: 'raw', status: 'error' });
        throw error;
      }
    };
  }

  /**
   * Remove query hooks
   * @private
   */
  _removeQueryHooks() {
    if (this._originalLogging !== undefined) {
      this.sequelize.options.logging = this._originalLogging;
    }
    
    if (this._originalQueryMethod !== undefined) {
      this.sequelize.query = this._originalQueryMethod;
    }
  }

  /**
   * Collect database metrics
   * @private
   */
  async _collectMetrics() {
    try {
      // Check connection status
      const connected = await this.checkConnection();
      
      // Update connection gauge
      dbConnectionGauge.set(
        { 
          database: this.sequelize.config.database,
          host: this.sequelize.config.host
        }, 
        connected ? 1 : 0
      );
      
      // Get pool stats
      const poolStats = await this.getPoolStats();
      
      // Update pool gauges
      if (poolStats && !poolStats.error) {
        dbConnectionPoolGauge.set(
          { database: this.sequelize.config.database, state: 'total' },
          poolStats.size
        );
        
        dbConnectionPoolGauge.set(
          { database: this.sequelize.config.database, state: 'available' },
          poolStats.available
        );
        
        dbConnectionPoolGauge.set(
          { database: this.sequelize.config.database, state: 'pending' },
          poolStats.pending
        );
      }
      
      // Run performance queries (requires appropriate permissions)
      try {
        // Query for top tables by size
        const [tableStats] = await this.sequelize.query(`
          SELECT
            relname as table_name,
            pg_size_pretty(pg_relation_size(relid)) as table_size,
            pg_relation_size(relid) as size_bytes
          FROM pg_catalog.pg_statio_user_tables
          ORDER BY pg_relation_size(relid) DESC
          LIMIT 5;
        `);
        
        // Log table sizes for monitoring
        if (tableStats && tableStats.length) {
          this.logger.debug('Top tables by size:', tableStats);
        }
        
        // Query for index usage statistics
        const [indexStats] = await this.sequelize.query(`
          SELECT
            indexrelname as index_name,
            relname as table_name,
            idx_scan as index_scans,
            idx_tup_read as tuples_read,
            idx_tup_fetch as tuples_fetched
          FROM pg_catalog.pg_statio_user_indexes
          ORDER BY idx_scan DESC
          LIMIT 5;
        `);
        
        // Log index usage for monitoring
        if (indexStats && indexStats.length) {
          this.logger.debug('Most used indexes:', indexStats);
        }
      } catch (error) {
        this.logger.warn('Failed to collect detailed database metrics:', error.message);
      }
    } catch (error) {
      this.logger.error('Error collecting database metrics:', error);
    }
  }

  /**
   * Get current metrics
   * @returns {string} - Prometheus metrics
   */
  async getMetrics() {
    return register.metrics();
  }
}

module.exports = DatabaseMonitor;