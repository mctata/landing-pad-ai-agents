/**
 * Content Controller
 * Handles API endpoints for content management
 */

/**
 * List content with optional filters
 */
exports.listContent = async (req, res, next) => {
  try {
    const {
      type,
      status,
      category,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Storage service not available',
          code: 'storage_unavailable'
        }
      });
    }
    
    // Build filter
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (category) filter.categories = { $in: [category] };
    
    // Add pagination and sorting
    const options = {
      skip: (page - 1) * limit,
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };
    
    // Get content
    const contents = await agentContainer.storage.getAllContents(filter, options);
    
    // Get total count for pagination
    const total = await agentContainer.storage.countContents(filter);
    
    return res.status(200).json({
      contents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get content by ID
 */
exports.getContent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Storage service not available',
          code: 'storage_unavailable'
        }
      });
    }
    
    // Get content
    const content = await agentContainer.storage.getContent(id);
    
    if (!content) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${id}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    return res.status(200).json(content);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new content
 */
exports.createContent = async (req, res, next) => {
  try {
    const {
      type,
      title,
      content,
      meta_description,
      keywords,
      categories,
      status,
      userId
    } = req.body;
    
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Storage service not available',
          code: 'storage_unavailable'
        }
      });
    }
    
    // Create content
    const contentId = await agentContainer.storage.storeContent({
      type,
      title,
      content,
      meta_description,
      keywords,
      categories,
      status,
      createdAt: new Date(),
      createdBy: userId || req.user.id
    });
    
    // If content is not draft, run it through brand consistency check
    if (status !== 'draft' && agentContainer.agents.brandConsistency) {
      try {
        const brandAgent = agentContainer.agents.brandConsistency;
        if (brandAgent.isRunning) {
          const consistencyChecker = brandAgent.getModule('consistencyChecker');
          if (consistencyChecker) {
            // Run consistency check in background
            consistencyChecker.check({
              contentId,
              level: 'normal',
              userId: userId || req.user.id
            }).catch(error => {
              req.app.locals.logger.error('Error in background brand consistency check:', error);
            });
          }
        }
      } catch (error) {
        // Don't fail the request if brand check fails
        req.app.locals.logger.error('Error initiating brand consistency check:', error);
      }
    }
    
    return res.status(201).json({
      message: 'Content created successfully',
      contentId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update content
 */
exports.updateContent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      meta_description,
      keywords,
      categories,
      status,
      userId
    } = req.body;
    
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Storage service not available',
          code: 'storage_unavailable'
        }
      });
    }
    
    // Check if content exists
    const existingContent = await agentContainer.storage.getContent(id);
    
    if (!existingContent) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${id}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    // Build update object with only provided fields
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (meta_description !== undefined) updateData.meta_description = meta_description;
    if (keywords !== undefined) updateData.keywords = keywords;
    if (categories !== undefined) updateData.categories = categories;
    if (status !== undefined) updateData.status = status;
    
    // Add update metadata
    updateData.updatedAt = new Date();
    updateData.updatedBy = userId || req.user.id;
    
    // Store previous version in history
    await agentContainer.storage.addContentHistory({
      contentId: id,
      previousVersion: existingContent,
      updatedAt: updateData.updatedAt,
      updatedBy: updateData.updatedBy
    });
    
    // Update content
    await agentContainer.storage.updateContent(id, updateData);
    
    // If status is changing to pending_review or published, run brand consistency check
    if (
      (status === 'pending_review' || status === 'published') &&
      existingContent.status !== status &&
      agentContainer.agents.brandConsistency
    ) {
      try {
        const brandAgent = agentContainer.agents.brandConsistency;
        if (brandAgent.isRunning) {
          const consistencyChecker = brandAgent.getModule('consistencyChecker');
          if (consistencyChecker) {
            // Run consistency check in background
            consistencyChecker.check({
              contentId: id,
              level: 'normal',
              userId: userId || req.user.id
            }).catch(error => {
              req.app.locals.logger.error('Error in background brand consistency check:', error);
            });
          }
        }
      } catch (error) {
        // Don't fail the request if brand check fails
        req.app.locals.logger.error('Error initiating brand consistency check:', error);
      }
    }
    
    return res.status(200).json({
      message: 'Content updated successfully',
      contentId: id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete content
 */
exports.deleteContent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Storage service not available',
          code: 'storage_unavailable'
        }
      });
    }
    
    // Check if content exists
    const existingContent = await agentContainer.storage.getContent(id);
    
    if (!existingContent) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${id}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    // Store in archive before deletion
    await agentContainer.storage.archiveContent(id, {
      archivedAt: new Date(),
      archivedBy: req.user.id,
      reason: req.query.reason || 'manual_deletion'
    });
    
    // Delete content
    await agentContainer.storage.deleteContent(id);
    
    return res.status(200).json({
      message: 'Content deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get content history
 */
exports.getContentHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Storage service not available',
          code: 'storage_unavailable'
        }
      });
    }
    
    // Check if content exists
    const existingContent = await agentContainer.storage.getContent(id);
    
    if (!existingContent) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${id}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    // Get content history
    const history = await agentContainer.storage.getContentHistory(id);
    
    return res.status(200).json({
      contentId: id,
      history
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get content analytics
 */
exports.getContentAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { timeframe = 'month' } = req.query;
    
    const agentContainer = req.app.locals.agentContainer;
    
    if (!agentContainer) {
      return res.status(503).json({
        error: {
          message: 'Analytics service not available',
          code: 'analytics_unavailable'
        }
      });
    }
    
    // Check if content exists
    const existingContent = await agentContainer.storage.getContent(id);
    
    if (!existingContent) {
      return res.status(404).json({
        error: {
          message: `Content with ID '${id}' not found`,
          code: 'content_not_found'
        }
      });
    }
    
    // Use the optimization agent to get analytics if available
    let analytics = null;
    
    if (agentContainer.agents.optimisation) {
      try {
        const optAgent = agentContainer.agents.optimisation;
        if (optAgent.isRunning) {
          const performanceAnalyzer = optAgent.getModule('performanceAnalyzer');
          if (performanceAnalyzer) {
            analytics = await performanceAnalyzer.analyze({
              contentId: id,
              timeframe,
              userId: req.user.id
            });
          }
        }
      } catch (error) {
        req.app.locals.logger.error('Error getting content analytics:', error);
        // Continue and try to get basic analytics
      }
    }
    
    // If no analytics from agent, get basic analytics from storage
    if (!analytics) {
      analytics = await agentContainer.storage.getContentAnalytics(id, timeframe);
    }
    
    return res.status(200).json({
      contentId: id,
      timeframe,
      analytics
    });
  } catch (error) {
    next(error);
  }
};