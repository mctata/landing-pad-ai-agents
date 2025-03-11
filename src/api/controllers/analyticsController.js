/**
 * Analytics Controller
 * Handles API endpoints for analytics operations
 */

/**
 * Get performance metrics for content
 */
exports.getPerformanceMetrics = async (req, res, next) => {
  try {
    const {
      timeframe = 'month',
      contentType,
      startDate,
      endDate,
      metrics
    } = req.query;
    
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Analytics service not available',
          code: 'analytics_unavailable'
        }
      });
    }
    
    // Get optimisation agent if available
    const optimisationAgent = agentContainer.agents.optimisation;
    
    if (!optimisationAgent || !optimisationAgent.isRunning) {
      return res.status(503).json({
        error: {
          message: 'Optimisation agent not available',
          code: 'agent_unavailable'
        }
      });
    }
    
    // Get performance analyzer module
    const performanceAnalyzer = optimisationAgent.getModule('performanceAnalyzer');
    
    if (!performanceAnalyzer) {
      return res.status(404).json({
        error: {
          message: 'Performance Analyzer module not found',
          code: 'module_not_found'
        }
      });
    }
    
    // Parse metrics if provided as string
    const metricsArray = metrics ? 
      (typeof metrics === 'string' ? metrics.split(',') : metrics) : 
      ['views', 'engagement', 'conversions'];
    
    // Analyze performance
    const performanceData = await performanceAnalyzer.getAggregateMetrics({
      timeframe,
      contentType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      metrics: metricsArray,
      userId: req.user.id
    });
    
    return res.status(200).json({
      timeframe,
      metrics: performanceData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get topic performance
 */
exports.getTopicPerformance = async (req, res, next) => {
  try {
    const {
      timeframe = 'month',
      limit = 10,
      sortBy = 'engagement',
      category
    } = req.query;
    
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Analytics service not available',
          code: 'analytics_unavailable'
        }
      });
    }
    
    // Get performance data from storage
    const topicPerformance = await agentContainer.storage.getTopicPerformance({
      timeframe,
      limit: parseInt(limit),
      sortMetric: sortBy,
      category
    });
    
    // If analysis engine is available, enrich the data
    const contentStrategyAgent = agentContainer.agents.contentStrategy;
    if (contentStrategyAgent && contentStrategyAgent.isRunning) {
      try {
        const trendAnalyzer = contentStrategyAgent.getModule('trendAnalyzer');
        if (trendAnalyzer) {
          const enrichedData = await trendAnalyzer.analyzeTrends({
            performanceData: topicPerformance,
            timeframe
          });
          
          return res.status(200).json({
            timeframe,
            topics: enrichedData
          });
        }
      } catch (error) {
        req.app.locals.logger.error('Error enriching topic performance data:', error);
        // Continue and return basic data
      }
    }
    
    // Return basic data if enrichment fails or isn't available
    return res.status(200).json({
      timeframe,
      topics: topicPerformance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get channel performance
 */
exports.getChannelPerformance = async (req, res, next) => {
  try {
    const {
      timeframe = 'month',
      contentType,
      startDate,
      endDate
    } = req.query;
    
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Analytics service not available',
          code: 'analytics_unavailable'
        }
      });
    }
    
    // Get channel performance data from storage
    const channelPerformance = await agentContainer.storage.getChannelPerformance({
      timeframe,
      contentType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
    
    return res.status(200).json({
      timeframe,
      channels: channelPerformance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audience insights
 */
exports.getAudienceInsights = async (req, res, next) => {
  try {
    const {
      timeframe = 'month',
      segment,
      depth = 'basic'
    } = req.query;
    
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Analytics service not available',
          code: 'analytics_unavailable'
        }
      });
    }
    
    // Get basic audience data from storage
    const audienceData = await agentContainer.storage.getAudienceData({
      timeframe,
      segment
    });
    
    // If content strategy agent is available and detailed analysis requested,
    // get advanced audience insights
    if (depth !== 'basic' && agentContainer.agents.contentStrategy) {
      try {
        const strategyAgent = agentContainer.agents.contentStrategy;
        if (strategyAgent.isRunning) {
          const audienceInsights = strategyAgent.getModule('audienceInsights');
          if (audienceInsights) {
            const detailedInsights = await audienceInsights.generateInsights({
              audienceData,
              depth,
              userId: req.user.id
            });
            
            return res.status(200).json({
              timeframe,
              segment: segment || 'all',
              insights: detailedInsights
            });
          }
        }
      } catch (error) {
        req.app.locals.logger.error('Error getting detailed audience insights:', error);
        // Continue and return basic data
      }
    }
    
    // Return basic data
    return res.status(200).json({
      timeframe,
      segment: segment || 'all',
      insights: audienceData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard data
 */
exports.getDashboardData = async (req, res, next) => {
  try {
    const {
      timeframe = 'month',
      contentCount = 5
    } = req.query;
    
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Analytics service not available',
          code: 'analytics_unavailable'
        }
      });
    }
    
    // Prepare dashboard data container
    const dashboardData = {
      summary: {},
      topContent: [],
      performance: {},
      recentActivity: []
    };
    
    // Get optimisation agent if available for performance data
    const optimisationAgent = agentContainer.agents.optimisation;
    if (optimisationAgent && optimisationAgent.isRunning) {
      try {
        const performanceAnalyzer = optimisationAgent.getModule('performanceAnalyzer');
        if (performanceAnalyzer) {
          // Get summary stats
          dashboardData.summary = await performanceAnalyzer.getSummaryMetrics({
            timeframe,
            userId: req.user.id
          });
          
          // Get performance trends
          dashboardData.performance = await performanceAnalyzer.getPerformanceTrends({
            timeframe,
            userId: req.user.id
          });
        }
        
        // Get reporting module for top content
        const reporting = optimisationAgent.getModule('reporting');
        if (reporting) {
          dashboardData.topContent = await reporting.getTopPerformingContent({
            limit: parseInt(contentCount),
            timeframe,
            userId: req.user.id
          });
        }
      } catch (error) {
        req.app.locals.logger.error('Error getting optimization data for dashboard:', error);
      }
    }
    
    // Get recent activity from storage
    try {
      dashboardData.recentActivity = await agentContainer.storage.getRecentActivity({
        limit: 10,
        userId: req.user.id
      });
    } catch (error) {
      req.app.locals.logger.error('Error getting recent activity for dashboard:', error);
    }
    
    // If we couldn't get any data, return an error
    if (
      !dashboardData.summary.totalContent &&
      dashboardData.topContent.length === 0 &&
      Object.keys(dashboardData.performance).length === 0 &&
      dashboardData.recentActivity.length === 0
    ) {
      return res.status(503).json({
        error: {
          message: 'Unable to retrieve dashboard data',
          code: 'dashboard_unavailable'
        }
      });
    }
    
    return res.status(200).json({
      timeframe,
      dashboard: dashboardData
    });
  } catch (error) {
    next(error);
  }
};