# Health Monitoring System

This directory contains the implementation of the health monitoring system for the Landing Pad AI Agents framework. It provides real-time monitoring, alerting, and recovery mechanisms for all agents in the system.

## Overview

The health monitoring system consists of several components:

1. **Health Monitoring Service**: Core service that tracks agent status and manages recovery
2. **Health Check API**: RESTful API for retrieving agent health status and triggering recovery
3. **Agent Health Client**: Client library for agents to report their health status

## Features

- Real-time agent status monitoring
- Automated detection of agent failures
- Automatic and manual agent recovery
- Performance metrics collection and tracking
- REST API for system status and management
- Agent health dashboard (coming soon)

## Architecture

The system follows a heartbeat-based monitoring approach:
- Agents periodically send heartbeats to the monitoring service
- The monitoring service detects missing heartbeats and marks agents as unresponsive
- Recovery commands are sent to failed agents to attempt automatic recovery
- Health status information is stored in MongoDB and accessible via API

## Usage

### Integrating an Agent with Health Monitoring

Agents can integrate with the health monitoring system using the `AgentHealthClient`:

```javascript
const AgentHealthClient = require('../core/monitoring/agentHealthClient');

class MyAgent {
  constructor(agentId) {
    // Create health client
    this.healthClient = new AgentHealthClient(agentId, {
      metrics: () => this.collectMetrics(),
      metadata: {
        type: 'my-agent-type',
        version: '1.0.0',
        critical: true
      }
    });
  }

  async init() {
    // Initialize health client
    await this.healthClient.init();
  }

  async start() {
    // Update status to online
    await this.healthClient.updateStatus('online', 'Agent started');
  }

  async stop() {
    // Update status to offline
    await this.healthClient.updateStatus('offline', 'Agent stopped');
    await this.healthClient.stop();
  }

  collectMetrics() {
    // Return custom metrics
    return {
      taskCount: this.taskCount,
      successRate: this.successRate,
      // Other metrics...
    };
  }
}
```

### Health Check API Endpoints

The following REST endpoints are available:

- `GET /health`: Overall system health check
- `GET /health/agents`: List all agents and their status
- `GET /health/agents/:agentId`: Get detailed status for a specific agent
- `POST /health/agents/:agentId/recover`: Trigger recovery for an agent
- `POST /health/agents/register`: Register an agent with the monitoring system

### Configuration

The health monitoring system can be configured via environment variables:

- `HEALTH_CHECK_PORT`: Port for the health check API (default: 3001)
- `DASHBOARD_PORT`: Port for the health dashboard (default: 3002)
- `HEALTH_CHECK_INTERVAL`: Interval for checking agent health in ms (default: 30000)
- `HEARTBEAT_INTERVAL`: Interval for agent heartbeats in ms (default: 30000)
- `HEARTBEAT_TIMEOUT`: Time after which an agent is considered unresponsive in ms (default: 90000)
- `MAX_RECOVERY_ATTEMPTS`: Maximum number of recovery attempts (default: 3)
- `AUTO_RECOVERY`: Enable/disable automatic recovery (default: true)

## Example

See `examples/agent-health-integration.js` for a complete example of integrating agents with the health monitoring system.

## Testing

Unit tests are available in the `__tests__/core/monitoring` directory. Run the tests with:

```bash
npm test -- __tests__/core/monitoring
```

## Dependencies

- Express.js for the REST API
- MongoDB for status persistence
- RabbitMQ for messaging between agents and the monitoring service
