/**
 * Database initialization script for Landing Pad Digital AI Content Agents
 * 
 * This script initializes the MongoDB database with the necessary collections,
 * indices, and default data for the AI agent system using Mongoose models.
 * 
 * It also applies any pending migrations to ensure the database schema is up to date.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const models = require('../src/models');
const MigrationService = require('../src/common/services/migrationService');

// Initialize the migration service
const migrationService = new MigrationService();

// Get MongoDB connection string from environment variables
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/landing_pad_ai_agents';

// Define default agents
const defaultAgents = [
  { 
    agentId: 'content-strategy', 
    name: 'Content Strategy Agent', 
    description: 'Analyses audience data and trends to inform content decisions',
    status: 'active',
    type: 'content_strategy',
    modules: [
      {
        name: 'trend-analyzer',
        description: 'Analyzes content trends and patterns',
        enabled: true
      },
      {
        name: 'audience-insights',
        description: 'Generates insights about target audiences',
        enabled: true
      },
      {
        name: 'brief-generator',
        description: 'Creates detailed content briefs',
        enabled: true
      }
    ],
    createdBy: 'system'
  },
  { 
    agentId: 'content-creation', 
    name: 'Content Creation Agent', 
    description: 'Generates high-quality blog posts, website copy, and social media content',
    status: 'active',
    type: 'content_creation',
    modules: [
      {
        name: 'blog-generator',
        description: 'Generates blog posts from briefs',
        enabled: true
      },
      {
        name: 'social-media-generator',
        description: 'Creates social media content',
        enabled: true
      },
      {
        name: 'website-copy-generator',
        description: 'Generates website copy',
        enabled: true
      },
      {
        name: 'headline-generator',
        description: 'Creates engaging headlines',
        enabled: true
      },
      {
        name: 'content-editor',
        description: 'Edits and refines content',
        enabled: true
      }
    ],
    createdBy: 'system'
  },
  { 
    agentId: 'content-management', 
    name: 'Content Management Agent', 
    description: 'Organises, categorises, and tracks content across platforms',
    status: 'active',
    type: 'content_management',
    modules: [
      {
        name: 'content-categoriser',
        description: 'Categorizes content into topics',
        enabled: true
      },
      {
        name: 'content-tracker',
        description: 'Tracks content across platforms',
        enabled: true
      },
      {
        name: 'freshness-checker',
        description: 'Checks content freshness and relevance',
        enabled: true
      },
      {
        name: 'workflow-manager',
        description: 'Manages content workflows',
        enabled: true
      }
    ],
    createdBy: 'system'
  },
  { 
    agentId: 'optimisation', 
    name: 'Optimisation Agent', 
    description: 'Analyses performance metrics and provides SEO recommendations',
    status: 'active',
    type: 'optimisation',
    modules: [
      {
        name: 'seo-optimizer',
        description: 'Optimizes content for search engines',
        enabled: true
      },
      {
        name: 'performance-analyzer',
        description: 'Analyzes content performance',
        enabled: true
      },
      {
        name: 'ab-testing-generator',
        description: 'Generates A/B testing variations',
        enabled: true
      },
      {
        name: 'metrics-tracker',
        description: 'Tracks performance metrics',
        enabled: true
      },
      {
        name: 'reporting',
        description: 'Generates performance reports',
        enabled: true
      }
    ],
    createdBy: 'system'
  },
  { 
    agentId: 'brand-consistency', 
    name: 'Brand Consistency Agent', 
    description: 'Maintains Landing Pad Digital\'s voice, tone, and messaging',
    status: 'active',
    type: 'brand_consistency',
    modules: [
      {
        name: 'consistency-checker',
        description: 'Checks content against brand guidelines',
        enabled: true
      },
      {
        name: 'terminology-checker',
        description: 'Ensures correct terminology usage',
        enabled: true
      },
      {
        name: 'consistency-fixer',
        description: 'Fixes brand consistency issues',
        enabled: true
      },
      {
        name: 'aligned-generator',
        description: 'Generates brand-aligned content',
        enabled: true
      }
    ],
    createdBy: 'system'
  }
];

// Define default brand guidelines
const defaultBrandGuidelines = {
  guidelineId: 'BRAND-2025-001',
  version: '1.0',
  lastUpdated: new Date(),
  companyName: {
    fullName: 'Landing Pad Digital Ltd.',
    shortName: 'Landing Pad Digital',
    abbreviation: 'LPD',
    trademarkSymbol: true,
    firstMentionFormat: 'Landing Pad Digital™',
    subsequentMentionFormat: 'Landing Pad Digital'
  },
  productNames: [
    {
      fullName: 'Landing Pad Digital AI Website Builder',
      shortName: 'AI Website Builder',
      incorrectVariations: ['AI website creator', 'AI site builder', 'website AI tool'],
      useCase: 'Use full name in headlines and first mentions, short name for subsequent mentions.'
    }
  ],
  voice: {
    personality: 'Professional, approachable, knowledgeable, solution-oriented',
    tone: 'Confident but not arrogant, helpful but not condescending, expert but accessible',
    attributes: ['Authoritative', 'Clear', 'Empathetic', 'Practical'],
    examples: [
      {
        good: 'Our AI analyzes thousands of high-performing designs to create a website that\'s uniquely yours.',
        bad: 'Our cutting-edge neural networks leverage advanced machine learning algorithms to generate optimized web interfaces.',
        explanation: 'Avoid overly technical language. Focus on benefits in accessible terms.'
      }
    ]
  },
  terminology: {
    preferredTerms: [
      {
        term: 'AI website builder',
        alternatives: 'artificial intelligence website builder, AI-powered website builder',
        avoidTerms: 'AI website creator, automated website tool, website generator',
        context: 'Use when referring to the overall platform'
      }
    ],
    industryTerms: [
      {
        term: 'conversion rate optimisation',
        definition: 'The process of increasing the percentage of visitors who take a desired action',
        abbreviation: 'CRO',
        firstUse: 'Define on first use in content for non-technical audiences'
      }
    ]
  },
  createdBy: 'system',
  updatedBy: 'system'
};

// Define admin user
const adminUser = {
  userId: 'admin-user',
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@landingpaddigital.com',
  password: process.env.ADMIN_PASSWORD || 'password123',
  roles: ['admin'],
  status: 'active',
  createdBy: 'system'
};

/**
 * Initialize the database
 */
async function initializeDatabase() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB successfully');
    
    // Apply any pending migrations
    console.log('Checking for pending migrations...');
    await migrationService.initialize();
    const migrationStatus = await migrationService.status();
    const pendingMigrations = migrationStatus.filter(m => !m.appliedAt);
    
    if (pendingMigrations.length > 0) {
      console.log(`Found ${pendingMigrations.length} pending migrations. Applying...`);
      const appliedMigrations = await migrationService.up();
      
      if (appliedMigrations.length > 0) {
        console.log(`Successfully applied ${appliedMigrations.length} migrations: ${appliedMigrations.join(', ')}`);
      } else {
        console.log('No migrations were applied. This may indicate an issue with the migration process.');
      }
    } else {
      console.log('No pending migrations found. Database schema is up to date.');
    }
    
    // Insert default agents
    console.log('Checking if agents collection has data...');
    const agentCount = await models.Agent.countDocuments();
    
    if (agentCount === 0) {
      console.log('Inserting default agents...');
      await models.Agent.insertMany(defaultAgents);
      console.log(`${defaultAgents.length} agents inserted`);
    } else {
      console.log('Agents collection already has data, skipping...');
    }
    
    // Insert default brand guidelines
    console.log('Checking if brand guidelines collection has data...');
    const brandGuidelineCount = await models.BrandGuideline.countDocuments();
    
    if (brandGuidelineCount === 0) {
      console.log('Inserting default brand guidelines...');
      await models.BrandGuideline.create(defaultBrandGuidelines);
      console.log('Brand guidelines inserted');
    } else {
      console.log('Brand guidelines collection already has data, skipping...');
    }
    
    // Insert admin user
    console.log('Checking if users collection has admin user...');
    const adminExists = await models.User.findOne({ email: adminUser.email });
    
    if (!adminExists) {
      console.log('Creating admin user...');
      await models.User.create(adminUser);
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists, skipping...');
    }
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    // Close the migration service
    if (migrationService) {
      await migrationService.close();
    }
    
    // Close the mongoose connection
    await mongoose.connection.close();
    console.log('Database connections closed');
  }
}

// Run the initialization
initializeDatabase();