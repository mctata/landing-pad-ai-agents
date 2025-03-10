// examples/agent-health-integration.js
const AgentHealthClient = require('../src/core/monitoring/agentHealthClient');
const logger = require('../src/core/utils/logger');

/**
 * Example of integrating an agent with the health monitoring system
 */
class ExampleAgent {
  constructor(agentId) {
    this.agentId = agentId;
    this.healthClient = null;
    this.taskCount = 0;
    this.taskSuccessCount = 0;
    this.taskFailureCount = 0;
    this.isRunning = false;
  }

  async init() {
    logger.info(`Initializing example agent: ${this.agentId}`);
    
    // Initialize the health client
    this.healthClient = new AgentHealthClient(this.agentId, {
      // Define custom metrics collection
      metrics: () => this.collectMetrics(),
      
      // Define agent metadata
      metadata: {
        type: 'example',
        version: '1.0.0',
        capabilities: ['task-processing', 'data-analysis'],
        critical: this.agentId.includes('critical')
      },
      
      // Set heartbeat interval (ms)
      heartbeatInterval: 15000
    });
    
    // Initialize the health client
    await this.healthClient.init();
    
    return this;
  }

  collectMetrics() {
    // Collect agent-specific metrics
    return {
      taskCount: this.taskCount,
      taskSuccessRate: this.taskCount > 0 ? (this.taskSuccessCount / this.taskCount) * 100 : 0,
      lastTaskTime: this.lastTaskTime,
      queueSize: Math.floor(Math.random() * 10) // Simulated queue size
    };
  }

  async start() {
    if (this.isRunning) {
      logger.warn(`Agent ${this.agentId} is already running`);
      return;
    }
    
    try {
      logger.info(`Starting agent: ${this.agentId}`);
      
      // Update status to online
      await this.healthClient.updateStatus('online', 'Agent started');
      
      this.isRunning = true;
      
      // Simulate periodic tasks
      this.taskInterval = setInterval(() => {
        this.processTask();
      }, 5000);
      
      // Simulate occasional errors (if this is a "flaky" agent)
      if (this.agentId.includes('flaky')) {
        this.errorInterval = setInterval(() => {
          this.simulateError();
        }, 30000);
      }
      
      logger.info(`Agent ${this.agentId} started successfully`);
    } catch (error) {
      logger.error(`Failed to start agent ${this.agentId}`, error);
      
      // Update health status to reflect the error
      await this.healthClient.updateStatus('failed', `Failed to start: ${error.message}`);
      
      throw error;
    }
  }

  async processTask() {
    this.taskCount++;
    this.lastTaskTime = new Date().toISOString();
    
    try {
      // Simulate task processing
      logger.info(`Agent ${this.agentId} processing task #${this.taskCount}`);
      
      // Simulate task success (with occasional random failures)
      const success = Math.random() > 0.2;
      
      if (success) {
        this.taskSuccessCount++;
        logger.info(`Agent ${this.agentId} completed task #${this.taskCount} successfully`);
      } else {
        this.taskFailureCount++;
        logger.warn(`Agent ${this.agentId} failed to complete task #${this.taskCount}`);
      }
      
      // Update metrics
      this.healthClient.updateMetrics(this.collectMetrics());
      
      return success;
    } catch (error) {
      logger.error(`Agent ${this.agentId} encountered an error processing task #${this.taskCount}`, error);
      this.taskFailureCount++;
      return false;
    }
  }

  simulateError() {
    if (!this.isRunning) return;
    
    // Simulate a random error
    const errorTypes = ['connection', 'timeout', 'processing', 'crash'];
    const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
    
    logger.error(`Agent ${this.agentId} simulating ${errorType} error`);
    
    switch (errorType) {
      case 'connection':
        this.healthClient.updateStatus('degraded', 'Connection issues detected');
        
        // Auto-recover after a delay
        setTimeout(() => {
          this.healthClient.updateStatus('online', 'Connection restored');
        }, 10000);
        break;
        
      case 'timeout':
        this.healthClient.updateStatus('degraded', 'Processing timeouts detected');
        
        // Auto-recover after a delay
        setTimeout(() => {
          this.healthClient.updateStatus('online', 'Timeouts resolved');
        }, 15000);
        break;
        
      case 'processing':
        // Just log the error but don't change status
        break;
        
      case 'crash':
        // Simulate a crash
        this.healthClient.updateStatus('failed', 'Agent crashed');
        this.stop();
        
        // Simulate auto-recovery after a delay
        setTimeout(() => {
          this.init().then(() => this.start());
        }, 20000);
        break;
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn(`Agent ${this.agentId} is not running`);
      return;
    }
    
    logger.info(`Stopping agent: ${this.agentId}`);
    
    // Clear intervals
    if (this.taskInterval) {
      clearInterval(this.taskInterval);
      this.taskInterval = null;
    }
    
    if (this.errorInterval) {
      clearInterval(this.errorInterval);
      this.errorInterval = null;
    }
    
    // Update status to offline
    await this.healthClient.updateStatus('offline', 'Agent stopped gracefully');
    
    // Stop the health client
    await this.healthClient.stop();
    
    this.isRunning = false;
    logger.info(`Agent ${this.agentId} stopped successfully`);
  }

  // Handle recovery request from the health monitoring system
  async handleRecovery(reason) {
    logger.info(`Agent ${this.agentId} received recovery request: ${reason}`);
    
    try {
      // Update status to indicate recovery in progress
      await this.healthClient.updateStatus('recovering', `Recovery in progress: ${reason}`);
      
      // Simulate recovery process
      logger.info(`Agent ${this.agentId} performing recovery...`);
      
      // Wait a moment to simulate recovery steps
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Restart the agent
      await this.stop();
      await this.init();
      await this.start();
      
      logger.info(`Agent ${this.agentId} recovered successfully`);
      return true;
    } catch (error) {
      logger.error(`Agent ${this.agentId} failed to recover`, error);
      
      // Update status to indicate recovery failed
      await this.healthClient.updateStatus('failed', `Recovery failed: ${error.message}`);
      
      return false;
    }
  }
}

/**
 * Run the example if executed directly
 */
if (require.main === module) {
  (async () => {
    try {
      // Create multiple agents to demonstrate monitoring
      const agents = [
        new ExampleAgent('content-strategy'),
        new ExampleAgent('content-creation'),
        new ExampleAgent('content-management'),
        new ExampleAgent('optimisation'),
        new ExampleAgent('brand-consistency'),
        new ExampleAgent('flaky-agent'),
        new ExampleAgent('critical-agent')
      ];
      
      // Initialize all agents
      for (const agent of agents) {
        await agent.init();
      }
      
      // Start all agents
      for (const agent of agents) {
        await agent.start();
      }
      
      logger.info('All example agents started successfully');
      logger.info('Press Ctrl+C to stop');
      
      // Setup graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('Shutting down example agents...');
        
        for (const agent of agents) {
          await agent.stop();
        }
        
        logger.info('All agents stopped successfully');
        process.exit(0);
      });
    } catch (error) {
      logger.error('Failed to run agent health integration example', error);
      process.exit(1);
    }
  })();
}

module.exports = ExampleAgent;
