/**
 * Metrics Server
 * Provides a Prometheus-compatible metrics endpoint for application monitoring
 */

const express = require('express');
const promClient = require('prom-client');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create Registry for metrics
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Create custom metrics

// API request counter
const httpRequestCounter = new promClient.Counter({
  name: 'landing_pad_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// API request duration histogram
const httpRequestDuration = new promClient.Histogram({
  name: 'landing_pad_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]
});

// Agent task counter
const agentTaskCounter = new promClient.Counter({
  name: 'landing_pad_agent_tasks_total',
  help: 'Total number of agent tasks executed',
  labelNames: ['agent', 'task_type', 'status']
});

// AI provider requests counter
const aiProviderRequestCounter = new promClient.Counter({
  name: 'landing_pad_ai_provider_requests_total',
  help: 'Total number of requests to AI providers',
  labelNames: ['provider', 'model', 'status']
});

// AI provider token usage gauge
const aiProviderTokenUsage = new promClient.Gauge({
  name: 'landing_pad_ai_provider_token_usage',
  help: 'Token usage for AI provider requests',
  labelNames: ['provider', 'model', 'type']
});

// Database operation counter
const dbOperationCounter = new promClient.Counter({
  name: 'landing_pad_db_operations_total',
  help: 'Total number of database operations',
  labelNames: ['operation', 'collection', 'status']
});

// Message bus message counter
const messageBusCounter = new promClient.Counter({
  name: 'landing_pad_message_bus_messages_total',
  help: 'Total number of messages processed by the message bus',
  labelNames: ['type', 'status']
});

// Register custom metrics
register.registerMetric(httpRequestCounter);
register.registerMetric(httpRequestDuration);
register.registerMetric(agentTaskCounter);
register.registerMetric(aiProviderRequestCounter);
register.registerMetric(aiProviderTokenUsage);
register.registerMetric(dbOperationCounter);
register.registerMetric(messageBusCounter);

// Create Express app for metrics server
const app = express();

// Define metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).end();
  }
});

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Start metrics server
const port = process.env.METRICS_PORT || 9090;
app.listen(port, () => {
  console.log(`Metrics server listening on port ${port}`);
});

// Export metrics objects for use in other modules
module.exports = {
  httpRequestCounter,
  httpRequestDuration,
  agentTaskCounter,
  aiProviderRequestCounter,
  aiProviderTokenUsage,
  dbOperationCounter,
  messageBusCounter,
  register
};

// Start server if called directly
if (require.main === module) {
  console.log('Starting metrics server in standalone mode');
}