/**
 * API Routes
 * Defines API endpoints for the Landing Pad Digital AI Agent System
 * Enhanced with security middleware and access control
 */

const express = require('express');
const router = express.Router();

// Import controllers
const agentController = require('./controllers/agentController');
const contentController = require('./controllers/contentController');
const analyticsController = require('./controllers/analyticsController');
const systemController = require('./controllers/systemController');
const integrationController = require('./controllers/integrationController');

// Import middleware
const auth = require('./middleware/auth');
const validate = require('./middleware/validate');
const security = require('./middleware/security');

// Create middleware chains for different types of endpoints
// Apply appropriate security middleware based on the endpoint requirements

// Basic security middleware for all API endpoints
const baseSecurityMiddleware = [
  security.securityHeaders,
  security.performanceMonitoring,
  security.sanitizeInputs,
  security.preventXss
];

// Authentication middleware chain
const authMiddleware = [
  ...baseSecurityMiddleware,
  auth.authenticate
];

// Admin middleware chain
const adminMiddleware = [
  ...baseSecurityMiddleware,
  security.adminRateLimit,
  auth.authenticate,
  auth.requireAdmin
];

// API key middleware for integration endpoints
const apiKeyMiddleware = [
  ...baseSecurityMiddleware,
  security.validateApiKey({ requiredScopes: ['content:read', 'content:write'] })
];

// Content generation middleware chain
const contentGenerationMiddleware = [
  ...baseSecurityMiddleware,
  security.contentGenerationRateLimit,
  auth.authenticate,
  auth.requirePermission('content:write')
];

// System routes - health check is public, status requires authentication
router.get('/health', systemController.healthCheck);
router.get('/status', authMiddleware, systemController.getSystemStatus);

// Agent health and recovery routes - require admin permission
router.get('/system/agents/:agentId/health', adminMiddleware, systemController.getAgentHealth);
router.get('/system/agents/:agentId/recovery-history', adminMiddleware, systemController.getAgentRecoveryHistory);
router.post('/system/agents/:agentId/restart', adminMiddleware, systemController.restartAgent);
router.post('/system/agents/register', adminMiddleware, systemController.registerAgent);

// Database monitoring routes - require admin permission
router.get('/system/database/health', adminMiddleware, systemController.getDatabaseHealth);

// Prometheus metrics endpoint - public for monitoring systems but internal only
router.get('/metrics', 
  [...baseSecurityMiddleware, (req, res, next) => {
    // Only allow requests from localhost or internal networks
    const ip = req.ip.replace(/^::ffff:/, '');
    if (ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('10.') || ip.startsWith('172.16.') || ip.startsWith('192.168.')) {
      next();
    } else {
      res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }
  }], 
  systemController.getPrometheusMetrics);

// Dead letter queue management - require admin permission
router.get('/system/dead-letter-queue', adminMiddleware, systemController.getDeadLetterQueue);
router.post('/system/dead-letter-queue/:key/retry', adminMiddleware, systemController.retryDeadLetterQueueEntry);
router.delete('/system/dead-letter-queue/:key', adminMiddleware, systemController.deleteDeadLetterQueueEntry);

// Authentication routes - apply specific auth rate limiting
const authSecurityMiddleware = [...baseSecurityMiddleware, security.authRateLimit];

router.post('/auth/refresh-token', authSecurityMiddleware, auth.refreshToken);
router.post('/auth/change-password', [...authMiddleware, auth.checkPasswordChangeRequired], systemController.changePassword);
router.post('/auth/reset-password-request', authSecurityMiddleware, systemController.requestPasswordReset);
router.post('/auth/reset-password', authSecurityMiddleware, systemController.resetPassword);
router.get('/auth/verify-token', authMiddleware, (req, res) => res.status(200).send({ valid: true }));

// Agent status routes - standard authentication
router.get('/agents', authMiddleware, agentController.getAllAgentStatus);
router.get('/agents/:agent', authMiddleware, agentController.getAgentStatus);
router.post('/agents/:agent/start', adminMiddleware, agentController.startAgent);
router.post('/agents/:agent/stop', adminMiddleware, agentController.stopAgent);

// Content Strategy Agent routes - require write permission and apply rate limiting
router.post('/strategy/brief', 
  contentGenerationMiddleware, 
  validate.createBrief, 
  agentController.createContentBrief
);

router.post('/strategy/calendar', 
  contentGenerationMiddleware, 
  validate.generateCalendar, 
  agentController.generateContentCalendar
);

router.post('/strategy/audience', 
  contentGenerationMiddleware, 
  validate.analyzeAudience, 
  agentController.analyzeAudience
);

// Content Creation Agent routes - require write permission and apply rate limiting
router.post('/creation/generate', 
  contentGenerationMiddleware, 
  validate.generateContent, 
  agentController.generateContent
);

router.post('/creation/edit', 
  contentGenerationMiddleware, 
  validate.editContent, 
  agentController.editContent
);

router.post('/creation/headlines', 
  contentGenerationMiddleware, 
  validate.generateHeadlines, 
  agentController.generateHeadlines
);

// Content Management Agent routes - require write permission
router.post('/management/categorize', 
  [...authMiddleware, auth.requirePermission('content:write')], 
  validate.categorizeContent, 
  agentController.categorizeContent
);

router.post('/management/schedule', 
  [...authMiddleware, auth.requirePermission('content:write')], 
  validate.scheduleContent, 
  agentController.scheduleContent
);

router.post('/management/check-freshness', 
  [...authMiddleware, auth.requirePermission('content:read')], 
  validate.checkFreshness, 
  agentController.checkContentFreshness
);

// Optimisation Agent routes - apply appropriate rate limiting
router.post('/optimization/analyze', 
  [...authMiddleware, auth.requirePermission('content:read')], 
  validate.analyzePerformance, 
  agentController.analyzeContentPerformance
);

router.post('/optimization/seo', 
  contentGenerationMiddleware, 
  validate.generateSeoRecommendations, 
  agentController.generateSeoRecommendations
);

router.post('/optimization/ab-testing', 
  contentGenerationMiddleware, 
  validate.generateAbTesting, 
  agentController.generateAbTestingSuggestions
);

// Brand Consistency Agent routes - require write permission
router.post('/brand/review', 
  [...authMiddleware, auth.requirePermission('content:read')], 
  validate.reviewContent, 
  agentController.reviewContentForBrand
);

router.post('/brand/fix', 
  [...authMiddleware, auth.requirePermission('content:write')], 
  validate.fixConsistencyIssues, 
  agentController.fixConsistencyIssues
);

router.post('/brand/guidelines', 
  [...authMiddleware, auth.requirePermission('content:write')], 
  validate.updateGuidelines, 
  agentController.updateBrandGuidelines
);

// Content routes - read operations require read permission, write operations require write permission
router.get('/content', 
  [...authMiddleware, auth.requirePermission('content:read')], 
  contentController.listContent
);

router.get('/content/:id', 
  [...authMiddleware, auth.requirePermission('content:read')], 
  contentController.getContent
);

router.post('/content', 
  [...authMiddleware, auth.requirePermission('content:write')], 
  validate.createContent, 
  contentController.createContent
);

router.put('/content/:id', 
  [...authMiddleware, auth.requirePermission('content:write')], 
  validate.updateContent, 
  contentController.updateContent
);

router.delete('/content/:id', 
  [...authMiddleware, auth.requirePermission('content:delete')], 
  contentController.deleteContent
);

router.get('/content/:id/history', 
  [...authMiddleware, auth.requirePermission('content:read')], 
  contentController.getContentHistory
);

router.get('/content/:id/analytics', 
  [...authMiddleware, auth.requirePermission('content:read')], 
  contentController.getContentAnalytics
);

// Analytics routes - require analytics permission
router.get('/analytics/performance', 
  [...authMiddleware, auth.requirePermission('analytics:read')], 
  analyticsController.getPerformanceMetrics
);

router.get('/analytics/topics', 
  [...authMiddleware, auth.requirePermission('analytics:read')], 
  analyticsController.getTopicPerformance
);

router.get('/analytics/channels', 
  [...authMiddleware, auth.requirePermission('analytics:read')], 
  analyticsController.getChannelPerformance
);

router.get('/analytics/audience', 
  [...authMiddleware, auth.requirePermission('analytics:read')], 
  analyticsController.getAudienceInsights
);

router.get('/analytics/dashboard', 
  [...authMiddleware, auth.requirePermission('analytics:read')], 
  analyticsController.getDashboardData
);

// Integration routes - either user authentication or API key authentication
router.get('/integrations/status',
  authMiddleware,
  integrationController.getIntegrationStatus
);

// CMS integrations - support both user auth and API key authentication
router.post('/integrations/cms/:platform/publish',
  [...baseSecurityMiddleware, 
   (req, res, next) => req.headers['x-api-key'] ? security.validateApiKey({requiredScopes: ['content:write', 'integrations:write']})(req, res, next) : auth.authenticate(req, res, next)],
  validate.publishToCms,
  integrationController.publishToCms
);

router.put('/integrations/cms/:platform/:externalId',
  [...baseSecurityMiddleware, 
   (req, res, next) => req.headers['x-api-key'] ? security.validateApiKey({requiredScopes: ['content:write', 'integrations:write']})(req, res, next) : auth.authenticate(req, res, next)],
  validate.updateOnCms,
  integrationController.updateOnCms
);

router.post('/integrations/cms/:platform/import',
  [...baseSecurityMiddleware, 
   (req, res, next) => req.headers['x-api-key'] ? security.validateApiKey({requiredScopes: ['content:write', 'integrations:read']})(req, res, next) : auth.authenticate(req, res, next)],
  validate.importFromCms,
  integrationController.importFromCms
);

// Social media integrations
router.post('/integrations/social/:platform/post',
  [...authMiddleware, auth.requirePermission('content:publish')],
  validate.postToSocial,
  integrationController.postToSocial
);

router.get('/integrations/social/:platform/:externalId/metrics',
  [...authMiddleware, auth.requirePermission('analytics:read')],
  integrationController.getSocialMetrics
);

// Analytics integrations
router.get('/integrations/analytics/page/:pageUrl',
  [...authMiddleware, auth.requirePermission('analytics:read')],
  integrationController.getPageAnalytics
);

router.get('/integrations/analytics/top-content',
  [...authMiddleware, auth.requirePermission('analytics:read')],
  integrationController.getTopPerformingContent
);

router.get('/integrations/analytics/site-metrics',
  [...authMiddleware, auth.requirePermission('analytics:read')],
  integrationController.getSiteMetrics
);

// Export the router
module.exports = router;