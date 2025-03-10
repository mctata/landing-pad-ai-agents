// examples/content-creation-workflow.js
const { getInstance: getMessageBus } = require('../src/core/messaging/messageBus');
const { getInstance: getCoordinationService } = require('../src/core/coordination/coordinationService');
const { getInstance: getSharedDataStore } = require('../src/core/data/sharedDataStore');
const logger = require('../src/core/utils/logger');

/**
 * This example demonstrates a complete content creation workflow
 * from strategy to publication with all five agents interacting.
 */
async function runContentCreationWorkflow() {
  logger.info('Starting content creation workflow example');
  
  // Connect to services
  const messageBus = await getMessageBus();
  const coordinationService = await getCoordinationService();
  const sharedDataStore = await getSharedDataStore();
  
  try {
    // Create a new content item
    const contentId = await sharedDataStore.createContent({
      title: 'Example Blog Post',
      description: 'A demonstration of the content creation workflow',
      contentType: 'blog-post',
      tags: ['example', 'workflow', 'demonstration'],
      createdBy: 'example-script'
    });
    
    logger.info(`Created content with ID: ${contentId}`);
    
    // Subscribe to workflow events for this content
    const workflowEventSubscription = await messageBus.subscribeToEvent('workflow.#', (data, metadata) => {
      if (data.contentId === contentId) {
        logger.info(`Workflow event: ${metadata.routingKey}`, data);
      }
    });
    
    // Subscribe to content events for this content
    const contentEventSubscription = await messageBus.subscribeToEvent('content.#', (data, metadata) => {
      if (data.contentId === contentId) {
        logger.info(`Content event: ${metadata.routingKey}`, data);
      }
    });
    
    // Start a content creation workflow
    const workflowResult = await coordinationService.startWorkflow('content-creation', {
      contentId,
      targetAudience: 'developers',
      contentGoal: 'educational',
      keyTopics: ['system architecture', 'messaging', 'agent coordination'],
      priority: 3
    });
    
    logger.info(`Started workflow with ID: ${workflowResult.workflowId}`);
    
    // Simulate agent responses to demonstrate workflow transitions
    
    // 1. Content Strategy Agent response
    setTimeout(async () => {
      logger.info('Simulating Content Strategy Agent response');
      
      await messageBus.publishEvent('agent.task-completed', {
        agentId: 'content-strategy',
        workflowId: workflowResult.workflowId,
        taskType: 'strategy-planning',
        result: {
          contentStructure: [
            { section: 'Introduction', wordCount: 200 },
            { section: 'Understanding Agent Architecture', wordCount: 400 },
            { section: 'The Role of Message Bus', wordCount: 300 },
            { section: 'Coordination Patterns', wordCount: 350 },
            { section: 'Best Practices', wordCount: 250 },
            { section: 'Conclusion', wordCount: 150 }
          ],
          seoKeywords: ['AI agents', 'message bus', 'workflow coordination', 'system integration'],
          contentTone: 'professional but approachable',
          estimatedReadTime: '8 minutes'
        },
        transitionType: 'success'
      });
    }, 2000);
    
    // 2. Content Creation Agent response
    setTimeout(async () => {
      logger.info('Simulating Content Creation Agent response');
      
      // Update content with the created draft
      await sharedDataStore.updateContent(contentId, {
        body: `# Building Effective AI Agent Systems\n\n## Introduction\nAI agent systems represent the future of content management and delivery...`,
        status: 'draft-completed'
      }, 'content-creation-agent');
      
      await messageBus.publishEvent('agent.task-completed', {
        agentId: 'content-creation',
        workflowId: workflowResult.workflowId,
        taskType: 'content-creation',
        result: {
          contentId,
          wordCount: 1650,
          readabilityScore: 72,
          keywordDensity: 1.8,
          links: 5,
          images: 2
        },
        transitionType: 'success'
      });
    }, 4000);
    
    // 3. Content Management Agent response
    setTimeout(async () => {
      logger.info('Simulating Content Management Agent response');
      
      await messageBus.publishEvent('agent.task-completed', {
        agentId: 'content-management',
        workflowId: workflowResult.workflowId,
        taskType: 'content-management',
        result: {
          contentId,
          categorized: true,
          storedLocation: 'blog/technology',
          tags: ['ai', 'architecture', 'integration', 'workflow', 'tutorial'],
          relatedContent: ['content-123', 'content-456']
        },
        transitionType: 'success'
      });
    }, 6000);
    
    // 4. Optimisation Agent response
    setTimeout(async () => {
      logger.info('Simulating Optimisation Agent response');
      
      // Update content with optimizations
      await sharedDataStore.updateContent(contentId, {
        body: `# Building Effective AI Agent Systems\n\n## Introduction\nAI agent systems represent the next generation of intelligent content management...`,
        status: 'optimized'
      }, 'optimisation-agent');
      
      await messageBus.publishEvent('agent.task-completed', {
        agentId: 'optimisation',
        workflowId: workflowResult.workflowId,
        taskType: 'content-optimization',
        result: {
          contentId,
          optimizations: [
            { type: 'seo', score: 85 },
            { type: 'readability', score: 88 },
            { type: 'engagement', score: 79 }
          ],
          improvementSuggestions: [
            'Added more transition words',
            'Optimized meta description',
            'Improved heading hierarchy',
            'Enhanced call-to-action'
          ]
        },
        transitionType: 'success'
      });
    }, 8000);
    
    // 5. Brand Consistency Agent response
    setTimeout(async () => {
      logger.info('Simulating Brand Consistency Agent response');
      
      await messageBus.publishEvent('agent.task-completed', {
        agentId: 'brand-consistency',
        workflowId: workflowResult.workflowId,
        taskType: 'brand-consistency-check',
        result: {
          contentId,
          consistent: true,
          brandScore: 92,
          toneMatch: 'high',
          valueAlignment: 'excellent',
          visualGuidelines: 'met'
        },
        transitionType: 'consistent'
      });
      
      // Update content to published state
      await sharedDataStore.updateContent(contentId, {
        status: 'published',
        publishedAt: new Date().toISOString()
      }, 'brand-consistency-agent');
    }, 10000);
    
    // Wait for workflow to complete
    logger.info('Waiting for workflow to complete...');
    
    // Check workflow status periodically
    const checkInterval = setInterval(async () => {
      const status = await coordinationService.getWorkflowStatus(workflowResult.workflowId);
      
      if (status.status === 'completed') {
        clearInterval(checkInterval);
        
        // Get final content
        const content = await sharedDataStore.getContent(contentId);
        logger.info('Workflow completed successfully!');
        logger.info('Final content:', content);
        
        // Unsubscribe from events
        await workflowEventSubscription.unsubscribe();
        await contentEventSubscription.unsubscribe();
        
        // Close connections
        await messageBus.close();
        await sharedDataStore.close();
        await coordinationService.shutdown();
        
        logger.info('Example completed!');
        process.exit(0);
      } else if (status.status === 'failed') {
        clearInterval(checkInterval);
        logger.error('Workflow failed!', status);
        process.exit(1);
      }
    }, 2000);
    
    // Set timeout for the entire demo
    setTimeout(() => {
      logger.warn('Example timed out after 30 seconds');
      process.exit(0);
    }, 30000);
    
  } catch (error) {
    logger.error('Error running example:', error);
    process.exit(1);
  }
}

// Run the example if executed directly
if (require.main === module) {
  runContentCreationWorkflow().catch(error => {
    console.error('Failed to run example:', error);
    process.exit(1);
  });
}

module.exports = runContentCreationWorkflow;
