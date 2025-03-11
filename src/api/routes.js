/**
 * API Routes
 * Defines API endpoints for the Landing Pad Digital AI Agent System
 */

const express = require('express');
const router = express.Router();

// Import controllers
const agentController = require('./controllers/agentController');
const contentController = require('./controllers/contentController');
const analyticsController = require('./controllers/analyticsController');
const systemController = require('./controllers/systemController');
const integrationController = require('./controllers/integrationController');

// Middleware
const auth = require('./middleware/auth');
const validate = require('./middleware/validate');

// System routes
router.get('/health', systemController.healthCheck);
router.get('/status', auth.authenticate, systemController.getSystemStatus);

// Agent status routes
router.get('/agents', auth.authenticate, agentController.getAllAgentStatus);
router.get('/agents/:agent', auth.authenticate, agentController.getAgentStatus);
router.post('/agents/:agent/start', auth.authenticate, agentController.startAgent);
router.post('/agents/:agent/stop', auth.authenticate, agentController.stopAgent);

// Content Strategy Agent routes
router.post('/strategy/brief', 
  auth.authenticate, 
  validate.createBrief, 
  agentController.createContentBrief
);

router.post('/strategy/calendar', 
  auth.authenticate, 
  validate.generateCalendar, 
  agentController.generateContentCalendar
);

router.post('/strategy/audience', 
  auth.authenticate, 
  validate.analyzeAudience, 
  agentController.analyzeAudience
);

// Content Creation Agent routes
router.post('/creation/generate', 
  auth.authenticate, 
  validate.generateContent, 
  agentController.generateContent
);

router.post('/creation/edit', 
  auth.authenticate, 
  validate.editContent, 
  agentController.editContent
);

router.post('/creation/headlines', 
  auth.authenticate, 
  validate.generateHeadlines, 
  agentController.generateHeadlines
);

// Content Management Agent routes
router.post('/management/categorize', 
  auth.authenticate, 
  validate.categorizeContent, 
  agentController.categorizeContent
);

router.post('/management/schedule', 
  auth.authenticate, 
  validate.scheduleContent, 
  agentController.scheduleContent
);

router.post('/management/check-freshness', 
  auth.authenticate, 
  validate.checkFreshness, 
  agentController.checkContentFreshness
);

// Optimisation Agent routes
router.post('/optimization/analyze', 
  auth.authenticate, 
  validate.analyzePerformance, 
  agentController.analyzeContentPerformance
);

router.post('/optimization/seo', 
  auth.authenticate, 
  validate.generateSeoRecommendations, 
  agentController.generateSeoRecommendations
);

router.post('/optimization/ab-testing', 
  auth.authenticate, 
  validate.generateAbTesting, 
  agentController.generateAbTestingSuggestions
);

// Brand Consistency Agent routes
router.post('/brand/review', 
  auth.authenticate, 
  validate.reviewContent, 
  agentController.reviewContentForBrand
);

router.post('/brand/fix', 
  auth.authenticate, 
  validate.fixConsistencyIssues, 
  agentController.fixConsistencyIssues
);

router.post('/brand/guidelines', 
  auth.authenticate, 
  validate.updateGuidelines, 
  agentController.updateBrandGuidelines
);

// Content routes
router.get('/content', 
  auth.authenticate, 
  contentController.listContent
);

router.get('/content/:id', 
  auth.authenticate, 
  contentController.getContent
);

router.post('/content', 
  auth.authenticate, 
  validate.createContent, 
  contentController.createContent
);

router.put('/content/:id', 
  auth.authenticate, 
  validate.updateContent, 
  contentController.updateContent
);

router.delete('/content/:id', 
  auth.authenticate, 
  contentController.deleteContent
);

router.get('/content/:id/history', 
  auth.authenticate, 
  contentController.getContentHistory
);

router.get('/content/:id/analytics', 
  auth.authenticate, 
  contentController.getContentAnalytics
);

// Analytics routes
router.get('/analytics/performance', 
  auth.authenticate, 
  analyticsController.getPerformanceMetrics
);

router.get('/analytics/topics', 
  auth.authenticate, 
  analyticsController.getTopicPerformance
);

router.get('/analytics/channels', 
  auth.authenticate, 
  analyticsController.getChannelPerformance
);

router.get('/analytics/audience', 
  auth.authenticate, 
  analyticsController.getAudienceInsights
);

router.get('/analytics/dashboard', 
  auth.authenticate, 
  analyticsController.getDashboardData
);

// Integration routes
router.get('/integrations/status',
  auth.authenticate,
  integrationController.getIntegrationStatus
);

// CMS integrations
router.post('/integrations/cms/:platform/publish',
  auth.authenticate,
  integrationController.publishToCms
);

router.put('/integrations/cms/:platform/:externalId',
  auth.authenticate,
  integrationController.updateOnCms
);

router.post('/integrations/cms/:platform/import',
  auth.authenticate,
  integrationController.importFromCms
);

// Social media integrations
router.post('/integrations/social/:platform/post',
  auth.authenticate,
  integrationController.postToSocial
);

router.get('/integrations/social/:platform/:externalId/metrics',
  auth.authenticate,
  integrationController.getSocialMetrics
);

// Analytics integrations
router.get('/integrations/analytics/page/:pageUrl',
  auth.authenticate,
  integrationController.getPageAnalytics
);

router.get('/integrations/analytics/top-content',
  auth.authenticate,
  integrationController.getTopPerformingContent
);

router.get('/integrations/analytics/site-metrics',
  auth.authenticate,
  integrationController.getSiteMetrics
);

// Export the router
module.exports = router;