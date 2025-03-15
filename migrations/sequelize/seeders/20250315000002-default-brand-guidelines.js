'use strict';
const { nanoid } = require('nanoid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get admin user
    const adminUser = await queryInterface.sequelize.query(
      `SELECT user_id FROM users WHERE email = 'admin@landingpad.ai' LIMIT 1;`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    if (!adminUser || adminUser.length === 0) {
      console.error('Admin user not found. Please run the admin user seed first.');
      return;
    }
    
    const adminId = adminUser[0].user_id;
    const timestamp = new Date();
    
    // Define default brand guidelines
    return queryInterface.bulkInsert('brand_guidelines', [{
      guideline_id: nanoid(),
      version: '1.0.0',
      company_name: JSON.stringify({
        full: 'Landing Pad Digital',
        short: 'Landing Pad',
        abbreviation: 'LPD'
      }),
      product_names: JSON.stringify([
        {
          name: 'AI Agent Framework',
          description: 'Our core AI agent framework for content operations'
        },
        {
          name: 'Content Strategy Suite',
          description: 'Advanced content strategy and planning tools'
        }
      ]),
      voice: JSON.stringify({
        tone: 'Professional yet approachable',
        persona: 'Knowledgeable guide',
        values: ['Clarity', 'Innovation', 'Helpfulness', 'Expertise'],
        qualities: [
          'Clear and direct communication',
          'Avoids jargon unless necessary',
          'Supportive and solution-oriented',
          'Data-driven and analytical when appropriate'
        ]
      }),
      terminology: JSON.stringify({
        preferred: {
          'artificial intelligence': 'AI',
          'machine learning': 'ML',
          'ai agents': 'AI agents',
          'content operations': 'content ops',
          'search engine optimization': 'SEO'
        },
        avoid: [
          'robot',
          'bots',
          'automated content',
          'algorithm-generated',
          'robotic process automation'
        ],
        industry_terms: [
          'content strategy',
          'content calendar',
          'SEO',
          'conversion rate',
          'engagement metrics',
          'audience segmentation'
        ]
      }),
      logo_usage: JSON.stringify({
        primary_logo: 'landing-pad-full-color.svg',
        alternative_logos: ['landing-pad-monochrome.svg', 'landing-pad-icon-only.svg'],
        minimum_size: '30px height',
        clear_space: '20px on all sides',
        placement: 'Prefer top left for web, centered for print materials'
      }),
      color_palette: JSON.stringify({
        primary: {
          blue: '#0056B3',
          green: '#00B371'
        },
        secondary: {
          lightBlue: '#E0F4FF',
          lightGreen: '#E0FFF4',
          gray: '#464646'
        },
        neutral: {
          white: '#FFFFFF',
          lightGray: '#F5F5F5',
          mediumGray: '#CCCCCC',
          darkGray: '#333333',
          black: '#000000'
        },
        usage: 'Primary colors for headers and CTAs, secondary colors for accents, neutral colors for backgrounds and text'
      }),
      typography: JSON.stringify({
        primary_font: 'Inter',
        secondary_font: 'Merriweather',
        headings: {
          font: 'Inter',
          weights: ['600', '700'],
          sizes: {
            h1: '2.5rem',
            h2: '2rem',
            h3: '1.75rem',
            h4: '1.5rem',
            h5: '1.25rem',
            h6: '1rem'
          }
        },
        body: {
          font: 'Inter',
          weights: ['400', '500'],
          sizes: {
            default: '1rem',
            small: '0.875rem',
            xsmall: '0.75rem'
          }
        }
      }),
      last_updated: timestamp,
      created_by: adminId,
      updated_by: adminId,
      created_at: timestamp,
      updated_at: timestamp
    }], {});
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('brand_guidelines', {}, {});
  }
};