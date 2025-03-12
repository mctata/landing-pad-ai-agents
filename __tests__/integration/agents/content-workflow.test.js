/**
 * Integration Tests for Content Creation Workflow
 * 
 * This test verifies that the content creation workflow functions end-to-end
 * with all agent interactions working properly.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const AgentInterface = require('../../../src/core/AgentInterface');
const ContentModel = require('../../../src/models/contentModel');
const BriefModel = require('../../../src/models/briefModel');
const WorkflowModel = require('../../../src/models/workflowModel');

// Mock the AIProviderService to prevent actual API calls
jest.mock('../../../src/common/services/ai-provider', () => {
  return {
    generateText: jest.fn().mockImplementation(async (params) => {
      // Generate mock responses based on the prompt
      const prompt = params.messages.find(m => m.role === 'user')?.content || '';
      
      if (prompt.includes('blog post')) {
        return {
          title: 'Test Blog Post Title',
          content: '<p>This is a test blog post content generated for integration testing.</p>',
          meta_description: 'Test meta description for blog post.'
        };
      } else if (prompt.includes('social media')) {
        return {
          linkedin: { content: 'Test LinkedIn post content', hashtags: ['test', 'integration'] },
          twitter: { content: 'Test Twitter post content', hashtags: ['test'] }
        };
      } else if (prompt.includes('SEO')) {
        return [
          'Use more keywords in headings',
          'Add meta description',
          'Improve content length'
        ];
      } else {
        return 'Default test response for ' + prompt.substring(0, 20) + '...';
      }
    }),
    generateEmbeddings: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4])
  };
});

describe('Content Creation Workflow Integration', () => {
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
    
    // Initialize the agent interface
    await AgentInterface.initialize();
  });
  
  afterAll(async () => {
    // Disconnect from MongoDB and stop in-memory server
    await mongoose.disconnect();
    await mongoServer.stop();
    
    // Shut down agent interface
    await AgentInterface.shutdown();
  });
  
  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });
  
  it('should create a content brief and generate content from it', async () => {
    // Arrange - Create brief data
    const briefData = {
      title: 'Test Content Brief',
      contentType: 'blog',
      topic: 'AI-powered website building',
      keywords: ['AI', 'website builder', 'automation'],
      targetAudience: 'Small business owners',
      tone: 'professional',
      requirements: 'Include examples and case studies'
    };
    
    // Act - Create brief through agent interface
    const briefResult = await AgentInterface.createContentBrief(briefData);
    
    // Assert - Brief was created
    expect(briefResult).toHaveProperty('brief_id');
    
    // Check database
    const savedBrief = await BriefModel.findOne({ _id: briefResult.brief_id });
    expect(savedBrief).not.toBeNull();
    expect(savedBrief.title).toBe(briefData.title);
    expect(savedBrief.contentType).toBe(briefData.contentType);
    
    // Act - Generate content from brief
    const contentResult = await AgentInterface.generateContent({
      briefId: briefResult.brief_id,
      type: 'blog'
    });
    
    // Assert - Content was created
    expect(contentResult).toHaveProperty('content_id');
    expect(contentResult).toHaveProperty('content');
    
    // Check database
    const savedContent = await ContentModel.findOne({ _id: contentResult.content_id });
    expect(savedContent).not.toBeNull();
    expect(savedContent.brief).toEqual(savedBrief._id);
    expect(savedContent.status).toBe('draft');
  });
  
  it('should run a complete content creation workflow', async () => {
    // Arrange - Create brief data
    const briefData = {
      topic: 'How to build a website with AI',
      type: 'blog',
      keywords: ['AI', 'website builder', 'no-code'],
      targetAudience: 'Small business owners'
    };
    
    // Act - Start workflow
    const workflowResult = await AgentInterface.createContentWithWorkflow(briefData);
    
    // Assert - Workflow was started
    expect(workflowResult).toHaveProperty('workflowId');
    
    // Get workflow instance
    const workflow = await WorkflowModel.findOne({ _id: workflowResult.workflowId });
    expect(workflow).not.toBeNull();
    expect(workflow.status).toBe('active');
    
    // Allow workflow to progress by waiting briefly
    // In a real test, we might use a mock timer or webhook
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check workflow status
    const statusResult = await AgentInterface.getWorkflowStatus(workflowResult.workflowId);
    expect(statusResult).toHaveProperty('exists', true);
    
    // Verify that content was created as part of the workflow
    const content = await ContentModel.findOne({ workflow: workflow._id });
    expect(content).not.toBeNull();
    expect(content.type).toBe('blog');
  });
  
  it('should optimize existing content with SEO recommendations', async () => {
    // Arrange - Create content
    const content = new ContentModel({
      title: 'Original Content Title',
      type: 'blog',
      content: '<p>This is the original content that needs optimization.</p>',
      status: 'published'
    });
    await content.save();
    
    // Act - Generate SEO recommendations
    const seoResult = await AgentInterface.generateSeoRecommendations(content._id.toString());
    
    // Assert - SEO recommendations were generated
    expect(seoResult).toHaveProperty('recommendations');
    expect(Array.isArray(seoResult.recommendations)).toBe(true);
    
    // Act - Apply optimizations
    const optimizeResult = await AgentInterface.optimizeContent(content._id.toString(), ['seo']);
    
    // Assert - Optimization workflow was started
    expect(optimizeResult).toHaveProperty('workflowId');
    
    // Allow optimization to process
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify content was updated
    const updatedContent = await ContentModel.findById(content._id);
    expect(updatedContent.version).toBeGreaterThan(content.version);
  });
  
  it('should generate social media content from existing content', async () => {
    // Arrange - Create blog content
    const content = new ContentModel({
      title: 'Blog Post for Social Sharing',
      type: 'blog',
      content: '<p>This is a blog post that will be shared on social media.</p>',
      status: 'published',
      keywords: ['test', 'social', 'sharing']
    });
    await content.save();
    
    // Act - Generate social media content
    const socialResult = await AgentInterface.generateSocialFromContent(
      content._id.toString(), 
      ['linkedin', 'twitter']
    );
    
    // Assert - Social content was generated
    expect(socialResult).toHaveProperty('content_id');
    expect(socialResult).toHaveProperty('platforms');
    expect(socialResult.platforms).toContain('linkedin');
    expect(socialResult.platforms).toContain('twitter');
    
    // Check database
    const socialContent = await ContentModel.findById(socialResult.content_id);
    expect(socialContent).not.toBeNull();
    expect(socialContent.type).toBe('social');
    expect(socialContent.sourceContent).toEqual(content._id);
  });
  
  it('should check content for brand consistency', async () => {
    // Arrange - Create content with some brand inconsistencies
    const content = new ContentModel({
      title: 'Content with Brand Issues',
      type: 'blog',
      content: '<p>This content uses incorrect terminology and doesn\'t match our style guide.</p>',
      status: 'draft'
    });
    await content.save();
    
    // Act - Check brand consistency
    const consistencyResult = await AgentInterface.checkBrandConsistency(content._id.toString());
    
    // Assert - Consistency check was performed
    expect(consistencyResult).toHaveProperty('consistent');
    expect(consistencyResult).toHaveProperty('score');
    expect(consistencyResult).toHaveProperty('issues');
    
    // If issues were found, content should be marked for revision
    if (consistencyResult.issues.length > 0) {
      const updatedContent = await ContentModel.findById(content._id);
      expect(updatedContent.reviewStatus).toBe('needs_revision');
    }
  });
});