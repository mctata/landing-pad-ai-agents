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
    
    // Define default agents
    const agents = [
      {
        agent_id: nanoid(),
        name: 'Content Creation Agent',
        description: 'Creates various types of content including blog posts, social media, and emails',
        status: 'active',
        type: 'content_creation',
        modules: JSON.stringify([
          'blog-generator',
          'email-generator',
          'social-media-generator',
          'website-copy-generator'
        ]),
        configuration: JSON.stringify({
          default_tone: 'professional',
          max_tokens: 4000,
          model: 'claude-3-haiku-20240307'
        }),
        metrics: JSON.stringify({}),
        created_by: adminId,
        created_at: timestamp,
        updated_at: timestamp
      },
      {
        agent_id: nanoid(),
        name: 'Content Strategy Agent',
        description: 'Analyzes trends and generates content strategy briefs',
        status: 'active',
        type: 'content_strategy',
        modules: JSON.stringify([
          'audience-insights',
          'brief-generator',
          'trend-analyzer'
        ]),
        configuration: JSON.stringify({
          default_tone: 'analytical',
          max_tokens: 4000,
          model: 'claude-3-sonnet-20240229'
        }),
        metrics: JSON.stringify({}),
        created_by: adminId,
        created_at: timestamp,
        updated_at: timestamp
      },
      {
        agent_id: nanoid(),
        name: 'Content Management Agent',
        description: 'Tracks, categorizes, and manages content lifecycle',
        status: 'active',
        type: 'content_management',
        modules: JSON.stringify([
          'content-categoriser',
          'content-tracker',
          'freshness-checker',
          'workflow-manager'
        ]),
        configuration: JSON.stringify({
          default_tone: 'neutral',
          max_tokens: 2000,
          model: 'claude-3-haiku-20240307'
        }),
        metrics: JSON.stringify({}),
        created_by: adminId,
        created_at: timestamp,
        updated_at: timestamp
      },
      {
        agent_id: nanoid(),
        name: 'Optimization Agent',
        description: 'Optimizes content for SEO and performance',
        status: 'active',
        type: 'optimisation',
        modules: JSON.stringify([
          'ab-testing-generator',
          'metrics-tracker',
          'performance-analyzer',
          'reporting',
          'seo-optimizer'
        ]),
        configuration: JSON.stringify({
          default_tone: 'analytical',
          max_tokens: 3000,
          model: 'claude-3-haiku-20240307'
        }),
        metrics: JSON.stringify({}),
        created_by: adminId,
        created_at: timestamp,
        updated_at: timestamp
      },
      {
        agent_id: nanoid(),
        name: 'Brand Consistency Agent',
        description: 'Ensures all content follows brand guidelines',
        status: 'active',
        type: 'brand_consistency',
        modules: JSON.stringify([
          'aligned-generator',
          'consistency-checker',
          'consistency-fixer',
          'terminology-checker'
        ]),
        configuration: JSON.stringify({
          default_tone: 'professional',
          max_tokens: 2000,
          model: 'claude-3-haiku-20240307'
        }),
        metrics: JSON.stringify({}),
        created_by: adminId,
        created_at: timestamp,
        updated_at: timestamp
      }
    ];

    return queryInterface.bulkInsert('agents', agents, {});
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('agents', {
      type: {
        [Sequelize.Op.in]: [
          'content_creation',
          'content_strategy',
          'content_management',
          'optimisation',
          'brand_consistency'
        ]
      }
    }, {});
  }
};