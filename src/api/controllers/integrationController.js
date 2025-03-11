/**
 * Integration Controller
 * Handles API endpoints for external integrations (CMS, social media, analytics)
 */

/**
 * Get status of all integrations
 */
exports.getIntegrationStatus = async (req, res, next) => {
  try {
    const services = req.app.locals.services;
    
    if (!services || !services.integration) {
      return res.status(503).json({
        error: {
          message: 'Integration service not available',
          code: 'integration_unavailable'
        }
      });
    }
    
    const status = services.integration.getStatus();
    
    return res.status(200).json(status);
  } catch (error) {
    next(error);
  }
};

/**
 * Publish content to a CMS
 */
exports.publishToCms = async (req, res, next) => {
  try {
    const { platform } = req.params;
    const contentData = req.body;
    
    const services = req.app.locals.services;
    
    if (!services || !services.integration) {
      return res.status(503).json({
        error: {
          message: 'Integration service not available',
          code: 'integration_unavailable'
        }
      });
    }
    
    const result = await services.integration.publishToCms(platform, contentData);
    
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: result.error,
          code: 'publish_failed'
        }
      });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Update content on a CMS
 */
exports.updateOnCms = async (req, res, next) => {
  try {
    const { platform, externalId } = req.params;
    const contentData = req.body;
    
    const services = req.app.locals.services;
    
    if (!services || !services.integration) {
      return res.status(503).json({
        error: {
          message: 'Integration service not available',
          code: 'integration_unavailable'
        }
      });
    }
    
    const result = await services.integration.updateOnCms(platform, externalId, contentData);
    
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: result.error,
          code: 'update_failed'
        }
      });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Import content from a CMS
 */
exports.importFromCms = async (req, res, next) => {
  try {
    const { platform } = req.params;
    const options = req.body;
    
    const services = req.app.locals.services;
    
    if (!services || !services.integration) {
      return res.status(503).json({
        error: {
          message: 'Integration service not available',
          code: 'integration_unavailable'
        }
      });
    }
    
    const result = await services.integration.importFromCms(platform, options);
    
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: result.error,
          code: 'import_failed'
        }
      });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Post content to social media
 */
exports.postToSocial = async (req, res, next) => {
  try {
    const { platform } = req.params;
    const contentData = req.body;
    
    const services = req.app.locals.services;
    
    if (!services || !services.integration) {
      return res.status(503).json({
        error: {
          message: 'Integration service not available',
          code: 'integration_unavailable'
        }
      });
    }
    
    let result;
    
    if (platform.toLowerCase() === 'twitter' && contentData.isThread) {
      result = await services.integration.postTwitterThread(contentData);
    } else {
      result = await services.integration.postToSocial(platform, contentData);
    }
    
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: result.error,
          code: 'post_failed'
        }
      });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get metrics from social media
 */
exports.getSocialMetrics = async (req, res, next) => {
  try {
    const { platform, externalId } = req.params;
    
    const services = req.app.locals.services;
    
    if (!services || !services.integration) {
      return res.status(503).json({
        error: {
          message: 'Integration service not available',
          code: 'integration_unavailable'
        }
      });
    }
    
    const result = await services.integration.getSocialMetrics(platform, externalId);
    
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: result.error,
          code: 'metrics_failed'
        }
      });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get page analytics
 */
exports.getPageAnalytics = async (req, res, next) => {
  try {
    const { pageUrl } = req.params;
    const options = req.query;
    
    const services = req.app.locals.services;
    
    if (!services || !services.integration) {
      return res.status(503).json({
        error: {
          message: 'Integration service not available',
          code: 'integration_unavailable'
        }
      });
    }
    
    const result = await services.integration.getPageAnalytics(pageUrl, options);
    
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: result.error,
          code: 'analytics_failed'
        }
      });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get top performing content
 */
exports.getTopPerformingContent = async (req, res, next) => {
  try {
    const options = req.query;
    
    const services = req.app.locals.services;
    
    if (!services || !services.integration) {
      return res.status(503).json({
        error: {
          message: 'Integration service not available',
          code: 'integration_unavailable'
        }
      });
    }
    
    const result = await services.integration.getTopPerformingContent(options);
    
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: result.error,
          code: 'analytics_failed'
        }
      });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get site metrics
 */
exports.getSiteMetrics = async (req, res, next) => {
  try {
    const options = req.query;
    
    const services = req.app.locals.services;
    
    if (!services || !services.integration) {
      return res.status(503).json({
        error: {
          message: 'Integration service not available',
          code: 'integration_unavailable'
        }
      });
    }
    
    const result = await services.integration.getSiteMetrics(options);
    
    if (!result.success) {
      return res.status(400).json({
        error: {
          message: result.error,
          code: 'analytics_failed'
        }
      });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};