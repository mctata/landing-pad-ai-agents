/**
 * Content Strategy Agent
 * Analyzes audience data and trends to inform content decisions
 */

const BaseAgent = require('../../common/models/base-agent');

class ContentStrategyAgent extends BaseAgent {
  constructor(config, messaging, storage, logger, aiProvider) {
    super(config, messaging, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'content_strategy';
  }
  
  async initialize() {
    await super.initialize();
    
    // Subscribe to relevant events from other agents
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'optimisation.analysis_completed',
      this.handleOptimisationAnalysisEvent.bind(this)
    );
  }
  
  /**
   * Create a content brief based on the provided parameters
   */
  async handleCreateBriefCommand(command) {
    this.logger.info('Creating content brief', { type: command.payload.type });
    
    const { type, topic, targetAudience, keywords } = command.payload;
    
    // Get trend analyzer module
    const trendAnalyzer = this.modules.get('trend_analyzer');
    if (!trendAnalyzer) {
      throw new Error('Trend analyzer module not available');
    }
    
    // Get audience insights module
    const audienceInsights = this.modules.get('audience_insights');
    if (!audienceInsights) {
      throw new Error('Audience insights module not available');
    }
    
    // Get brief generator module
    const briefGenerator = this.modules.get('brief_generator');
    if (!briefGenerator) {
      throw new Error('Brief generator module not available');
    }
    
    // Analyze trends for the topic
    const trendData = await trendAnalyzer.analyzeTrend(topic, keywords);
    
    // Get audience insights for target audience
    const audienceData = await audienceInsights.getInsights(targetAudience);
    
    // Generate content brief
    const briefContent = await briefGenerator.generateBrief({
      type,
      topic,
      trendData,
      audienceData,
      keywords
    });
    
    // Create and save content brief
    const brief = {
      type,
      topic,
      targetAudience,
      keywords,
      content: briefContent,
      status: 'created',
      created_at: new Date(),
      created_by: command.payload.userId || 'system'
    };
    
    const result = await this.storage.collections.content_briefs.insertOne(brief);
    
    this.logger.info('Content brief created', { briefId: result.insertedId });
    
    // Notify other agents about new brief
    await this.publishEvent('brief_created', {
      brief_id: result.insertedId,
      type,
      topic
    });
    
    return {
      brief_id: result.insertedId,
      content: briefContent
    };
  }
  
  /**
   * Update an existing content brief
   */
  async handleUpdateBriefCommand(command) {
    const { briefId, updates } = command.payload;
    
    this.logger.info('Updating content brief', { briefId });
    
    const updateResult = await this.storage.collections.content_briefs.updateOne(
      { _id: this.storage.ObjectId(briefId) },
      { 
        $set: { 
          ...updates,
          updated_at: new Date(),
          updated_by: command.payload.userId || 'system'
        } 
      }
    );
    
    if (updateResult.matchedCount === 0) {
      throw new Error(`Brief not found: ${briefId}`);
    }
    
    this.logger.info('Content brief updated', { briefId });
    
    await this.publishEvent('brief_updated', {
      brief_id: briefId,
      updates: Object.keys(updates)
    });
    
    const updatedBrief = await this.storage.collections.content_briefs.findOne(
      { _id: this.storage.ObjectId(briefId) }
    );
    
    return { brief: updatedBrief };
  }
  
  /**
   * Generate a content calendar for a given time period
   */
  async handleGenerateCalendarCommand(command) {
    const { startDate, endDate, channels, numberOfItems } = command.payload;
    
    this.logger.info('Generating content calendar', { 
      startDate, 
      endDate, 
      channels,
      numberOfItems 
    });
    
    // Get trend analyzer for top topics
    const trendAnalyzer = this.modules.get('trend_analyzer');
    if (!trendAnalyzer) {
      throw new Error('Trend analyzer module not available');
    }
    
    // Get trending topics for the time period
    const trendingTopics = await trendAnalyzer.getTrendingTopics(
      new Date(startDate),
      new Date(endDate)
    );
    
    // Generate content ideas based on trending topics
    const contentIdeas = await this.aiProvider.generateText({
      provider: this.config.ai_model.provider,
      model: this.config.ai_model.model,
      messages: [
        {
          role: 'system',
          content: `You are a content strategist for Landing Pad Digital, a company that offers an AI-powered website builder. Generate content ideas that educate users about website creation and highlight Landing Pad Digital's capabilities.`
        },
        {
          role: 'user',
          content: `Generate ${numberOfItems} content ideas based on these trending topics: ${JSON.stringify(trendingTopics)}. 
          The content should be distributed across these channels: ${channels.join(', ')}.
          For each idea, include:
          - Title
          - Channel (${channels.join(', ')})
          - Brief description (2-3 sentences)
          - Main keywords
          - Target audience`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });
    
    // Create a structured calendar with evenly distributed content
    const calendar = {
      startDate,
      endDate,
      channels,
      items: this._distributeContentOnCalendar(
        contentIdeas, 
        new Date(startDate), 
        new Date(endDate), 
        channels
      ),
      created_at: new Date(),
      created_by: command.payload.userId || 'system'
    };
    
    // Save the calendar
    const result = await this.storage.collections.content_calendars.insertOne(calendar);
    
    this.logger.info('Content calendar generated', { calendarId: result.insertedId });
    
    return {
      calendar_id: result.insertedId,
      calendar
    };
  }
  
  /**
   * Analyze audience data for a specific segment
   */
  async handleAnalyzeAudienceCommand(command) {
    const { segment, dataSource } = command.payload;
    
    this.logger.info('Analyzing audience', { segment, dataSource });
    
    const audienceInsights = this.modules.get('audience_insights');
    if (!audienceInsights) {
      throw new Error('Audience insights module not available');
    }
    
    const insights = await audienceInsights.analyzeSegment(segment, dataSource);
    
    await this.publishEvent('audience_analyzed', {
      segment,
      insights_summary: insights.summary
    });
    
    return { insights };
  }
  
  /**
   * Research a trend for a specific topic
   */
  async handleResearchTrendCommand(command) {
    const { topic, timeframe } = command.payload;
    
    this.logger.info('Researching trend', { topic, timeframe });
    
    const trendAnalyzer = this.modules.get('trend_analyzer');
    if (!trendAnalyzer) {
      throw new Error('Trend analyzer module not available');
    }
    
    const trendData = await trendAnalyzer.analyzeTrend(topic, null, timeframe);
    
    await this.publishEvent('trend_researched', {
      topic,
      trend_summary: trendData.summary
    });
    
    return { trendData };
  }
  
  /**
   * Handle optimization analysis event from Optimisation Agent
   */
  async handleOptimisationAnalysisEvent(event) {
    this.logger.info('Received optimisation analysis event', { 
      contentId: event.payload.content_id 
    });
    
    // Extract performance data from event
    const { content_id, performance_metrics, recommendations } = event.payload;
    
    // Update our content strategy based on this new data
    if (recommendations && recommendations.length > 0) {
      // Store recommendations for future content planning
      await this.storage.collections.content_recommendations.insertOne({
        content_id,
        recommendations,
        metrics: performance_metrics,
        processed: false,
        created_at: new Date()
      });
      
      this.logger.info('Stored content recommendations for future planning', { 
        contentId: content_id,
        count: recommendations.length
      });
    }
  }
  
  /**
   * Distributes content ideas across a calendar based on channels and dates
   * @private
   */
  _distributeContentOnCalendar(contentIdeas, startDate, endDate, channels) {
    // Parse content ideas into structured format
    const ideas = this._parseContentIdeas(contentIdeas);
    
    // Group ideas by channel
    const ideasByChannel = {};
    for (const channel of channels) {
      ideasByChannel[channel] = ideas.filter(idea => 
        idea.channel.toLowerCase() === channel.toLowerCase()
      );
    }
    
    // Calculate date range and distribution
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const calendarItems = [];
    
    // Distribute content across the calendar
    for (const channel of channels) {
      const channelIdeas = ideasByChannel[channel] || [];
      const postsPerDay = {};
      
      // Define posting frequency based on channel
      let frequency = 1; // Default: post once every day
      if (channel.toLowerCase() === 'blog') {
        frequency = 3; // Post once every 3 days
      } else if (channel.toLowerCase() === 'social_media') {
        frequency = 0.5; // Post twice per day
      }
      
      // Distribute ideas for this channel
      for (let i = 0; i < channelIdeas.length; i++) {
        const idea = channelIdeas[i];
        // Calculate posting day
        const dayOffset = Math.round(i * frequency) % totalDays;
        const postDate = new Date(startDate);
        postDate.setDate(postDate.getDate() + dayOffset);
        
        // Determine time of day based on channel and existing posts that day
        const dateKey = postDate.toISOString().split('T')[0];
        postsPerDay[dateKey] = (postsPerDay[dateKey] || 0) + 1;
        
        // Calculate hour based on number of posts already on this day
        let hour = 9; // Default to 9am
        if (postsPerDay[dateKey] > 1) {
          // Spread additional posts throughout the day: 12pm, 3pm, 5pm
          const hourOptions = [12, 15, 17];
          hour = hourOptions[(postsPerDay[dateKey] - 2) % hourOptions.length];
        }
        
        // Set the time
        postDate.setHours(hour, 0, 0, 0);
        
        // Add to calendar
        calendarItems.push({
          ...idea,
          scheduled_date: postDate,
          status: 'planned'
        });
      }
    }
    
    // Sort by date
    return calendarItems.sort((a, b) => 
      a.scheduled_date.getTime() - b.scheduled_date.getTime()
    );
  }
  
  /**
   * Parse the AI-generated content ideas into a structured format
   * @private
   */
  _parseContentIdeas(contentIdeas) {
    // Simple parsing strategy - assumes content is in a readable format
    // This would be replaced with more robust parsing in production
    try {
      // Split by numbered items
      const itemRegex = /(\d+\.\s+[^\n]+(?:\n(?!\d+\.)[^\n]+)*)/g;
      const items = contentIdeas.match(itemRegex) || [];
      
      return items.map(item => {
        // Extract fields from the text
        const titleMatch = item.match(/Title:?\s+([^\n]+)/i);
        const channelMatch = item.match(/Channel:?\s+([^\n]+)/i);
        const descriptionMatch = item.match(/description:?\s+([^\n]+(?:\n(?!keywords|target)[^\n]+)*)/i);
        const keywordsMatch = item.match(/keywords:?\s+([^\n]+)/i);
        const audienceMatch = item.match(/audience:?\s+([^\n]+)/i);
        
        return {
          title: titleMatch ? titleMatch[1].trim() : 'Untitled Content',
          channel: channelMatch ? channelMatch[1].trim() : 'blog',
          description: descriptionMatch ? descriptionMatch[1].trim() : '',
          keywords: keywordsMatch ? keywordsMatch[1].split(',').map(k => k.trim()) : [],
          target_audience: audienceMatch ? audienceMatch[1].trim() : 'General'
        };
      });
    } catch (error) {
      this.logger.error('Error parsing content ideas:', error);
      // Fallback to empty array
      return [];
    }
  }
}

module.exports = ContentStrategyAgent;