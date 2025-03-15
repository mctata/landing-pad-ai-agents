/**
 * End-to-End Content Workflow Test
 * 
 * This test verifies that all agents in the content creation workflow
 * function correctly in an integrated manner, from initial brief creation
 * to final optimized content.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const AgentInterface = require('../../../src/core/AgentInterface');
const BriefModel = require('../../../src/models/briefModel');
const ContentModel = require('../../../src/models/contentModel');
const WorkflowModel = require('../../../src/models/workflowModel');
const { coordinationService } = require('../../../src/core/coordination/coordinationService');
const agentFactory = require('../../../src/common/services/agent-factory');

// Mock the AIProviderService to prevent actual API calls
jest.mock('../../../src/common/services/ai-provider', () => ({
  generateText: jest.fn().mockImplementation(async (params) => {
    // Generate mock responses based on the prompt
    const prompt = typeof params.messages === 'string' 
      ? params.messages 
      : params.messages.find(m => m.role === 'user')?.content || '';
    
    if (prompt.includes('blog post') || prompt.includes('article')) {
      return {
        title: 'AI-Powered Website Building: The Future is Here',
        content: `<p>In the rapidly evolving digital landscape, website creation is undergoing a revolution. AI-powered tools are changing how businesses establish their online presence.</p>
          <h2>The Rise of AI Website Builders</h2>
          <p>Traditional website development required extensive coding knowledge or settling for template limitations. AI website builders bridge this gap.</p>
          <h2>Benefits for Small Businesses</h2>
          <p>Small business owners can now create professional websites without technical expertise or significant investment.</p>
          <h2>How AI Analyzes Your Needs</h2>
          <p>Modern AI tools can interpret your business requirements and automatically generate suitable designs and content.</p>
          <h2>The Future of Website Creation</h2>
          <p>As AI technology continues to advance, we can expect even more intuitive and powerful website creation tools.</p>`,
        meta_description: 'Discover how AI is revolutionizing website creation with intelligent tools that make professional web design accessible to everyone.',
        keywords: ['AI website builder', 'automated web design', 'small business websites']
      };
    } else if (prompt.includes('social media')) {
      return {
        linkedin: {
          content: 'The future of website building is here! Our new AI-powered tools help small businesses create professional websites in minutes, not months. No coding required. #AIWebsiteBuilder #DigitalTransformation',
          hashtags: ['AIWebsiteBuilder', 'SmallBusiness', 'WebDesign']
        },
        twitter: {
          content: 'Creating a website used to take weeks. With AI, it takes minutes. See how our AI website builder is changing the game for small businesses!',
          hashtags: ['AITools', 'WebDesign', 'SmallBiz']
        }
      };
    } else if (prompt.includes('SEO') || prompt.includes('optimization')) {
      return [
        'Add more specific keywords in H2 headings',
        'Include structured data markup for better search visibility',
        'Add alt text to all images',
        'Improve internal linking structure',
        'Create a more compelling meta description with call to action'
      ];
    } else if (prompt.includes('brand') || prompt.includes('consistency')) {
      return {
        consistent: false,
        score: 75,
        issues: [
          'Tone should be more conversational to match brand guidelines',
          'Missing mention of key product features',
          'Not using approved terminology for AI features'
        ],
        suggestions: [
          'Replace "AI-powered tools" with "Landing Pad\'s AI Assistant"',
          'Add mention of 24/7 support as per brand messaging guidelines',
          'Include testimonial section as recommended in content strategy'
        ]
      };
    } else {
      return 'Default test response for ' + prompt.substring(0, 30) + '...';
    }
  }),
  
  generateEmbeddings: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4])
}));

// Mock the message bus
jest.mock('../../../src/core/messaging/messageBus', () => ({
  getInstance: jest.fn().mockResolvedValue({
    initialize: jest.fn().mockResolvedValue(true),
    subscribeToEvent: jest.fn().mockResolvedValue({}),
    publishEvent: jest.fn().mockResolvedValue(true),
    publishCommand: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn().mockResolvedValue(true)
  })
}));

describe('End-to-End Content Workflow', () => {
  let mongoServer;
  
  beforeAll(async () => {
    // Create in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Initialize agent factory
    await agentFactory.initialize();
    
    // Initialize the agent interface
    await AgentInterface.initialize();
    
    // Initialize coordination service
    await coordinationService.initialize();
  });
  
  afterAll(async () => {
    // Disconnect from MongoDB and stop in-memory server
    await AgentInterface.shutdown();
    await coordinationService.shutdown();
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });
  
  it('should execute the full content creation workflow end-to-end', async () => {
    // Step 1: Content Strategy Agent creates a brief
    const briefData = {
      title: 'AI Website Building Guide',
      contentType: 'blog',
      topic: 'AI-powered website building',
      keywords: ['AI', 'website builder', 'small business'],
      targetAudience: 'Small business owners',
      tone: 'professional but approachable',
      requirements: 'Include examples and focus on benefits'
    };
    
    const briefResult = await AgentInterface.createContentBrief(briefData);
    expect(briefResult).toHaveProperty('brief_id');
    
    // Verify brief was saved
    const savedBrief = await BriefModel.findById(briefResult.brief_id);
    expect(savedBrief).not.toBeNull();
    expect(savedBrief.title).toBe(briefData.title);
    
    // Step 2: Content Creation Agent generates content from brief
    const contentResult = await AgentInterface.generateContent({
      briefId: briefResult.brief_id,
      type: 'blog'
    });
    
    expect(contentResult).toHaveProperty('content_id');
    
    // Verify content was created
    const savedContent = await ContentModel.findById(contentResult.content_id);
    expect(savedContent).not.toBeNull();
    expect(savedContent.type).toBe('blog');
    
    // Step 3: Brand Consistency Agent checks content
    const consistencyResult = await AgentInterface.checkBrandConsistency(contentResult.content_id);
    
    expect(consistencyResult).toHaveProperty('consistent');
    expect(consistencyResult).toHaveProperty('score');
    expect(consistencyResult).toHaveProperty('issues');
    
    // Step 4: Content Creation Agent revises content based on brand feedback
    await AgentInterface.sendCommand('content_creation', 'revise_content', {
      contentId: contentResult.content_id,
      revisionNotes: consistencyResult.suggestions
    });
    
    // Verify content was updated
    const revisedContent = await ContentModel.findById(contentResult.content_id);
    expect(revisedContent.version).toBeGreaterThan(savedContent.version);
    
    // Step 5: Optimization Agent generates SEO recommendations
    const seoResult = await AgentInterface.generateSeoRecommendations(contentResult.content_id);
    
    expect(seoResult).toHaveProperty('recommendations');
    expect(Array.isArray(seoResult.recommendations)).toBe(true);
    
    // Step 6: Content Creation Agent applies SEO recommendations
    await AgentInterface.sendCommand('content_creation', 'apply_seo', {
      contentId: contentResult.content_id,
      seoRecommendations: seoResult.recommendations
    });
    
    // Verify content was optimized
    const optimizedContent = await ContentModel.findById(contentResult.content_id);
    expect(optimizedContent.version).toBeGreaterThan(revisedContent.version);
    
    // Step 7: Generate social media content from the blog post
    const socialResult = await AgentInterface.generateSocialFromContent(
      contentResult.content_id,
      ['linkedin', 'twitter']
    );
    
    expect(socialResult).toHaveProperty('content_id');
    
    // Verify social content was created
    const socialContent = await ContentModel.findById(socialResult.content_id);
    expect(socialContent).not.toBeNull();
    expect(socialContent.type).toBe('social');
    expect(socialContent.sourceContent).toEqual(mongoose.Types.ObjectId(contentResult.content_id));
    
    // Step 8: Content Management Agent categorizes and schedules the content
    await AgentInterface.sendCommand('content_management', 'categorize_content', {
      contentId: contentResult.content_id
    });
    
    await AgentInterface.sendCommand('content_management', 'schedule_content', {
      contentId: contentResult.content_id,
      publishDate: new Date(Date.now() + 86400000) // Tomorrow
    });
    
    // Verify content was scheduled
    const scheduledContent = await ContentModel.findById(contentResult.content_id);
    expect(scheduledContent.publishDate).toBeDefined();
    expect(scheduledContent.categories).toBeDefined();
    expect(scheduledContent.categories.length).toBeGreaterThan(0);
  });
  
  it('should manage a content workflow using the workflow coordinator', async () => {
    // Arrange - Create content brief data
    const briefData = {
      topic: 'Building Websites with AI',
      contentType: 'blog',
      keywords: ['AI', 'website builder', 'no-code'],
      targetAudience: 'Small business owners'
    };
    
    // Act - Start content creation workflow
    const workflowResult = await AgentInterface.createContentWithWorkflow(briefData);
    
    // Assert - Workflow was created
    expect(workflowResult).toHaveProperty('workflowId');
    
    // Get workflow from database
    const workflow = await WorkflowModel.findById(workflowResult.workflowId);
    expect(workflow).not.toBeNull();
    expect(workflow.type).toBe('content-creation');
    expect(workflow.status).toBe('active');
    
    // Allow workflow to progress by waiting briefly
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Check workflow status
    const statusResult = await AgentInterface.getWorkflowStatus(workflowResult.workflowId);
    expect(statusResult).toHaveProperty('exists', true);
    expect(statusResult).toHaveProperty('progress');
    
    // Verify workflow has progressed through some steps
    expect(workflow.steps.some(step => step.status === 'completed')).toBe(true);
    
    // Verify content was eventually created by the workflow
    const content = await ContentModel.find({ workflow: workflow._id });
    expect(content.length).toBeGreaterThan(0);
  });
});