/**
 * Unit tests for EmailGenerator Module
 */

const EmailGenerator = require('../../../../../src/agents/content_creation/modules/email-generator');

// Mock dependencies
jest.mock('../../../../../src/common/services/logger', () => {
  return {
    getLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn().mockReturnThis()
    })
  };
});

describe('EmailGenerator Module', () => {
  let emailGenerator;
  let mockStorage;
  let mockLogger;
  let mockAIProvider;
  let mockConfig;

  beforeEach(() => {
    // Create mock dependencies
    mockStorage = {
      collections: {
        brand_guidelines: {
          findOne: jest.fn().mockResolvedValue({
            type: 'voice',
            content: 'Test brand voice for emails.'
          })
        },
        email_templates: {
          find: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([
              {
                type: 'newsletter',
                content: {
                  subject: 'Test Newsletter',
                  header: 'Test Header',
                  intro: 'Test Intro',
                  sections: ['main_content', 'call_to_action'],
                  footer: 'Test Footer'
                }
              }
            ])
          })
        }
      }
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockAIProvider = {
      generateText: jest.fn().mockResolvedValue('Generated email content with <p>paragraphs</p> and formatting.')
    };

    mockConfig = {
      ai_model: {
        provider: 'test-provider',
        model: 'test-model'
      }
    };

    // Create email generator instance
    emailGenerator = new EmailGenerator(mockConfig, mockStorage, mockLogger, mockAIProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values if storage fails', async () => {
    // Arrange
    mockStorage.collections.brand_guidelines.findOne.mockRejectedValue(new Error('DB error'));
    mockStorage.collections.email_templates.find.mockReturnValue({
      toArray: jest.fn().mockRejectedValue(new Error('DB error'))
    });

    // Act
    await emailGenerator.initialize();

    // Assert
    expect(mockLogger.error).toHaveBeenCalledTimes(2);
    expect(emailGenerator.brandVoice).toBe('Professional, informative, and helpful voice that positions Landing Pad Digital as an authority in website building.');
    expect(emailGenerator.emailTemplates).toHaveProperty('newsletter');
    expect(emailGenerator.emailTemplates).toHaveProperty('promotional');
  });

  it('should generate email content based on a brief', async () => {
    // Arrange
    await emailGenerator.initialize();

    const brief = {
      topic: 'AI Website Building',
      type: 'newsletter',
      keywords: ['AI', 'websites', 'automation'],
      target_audience: 'Small business owners',
      call_to_action: 'Sign up today'
    };

    // Mock the AI response to include a subject line
    mockAIProvider.generateText.mockResolvedValue('Subject: Great Email Subject\n\nHere is the email content');

    // Act
    const result = await emailGenerator.generate(brief);

    // Assert
    expect(mockAIProvider.generateText).toHaveBeenCalledTimes(1);
    expect(mockAIProvider.generateText).toHaveBeenCalledWith(expect.objectContaining({
      provider: mockConfig.ai_model.provider,
      model: mockConfig.ai_model.model,
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user' })
      ])
    }));

    expect(result).toHaveProperty('subject', 'Great Email Subject');
    expect(result).toHaveProperty('html_content');
    expect(result).toHaveProperty('email_type', 'newsletter');
    expect(result).toHaveProperty('topic', 'AI Website Building');
    expect(result).toHaveProperty('created_at');
    expect(result).toHaveProperty('keywords', ['AI', 'websites', 'automation']);
  });

  it('should generate a newsletter with multiple articles', async () => {
    // Arrange
    await emailGenerator.initialize();

    const brief = {
      title: 'Monthly Website Building Tips',
      articles: [
        { title: 'Article 1', summary: 'Summary 1', link: 'link1' },
        { title: 'Article 2', summary: 'Summary 2', link: 'link2' }
      ],
      primary_cta: 'Build your site now',
      target_audience: 'Web developers'
    };

    // Mock the AI response
    mockAIProvider.generateText.mockResolvedValue('Subject: Monthly Newsletter\n\n<html><body>Newsletter content</body></html>');

    // Act
    const result = await emailGenerator.generateNewsletter(brief);

    // Assert
    expect(mockAIProvider.generateText).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty('subject', 'Monthly Newsletter');
    expect(result).toHaveProperty('html_content');
    expect(result).toHaveProperty('email_type', 'newsletter');
    expect(result).toHaveProperty('title', 'Monthly Website Building Tips');
    expect(result).toHaveProperty('articles');
    expect(result.articles).toHaveLength(2);
    expect(result.articles[0]).toBe('Article 1');
  });

  it('should generate subject line variations', async () => {
    // Arrange
    await emailGenerator.initialize();

    // Mock the AI response
    mockAIProvider.generateText.mockResolvedValue('1. First subject line\n2. Second subject line\n3. Third subject line');

    // Act
    const result = await emailGenerator.generateSubjectLines('AI Website Builder', 'promotional', 3);

    // Assert
    expect(mockAIProvider.generateText).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('subject', 'First subject line');
    expect(result[1]).toHaveProperty('subject', 'Second subject line');
    expect(result[2]).toHaveProperty('subject', 'Third subject line');
    expect(result[0]).toHaveProperty('email_type', 'promotional');
    expect(result[0]).toHaveProperty('topic', 'AI Website Builder');
  });

  it('should generate email sections based on a template', async () => {
    // Arrange
    await emailGenerator.initialize();

    // Create a spy on the private method
    emailGenerator._generateSection = jest.fn().mockResolvedValue('<p>Generated section content</p>');

    const content = {
      subject: 'Custom Subject',
      header: 'Custom Header',
      main_content: 'Main content text',
      call_to_action: 'Click here now'
    };

    // Act
    const result = await emailGenerator.generateEmailSections('newsletter', content);

    // Assert
    expect(emailGenerator._generateSection).toHaveBeenCalledTimes(2); // For each section in template
    expect(result).toHaveProperty('subject', 'Custom Subject');
    expect(result).toHaveProperty('header', 'Test Header'); // From the mock template
    expect(result).toHaveProperty('sections');
    expect(result.sections).toHaveProperty('main_content');
    expect(result.sections).toHaveProperty('call_to_action');
  });

  it('should handle errors properly when generating email content', async () => {
    // Arrange
    await emailGenerator.initialize();

    const brief = {
      topic: 'AI Website Building',
      type: 'newsletter'
    };

    // Mock the AI provider to throw an error
    mockAIProvider.generateText.mockRejectedValue(new Error('AI service unavailable'));

    // Act & Assert
    await expect(emailGenerator.generate(brief)).rejects.toThrow('Failed to generate email content');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should properly parse email content with subject line', async () => {
    // Arrange
    await emailGenerator.initialize();

    const brief = { topic: 'Test Topic', type: 'newsletter' };
    
    // Mock response with different subject line format
    mockAIProvider.generateText.mockResolvedValue('Subject Line: This is a test subject\n\nEmail body content here.');

    // Act
    const result = await emailGenerator.generate(brief);

    // Assert
    expect(result.subject).toBe('This is a test subject');
    expect(result.html_content).toContain('Email body content here.');
    expect(result.html_content).not.toContain('Subject Line:');
  });

  it('should wrap content in HTML structure when none is provided', async () => {
    // Arrange
    await emailGenerator.initialize();

    const brief = { topic: 'Test Topic', type: 'newsletter' };
    
    // Mock response with just text
    mockAIProvider.generateText.mockResolvedValue('Just plain text content without HTML');

    // Act
    const result = await emailGenerator.generate(brief);

    // Assert
    expect(result.html_content).toContain('<!DOCTYPE html>');
    expect(result.html_content).toContain('<html>');
    expect(result.html_content).toContain('<body');
    expect(result.html_content).toContain('Just plain text content without HTML');
  });
});