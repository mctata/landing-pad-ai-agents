/**
 * Email Generator Module
 * Generates email content for newsletters, campaigns, and notifications
 */

const BaseModule = require('../../../common/models/base-module');

class EmailGenerator extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'email_generator';
    this.emailTypes = [
      'newsletter', 'welcome', 'promotional', 'transactional', 'announcement'
    ];
  }
  
  async initialize() {
    this.logger.info('Initializing email generator module');
    
    // Load brand voice guidelines
    try {
      const brandGuidelines = await this.storage.collections.brand_guidelines.findOne(
        { type: 'voice' }
      );
      
      if (brandGuidelines) {
        this.brandVoice = brandGuidelines.content;
        this.logger.info('Loaded brand voice guidelines');
      } else {
        this.brandVoice = 'Professional, informative, and helpful voice that positions Landing Pad Digital as an authority in website building.';
        this.logger.warn('Brand voice guidelines not found, using default');
      }
    } catch (error) {
      this.logger.error('Error loading brand voice guidelines:', error);
      this.brandVoice = 'Professional, informative, and helpful voice that positions Landing Pad Digital as an authority in website building.';
    }
    
    // Load email templates
    try {
      const templates = await this.storage.collections.email_templates.find().toArray();
      
      if (templates && templates.length > 0) {
        this.emailTemplates = templates.reduce((acc, template) => {
          acc[template.type] = template.content;
          return acc;
        }, {});
        this.logger.info('Loaded email templates', { count: templates.length });
      } else {
        this.emailTemplates = {
          newsletter: {
            subject: 'Latest Updates from Landing Pad Digital',
            header: 'Stay Updated with Landing Pad Digital',
            intro: 'Here are the latest updates from Landing Pad Digital.',
            sections: ['main_content', 'featured_article', 'call_to_action'],
            footer: 'You received this email because you subscribed to Landing Pad Digital updates.'
          },
          promotional: {
            subject: 'Special Offer from Landing Pad Digital',
            header: 'Limited Time Offer',
            intro: 'We have a special offer just for you!',
            sections: ['offer_details', 'benefits', 'call_to_action'],
            footer: 'This offer expires in [timeframe]. You received this email because you subscribed to Landing Pad Digital promotions.'
          }
        };
        this.logger.warn('Email templates not found, using defaults');
      }
    } catch (error) {
      this.logger.error('Error loading email templates:', error);
      this.emailTemplates = {
        newsletter: {
          subject: 'Latest Updates from Landing Pad Digital',
          header: 'Stay Updated with Landing Pad Digital',
          intro: 'Here are the latest updates from Landing Pad Digital.',
          sections: ['main_content', 'featured_article', 'call_to_action'],
          footer: 'You received this email because you subscribed to Landing Pad Digital updates.'
        },
        promotional: {
          subject: 'Special Offer from Landing Pad Digital',
          header: 'Limited Time Offer',
          intro: 'We have a special offer just for you!',
          sections: ['offer_details', 'benefits', 'call_to_action'],
          footer: 'This offer expires in [timeframe]. You received this email because you subscribed to Landing Pad Digital promotions.'
        }
      };
    }
  }
  
  /**
   * Generate email content based on a content brief
   * @param {Object} brief - Content brief with topic, email type, and other metadata
   * @returns {Object} Generated email content
   */
  async generate(brief) {
    const { 
      topic, 
      type = 'newsletter', 
      keywords = [], 
      target_audience, 
      call_to_action 
    } = brief;
    
    this.logger.info('Generating email content', { topic, type });
    
    // Validate email type
    const emailType = this.emailTypes.includes(type.toLowerCase()) 
      ? type.toLowerCase() 
      : 'newsletter';
    
    // Process audience information
    const audienceInfo = typeof target_audience === 'string' 
      ? target_audience 
      : JSON.stringify(target_audience || 'website owners and small businesses');
    
    // Get template for this email type
    const template = this.emailTemplates[emailType] || this.emailTemplates.newsletter;
    
    // Construct the prompt for the AI
    const systemPrompt = `
You are an email marketing specialist for Landing Pad Digital, a company that offers an AI-powered website builder platform. 
Write in the following brand voice: ${this.brandVoice}.

Your email should educate users about website creation and highlight Landing Pad Digital's AI website builder capabilities.

Focus on creating an engaging, professional email that follows these best practices:
1. Clear and compelling subject line
2. Concise paragraphs
3. Scannable format with headers and bullet points
4. Strong call-to-action
5. Professional tone that builds trust
    `;
    
    const userPrompt = `
Create a complete ${emailType} email about "${topic}".

Target audience: ${audienceInfo}
Keywords to include: ${keywords.join(', ')}
Primary call-to-action: ${call_to_action || 'Start building your website with our AI-powered platform'}

The email should include:
1. Subject line (compelling and under 60 characters)
2. Greeting
3. Introduction paragraph
4. Main content with proper formatting (2-3 paragraphs or sections)
5. Clear call-to-action
6. Professional closing

Format the email content with proper HTML for an email (simple formatting only: paragraphs, headers, bullet points, bold/italic for emphasis).
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });
      
      // Parse response to extract subject line and content
      const subjectLineMatch = response.match(/Subject:?\s*([^\n]+)/i) || 
                              response.match(/Subject Line:?\s*([^\n]+)/i);
      
      const subjectLine = subjectLineMatch 
        ? subjectLineMatch[1].trim() 
        : `${topic} - Landing Pad Digital`;
      
      // Remove subject line from content if present
      let htmlContent = response;
      if (subjectLineMatch) {
        htmlContent = response.replace(subjectLineMatch[0], '').trim();
      }
      
      // Check if the content has HTML structure, if not wrap in basic HTML
      if (!htmlContent.includes('<html') && !htmlContent.includes('<body')) {
        htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${htmlContent}
  <p style="margin-top: 30px; font-size: 12px; color: #777777;">
    © ${new Date().getFullYear()} Landing Pad Digital. All rights reserved.<br>
    You received this email because you subscribed to Landing Pad Digital updates.
  </p>
</body>
</html>
        `;
      }
      
      return {
        subject: subjectLine,
        html_content: htmlContent,
        email_type: emailType,
        topic,
        created_at: new Date(),
        keywords
      };
    } catch (error) {
      this.logger.error('Error generating email content:', error);
      throw new Error(`Failed to generate email content: ${error.message}`);
    }
  }
  
  /**
   * Generate an email newsletter with multiple articles
   * @param {Object} brief - Newsletter brief
   * @returns {Object} Generated newsletter
   */
  async generateNewsletter(brief) {
    const { 
      title, 
      articles = [], 
      primary_cta, 
      target_audience,
      intro_text
    } = brief;
    
    this.logger.info('Generating newsletter', { title });
    
    // Process audience information
    const audienceInfo = typeof target_audience === 'string' 
      ? target_audience 
      : JSON.stringify(target_audience || 'website owners and small businesses');
    
    // Construct the prompt for the AI
    const systemPrompt = `
You are a newsletter content specialist for Landing Pad Digital, a company that offers an AI-powered website builder platform.
Write in the following brand voice: ${this.brandVoice}.

Your task is to craft a professional newsletter that engages subscribers and highlights the company's AI website builder capabilities.
    `;
    
    // Create a structured representation of the articles
    const articlesText = articles.map((article, index) => `
Article ${index + 1}:
Title: ${article.title}
Summary: ${article.summary || 'No summary provided'}
Link: ${article.link || '#'}
    `).join('\n');
    
    const userPrompt = `
Create a complete HTML newsletter titled "${title}".

Target audience: ${audienceInfo}
Introduction text: ${intro_text || 'Welcome to our latest newsletter'}
Primary call-to-action: ${primary_cta || 'Start building your website with our AI-powered platform'}

The newsletter should include these articles:
${articlesText}

For each article, create:
1. A brief compelling description (2-3 sentences)
2. A "Read More" link

The newsletter should have:
1. An engaging introduction (2-3 sentences)
2. Featured articles section
3. A tips section with 1-2 quick website building tips
4. A strong call-to-action section
5. A professional footer

Format the newsletter with clean, simple HTML suitable for email (tables, divs, basic styling).
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 3000
      });
      
      // Extract subject line if present
      const subjectLineMatch = response.match(/Subject:?\s*([^\n]+)/i) || 
                              response.match(/Subject Line:?\s*([^\n]+)/i);
      
      const subjectLine = subjectLineMatch 
        ? subjectLineMatch[1].trim() 
        : title;
      
      // Clean up the HTML content
      let htmlContent = response;
      if (subjectLineMatch) {
        htmlContent = response.replace(subjectLineMatch[0], '').trim();
      }
      
      // Ensure HTML has proper structure
      if (!htmlContent.includes('<html') && !htmlContent.includes('<body')) {
        htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${htmlContent}
  <p style="margin-top: 30px; font-size: 12px; color: #777777;">
    © ${new Date().getFullYear()} Landing Pad Digital. All rights reserved.<br>
    You received this email because you subscribed to Landing Pad Digital updates.<br>
    <a href="#" style="color: #777777;">Unsubscribe</a> | <a href="#" style="color: #777777;">View in browser</a>
  </p>
</body>
</html>
        `;
      }
      
      return {
        subject: subjectLine,
        html_content: htmlContent,
        email_type: 'newsletter',
        title,
        articles: articles.map(article => article.title),
        created_at: new Date()
      };
    } catch (error) {
      this.logger.error('Error generating newsletter:', error);
      throw new Error(`Failed to generate newsletter: ${error.message}`);
    }
  }
  
  /**
   * Generate email subject line variations
   * @param {string} topic - Email topic
   * @param {string} type - Email type
   * @param {number} count - Number of variations to generate
   * @returns {Array} Subject line variations
   */
  async generateSubjectLines(topic, type = 'newsletter', count = 5) {
    this.logger.info('Generating email subject lines', { topic, type, count });
    
    const promptText = `
Generate ${count} compelling email subject lines for a ${type} email about "${topic}".

The subject lines should:
1. Be attention-grabbing but not clickbait
2. Be 40-60 characters in length
3. Create curiosity or highlight value
4. Align with Landing Pad Digital's professional brand voice
5. Encourage recipients to open the email

Format your response as a numbered list of subject lines only.
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'user', content: promptText }
        ],
        temperature: 0.8,
        max_tokens: 1000
      });
      
      // Extract subject lines
      const subjectLines = [];
      const lines = response.split('\n').filter(line => line.trim().length > 0);
      
      for (const line of lines) {
        // Remove numbering and trim
        const cleanLine = line.replace(/^\d+[\.\)]\s*/, '').trim();
        
        if (cleanLine.length > 0) {
          subjectLines.push(cleanLine);
          if (subjectLines.length >= count) break;
        }
      }
      
      return subjectLines.map(subject => ({
        subject,
        character_count: subject.length,
        email_type: type,
        topic
      }));
    } catch (error) {
      this.logger.error('Error generating email subject lines:', error);
      throw new Error(`Failed to generate subject lines: ${error.message}`);
    }
  }
  
  /**
   * Generate email sections based on a template
   * @param {string} templateType - Type of email template
   * @param {Object} content - Content for the sections
   * @returns {Object} Structured email sections
   */
  async generateEmailSections(templateType, content) {
    this.logger.info('Generating email sections', { templateType });
    
    // Get template
    const template = this.emailTemplates[templateType] || this.emailTemplates.newsletter;
    
    // Generate each section
    const sections = {};
    
    for (const sectionName of template.sections) {
      const sectionContent = content[sectionName] || '';
      
      sections[sectionName] = await this._generateSection(
        templateType,
        sectionName,
        sectionContent
      );
    }
    
    return {
      subject: content.subject || template.subject,
      header: content.header || template.header,
      intro: content.intro || template.intro,
      sections,
      footer: content.footer || template.footer,
      email_type: templateType
    };
  }
  
  /**
   * Generate a single email section
   * @private
   */
  async _generateSection(templateType, sectionName, content) {
    const promptText = `
Create content for the "${sectionName}" section of a ${templateType} email.

${content ? `Use this content as the basis: ${content}` : 'Create content from scratch that would make sense for this section.'}

The content should:
1. Be concise and engaging
2. Use appropriate formatting for an email (paragraphs, bullet points)
3. Match Landing Pad Digital's professional brand voice
4. Focus on the value of our AI website builder platform

Provide only the content for this section, properly formatted with simple HTML.
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'user', content: promptText }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error(`Error generating ${sectionName} section:`, error);
      return `<p>Error generating content for ${sectionName}.</p>`;
    }
  }
}

module.exports = EmailGenerator;