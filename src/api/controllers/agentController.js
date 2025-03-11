/**
 * Agent Controller
 * Handles API endpoints for agent operations
 */

/**
 * Get status for all agents
 */
exports.getAllAgentStatus = async (req, res, next) => {
  try {
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agentStatuses = {};
    for (const [name, agent] of Object.entries(agentContainer.agents)) {
      agentStatuses[name] = {
        isRunning: agent.isRunning,
        moduleCount: agent.modules ? agent.modules.size : 0,
        lastActivity: agent.lastActivity || null
      };
    }
    
    return res.status(200).json({
      agents: agentStatuses
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get status for a specific agent
 */
exports.getAgentStatus = async (req, res, next) => {
  try {
    const { agent: agentName } = req.params;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents[agentName];
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: `Agent '${agentName}' not found`,
          code: 'agent_not_found'
        }
      });
    }
    
    // Get detailed agent status
    const modules = [];
    if (agent.modules) {
      for (const [moduleName, module] of agent.modules) {
        modules.push({
          name: moduleName,
          isInitialized: module.isInitialized || false
        });
      }
    }
    
    return res.status(200).json({
      name: agentName,
      isRunning: agent.isRunning,
      moduleCount: modules.length,
      modules,
      lastActivity: agent.lastActivity || null,
      config: agent.config || {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start a specific agent
 */
exports.startAgent = async (req, res, next) => {
  try {
    const { agent: agentName } = req.params;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents[agentName];
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: `Agent '${agentName}' not found`,
          code: 'agent_not_found'
        }
      });
    }
    
    if (agent.isRunning) {
      return res.status(400).json({
        error: {
          message: `Agent '${agentName}' is already running`,
          code: 'agent_already_running'
        }
      });
    }
    
    await agent.start();
    
    return res.status(200).json({
      message: `Agent '${agentName}' started successfully`,
      name: agentName,
      isRunning: agent.isRunning
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Stop a specific agent
 */
exports.stopAgent = async (req, res, next) => {
  try {
    const { agent: agentName } = req.params;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents[agentName];
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: `Agent '${agentName}' not found`,
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: `Agent '${agentName}' is not running`,
          code: 'agent_not_running'
        }
      });
    }
    
    await agent.stop();
    
    return res.status(200).json({
      message: `Agent '${agentName}' stopped successfully`,
      name: agentName,
      isRunning: agent.isRunning
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Content Strategy Agent Operations
// ==========================================

/**
 * Create content brief
 */
exports.createContentBrief = async (req, res, next) => {
  try {
    const { type, topic, targetAudience, keywords, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.contentStrategy;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Content Strategy Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Content Strategy Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get brief generator module
    const briefGenerator = agent.getModule('briefGenerator');
    
    if (!briefGenerator) {
      return res.status(404).json({
        error: {
          message: 'Brief Generator module not found',
          code: 'module_not_found'
        }
      });
    }
    
    // Generate content brief
    const brief = await briefGenerator.generateBrief({
      type,
      topic,
      targetAudience,
      keywords,
      userId
    });
    
    // Store the brief
    const briefId = await agentContainer.storage.storeBrief(brief);
    
    return res.status(201).json({
      message: 'Content brief created successfully',
      briefId,
      brief
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate content calendar
 */
exports.generateContentCalendar = async (req, res, next) => {
  try {
    const { startDate, endDate, channels, numberOfItems, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.contentStrategy;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Content Strategy Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Content Strategy Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Generate content calendar
    const calendar = await agent.generateContentCalendar({
      startDate, 
      endDate, 
      channels, 
      numberOfItems,
      userId
    });
    
    return res.status(200).json({
      message: 'Content calendar generated successfully',
      calendar
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Analyze audience
 */
exports.analyzeAudience = async (req, res, next) => {
  try {
    const { segment, dataSource, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.contentStrategy;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Content Strategy Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Content Strategy Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get audience insights module
    const audienceInsights = agent.getModule('audienceInsights');
    
    if (!audienceInsights) {
      return res.status(404).json({
        error: {
          message: 'Audience Insights module not found',
          code: 'module_not_found'
        }
      });
    }
    
    // Analyze audience
    const insights = await audienceInsights.generateInsights({
      segment,
      dataSource,
      userId
    });
    
    return res.status(200).json({
      message: 'Audience analysis completed',
      insights
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Content Creation Agent Operations
// ==========================================

/**
 * Generate content
 */
exports.generateContent = async (req, res, next) => {
  try {
    const { briefId, type, overrides, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.contentCreation;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Content Creation Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Content Creation Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    let brief;
    
    // If briefId is provided, fetch the brief
    if (briefId) {
      brief = await agentContainer.storage.getBrief(briefId);
      
      if (!brief) {
        return res.status(404).json({
          error: {
            message: `Brief with ID '${briefId}' not found`,
            code: 'brief_not_found'
          }
        });
      }
    } else if (overrides) {
      // Use overrides as brief
      brief = {
        type: overrides.type,
        topic: overrides.topic,
        targetAudience: overrides.target_audience,
        keywords: overrides.keywords
      };
    } else {
      return res.status(400).json({
        error: {
          message: 'Either briefId or overrides must be provided',
          code: 'missing_parameters'
        }
      });
    }
    
    // Select appropriate generator module based on content type
    let generator;
    
    switch (brief.type) {
      case 'blog':
        generator = agent.getModule('blogGenerator');
        break;
      case 'social':
        generator = agent.getModule('socialMediaGenerator');
        break;
      case 'website':
      case 'landing_page':
        generator = agent.getModule('websiteCopyGenerator');
        break;
      default:
        generator = agent.getModule('contentGenerator');
    }
    
    if (!generator) {
      return res.status(404).json({
        error: {
          message: `Generator module for type '${brief.type}' not found`,
          code: 'module_not_found'
        }
      });
    }
    
    // Generate content
    const content = await generator.generate(brief);
    
    // Store content
    const contentId = await agentContainer.storage.storeContent({
      type: brief.type,
      title: content.title || brief.topic,
      content: content.body || content,
      keywords: brief.keywords,
      userId,
      createdAt: new Date(),
      status: 'draft'
    });
    
    return res.status(201).json({
      message: 'Content generated successfully',
      contentId,
      content
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Edit content
 */
exports.editContent = async (req, res, next) => {
  try {
    const { contentId, changes, feedback, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.contentCreation;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Content Creation Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Content Creation Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get content
    const content = await agentContainer.storage.getContent(contentId);
    
    if (!content) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${contentId}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    // Get content editor module
    const editor = agent.getModule('contentEditor');
    
    if (!editor) {
      return res.status(404).json({
        error: {
          message: 'Content Editor module not found',
          code: 'module_not_found'
        }
      });
    }
    
    // Edit content
    const editedContent = await editor.edit({
      content,
      changes,
      feedback,
      userId
    });
    
    // Update content
    await agentContainer.storage.updateContent(contentId, {
      content: editedContent.body || editedContent,
      updatedAt: new Date(),
      updatedBy: userId
    });
    
    return res.status(200).json({
      message: 'Content edited successfully',
      contentId,
      content: editedContent
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate headlines
 */
exports.generateHeadlines = async (req, res, next) => {
  try {
    const { topic, count, type, targetAudience, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.contentCreation;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Content Creation Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Content Creation Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get headline generator module
    const headlineGenerator = agent.getModule('headlineGenerator');
    
    if (!headlineGenerator) {
      return res.status(404).json({
        error: {
          message: 'Headline Generator module not found',
          code: 'module_not_found'
        }
      });
    }
    
    // Generate headlines
    const headlines = await headlineGenerator.generate({
      topic,
      count,
      type,
      targetAudience,
      userId
    });
    
    return res.status(200).json({
      message: 'Headlines generated successfully',
      headlines
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Content Management Agent Operations
// ==========================================

/**
 * Categorize content
 */
exports.categorizeContent = async (req, res, next) => {
  try {
    const { contentId, manualCategories, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.contentManagement;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Content Management Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Content Management Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get content
    const content = await agentContainer.storage.getContent(contentId);
    
    if (!content) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${contentId}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    // Get content categoriser module
    const categoriser = agent.getModule('contentCategoriser');
    
    if (!categoriser) {
      return res.status(404).json({
        error: {
          message: 'Content Categoriser module not found',
          code: 'module_not_found'
        }
      });
    }
    
    // Categorize content
    const categories = await categoriser.categorize({
      content,
      manualCategories,
      userId
    });
    
    // Update content with categories
    await agentContainer.storage.updateContent(contentId, {
      categories,
      updatedAt: new Date(),
      updatedBy: userId
    });
    
    return res.status(200).json({
      message: 'Content categorized successfully',
      contentId,
      categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Schedule content
 */
exports.scheduleContent = async (req, res, next) => {
  try {
    const { contentId, publishDate, platform, status, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.contentManagement;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Content Management Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Content Management Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get content
    const content = await agentContainer.storage.getContent(contentId);
    
    if (!content) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${contentId}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    // Get workflow manager module
    const workflowManager = agent.getModule('workflowManager');
    
    if (!workflowManager) {
      return res.status(404).json({
        error: {
          message: 'Workflow Manager module not found',
          code: 'module_not_found'
        }
      });
    }
    
    // Schedule content
    const schedule = await workflowManager.scheduleContent({
      contentId,
      content,
      publishDate,
      platform,
      status,
      userId
    });
    
    return res.status(200).json({
      message: 'Content scheduled successfully',
      contentId,
      schedule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check content freshness
 */
exports.checkContentFreshness = async (req, res, next) => {
  try {
    const { contentIds, thresholdDays, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.contentManagement;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Content Management Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Content Management Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get freshness checker module
    const freshnessChecker = agent.getModule('freshnessChecker');
    
    if (!freshnessChecker) {
      return res.status(404).json({
        error: {
          message: 'Freshness Checker module not found',
          code: 'module_not_found'
        }
      });
    }
    
    let contents = [];
    
    // If content IDs provided, fetch those contents
    if (contentIds && contentIds.length > 0) {
      for (const contentId of contentIds) {
        const content = await agentContainer.storage.getContent(contentId);
        if (content) {
          contents.push(content);
        }
      }
    } else {
      // Get all published contents
      contents = await agentContainer.storage.getAllContents({ 
        status: 'published', 
        limit: 100 
      });
    }
    
    // Check freshness
    const freshnessResults = await freshnessChecker.checkFreshness({
      contents,
      thresholdDays,
      userId
    });
    
    return res.status(200).json({
      message: 'Content freshness checked successfully',
      results: freshnessResults
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Optimisation Agent Operations
// ==========================================

/**
 * Analyze content performance
 */
exports.analyzeContentPerformance = async (req, res, next) => {
  try {
    const { contentId, metrics, timeframe, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.optimisation;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Optimisation Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Optimisation Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get performance analyzer module
    const performanceAnalyzer = agent.getModule('performanceAnalyzer');
    
    if (!performanceAnalyzer) {
      return res.status(404).json({
        error: {
          message: 'Performance Analyzer module not found',
          code: 'module_not_found'
        }
      });
    }
    
    let content;
    if (contentId) {
      content = await agentContainer.storage.getContent(contentId);
      
      if (!content) {
        return res.status(404).json({
          error: {
            message: `Content with ID '${contentId}' not found`,
            code: 'content_not_found'
          }
        });
      }
    }
    
    // Analyze performance
    const analysis = await performanceAnalyzer.analyze({
      content,
      contentId,
      metrics,
      timeframe,
      userId
    });
    
    return res.status(200).json({
      message: 'Content performance analyzed successfully',
      analysis
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate SEO recommendations
 */
exports.generateSeoRecommendations = async (req, res, next) => {
  try {
    const { contentId, keywords, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.optimisation;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Optimisation Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Optimisation Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get SEO optimizer module
    const seoOptimizer = agent.getModule('seoOptimizer');
    
    if (!seoOptimizer) {
      return res.status(404).json({
        error: {
          message: 'SEO Optimizer module not found',
          code: 'module_not_found'
        }
      });
    }
    
    // Get content
    const content = await agentContainer.storage.getContent(contentId);
    
    if (!content) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${contentId}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    // Generate SEO recommendations
    const recommendations = await seoOptimizer.optimize({
      content,
      keywords,
      userId
    });
    
    return res.status(200).json({
      message: 'SEO recommendations generated successfully',
      contentId,
      recommendations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate A/B testing suggestions
 */
exports.generateAbTestingSuggestions = async (req, res, next) => {
  try {
    const { contentId, elements, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.optimisation;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Optimisation Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Optimisation Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get A/B testing generator module
    const abTestingGenerator = agent.getModule('abTestingGenerator');
    
    if (!abTestingGenerator) {
      return res.status(404).json({
        error: {
          message: 'A/B Testing Generator module not found',
          code: 'module_not_found'
        }
      });
    }
    
    // Get content
    const content = await agentContainer.storage.getContent(contentId);
    
    if (!content) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${contentId}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    // Generate A/B testing suggestions
    const suggestions = await abTestingGenerator.generate({
      content,
      elements,
      userId
    });
    
    return res.status(200).json({
      message: 'A/B testing suggestions generated successfully',
      contentId,
      suggestions
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Brand Consistency Agent Operations
// ==========================================

/**
 * Review content for brand consistency
 */
exports.reviewContentForBrand = async (req, res, next) => {
  try {
    const { contentId, checkLevel, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.brandConsistency;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Brand Consistency Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Brand Consistency Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get content
    const content = await agentContainer.storage.getContent(contentId);
    
    if (!content) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${contentId}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    // Get consistency checker module
    const consistencyChecker = agent.getModule('consistencyChecker');
    
    if (!consistencyChecker) {
      return res.status(404).json({
        error: {
          message: 'Consistency Checker module not found',
          code: 'module_not_found'
        }
      });
    }
    
    // Check content
    const review = await consistencyChecker.check({
      content,
      level: checkLevel,
      userId
    });
    
    return res.status(200).json({
      message: 'Brand consistency check completed',
      contentId,
      review
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fix consistency issues
 */
exports.fixConsistencyIssues = async (req, res, next) => {
  try {
    const { contentId, issues, userId } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.brandConsistency;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Brand Consistency Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Brand Consistency Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Get content
    const content = await agentContainer.storage.getContent(contentId);
    
    if (!content) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${contentId}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    // Get consistency fixer module
    const consistencyFixer = agent.getModule('consistencyFixer');
    
    if (!consistencyFixer) {
      return res.status(404).json({
        error: {
          message: 'Consistency Fixer module not found',
          code: 'module_not_found'
        }
      });
    }
    
    // Fix issues
    const fixedContent = await consistencyFixer.fix({
      content,
      issues,
      userId
    });
    
    // Update content
    await agentContainer.storage.updateContent(contentId, {
      content: fixedContent.body || fixedContent,
      updatedAt: new Date(),
      updatedBy: userId
    });
    
    return res.status(200).json({
      message: 'Brand consistency issues fixed',
      contentId,
      content: fixedContent
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update brand guidelines
 */
exports.updateBrandGuidelines = async (req, res, next) => {
  try {
    const { type, content, updateBy } = req.body;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Agent container not available',
          code: 'agents_unavailable'
        }
      });
    }
    
    const agent = agentContainer.agents.brandConsistency;
    
    if (!agent) {
      return res.status(404).json({
        error: {
          message: 'Brand Consistency Agent not found',
          code: 'agent_not_found'
        }
      });
    }
    
    if (!agent.isRunning) {
      return res.status(400).json({
        error: {
          message: 'Brand Consistency Agent is not running',
          code: 'agent_not_running'
        }
      });
    }
    
    // Update brand guidelines
    await agentContainer.storage.updateBrandGuidelines({
      type,
      content,
      updatedAt: new Date(),
      updatedBy: updateBy || req.user.id
    });
    
    // Notify agent to refresh guidelines
    await agent.refreshGuidelines();
    
    return res.status(200).json({
      message: 'Brand guidelines updated successfully',
      type
    });
  } catch (error) {
    next(error);
  }
};