/**
 * Database initialization script for Landing Pad Digital AI Content Agents
 * 
 * This script initializes the MongoDB database with the necessary collections
 * and default data for the AI agent system.
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

// Get MongoDB connection string from environment variables
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/landing_pad_ai_agents';

// Define collections to create
const collections = [
  'agents',
  'content',
  'briefs',
  'metrics',
  'schedules',
  'reports',
  'brand_guidelines'
];

// Define indexes to create
const indexes = [
  { collection: 'content', field: 'status', options: {} },
  { collection: 'content', field: 'type', options: {} },
  { collection: 'content', field: 'createdAt', options: {} },
  { collection: 'briefs', field: 'status', options: {} },
  { collection: 'metrics', field: 'contentId', options: {} },
  { collection: 'metrics', field: 'date', options: {} }
];

// Define default data
const defaultData = {
  agents: [
    { 
      id: 'content-strategy', 
      name: 'Content Strategy Agent', 
      description: 'Analyses audience data and trends to inform content decisions',
      status: 'active',
      modules: ['trend-analyzer', 'audience-insights', 'brief-generator']
    },
    { 
      id: 'content-creation', 
      name: 'Content Creation Agent', 
      description: 'Generates high-quality blog posts, website copy, and social media content',
      status: 'active',
      modules: ['blog-generator', 'social-media-generator', 'website-copy-generator', 'headline-generator', 'content-editor']
    },
    { 
      id: 'content-management', 
      name: 'Content Management Agent', 
      description: 'Organises, categorises, and tracks content across platforms',
      status: 'active',
      modules: ['content-categoriser', 'content-tracker', 'freshness-checker', 'workflow-manager']
    },
    { 
      id: 'optimisation', 
      name: 'Optimisation Agent', 
      description: 'Analyses performance metrics and provides SEO recommendations',
      status: 'active',
      modules: ['seo-optimizer', 'performance-analyzer', 'ab-testing-generator', 'metrics-tracker', 'reporting']
    },
    { 
      id: 'brand-consistency', 
      name: 'Brand Consistency Agent', 
      description: 'Maintains Landing Pad Digital\'s voice, tone, and messaging',
      status: 'active',
      modules: ['consistency-checker', 'terminology-checker', 'consistency-fixer', 'aligned-generator']
    }
  ],
  brand_guidelines: [
    {
      id: 'voice-tone',
      name: 'Voice and Tone Guidelines',
      description: 'Guidelines for maintaining Landing Pad Digital\'s voice and tone',
      rules: [
        'Professional but approachable tone',
        'Clear, concise, and jargon-free language',
        'Enthusiastic about technology without being overwhelming',
        'Empathetic towards user challenges',
        'Focus on solutions, not problems'
      ]
    },
    {
      id: 'terminology',
      name: 'Terminology Guidelines',
      description: 'Approved terminology for Landing Pad Digital',
      terms: {
        'AI website builder': 'Primary product descriptor, always hyphenated',
        'Landing Pad Digital': 'Full company name, never abbreviated',
        'Website creation': 'Preferred over "website building" or "web development"',
        'No-code solution': 'Acceptable secondary descriptor',
        'Drag-and-drop interface': 'Acceptable feature descriptor'
      }
    }
  ]
};

/**
 * Initialize the database
 */
async function initializeDatabase() {
  let client;

  try {
    // Connect to MongoDB
    client = new MongoClient(mongoURI);
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    const db = client.db();
    
    // Create collections
    console.log('Creating collections...');
    for (const collection of collections) {
      try {
        await db.createCollection(collection);
        console.log(`Created collection: ${collection}`);
      } catch (error) {
        // Collection may already exist
        console.log(`Collection ${collection} may already exist: ${error.message}`);
      }
    }
    
    // Create indexes
    console.log('Creating indexes...');
    for (const index of indexes) {
      try {
        await db.collection(index.collection).createIndex({ [index.field]: 1 }, index.options);
        console.log(`Created index on ${index.collection}.${index.field}`);
      } catch (error) {
        console.error(`Error creating index on ${index.collection}.${index.field}: ${error.message}`);
      }
    }
    
    // Insert default data
    console.log('Inserting default data...');
    for (const [collection, data] of Object.entries(defaultData)) {
      try {
        // Only insert if collection is empty
        const count = await db.collection(collection).countDocuments();
        if (count === 0) {
          const result = await db.collection(collection).insertMany(data);
          console.log(`Inserted ${result.insertedCount} documents into ${collection}`);
        } else {
          console.log(`Collection ${collection} already has data, skipping...`);
        }
      } catch (error) {
        console.error(`Error inserting data into ${collection}: ${error.message}`);
      }
    }
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    // Close the connection
    if (client) {
      await client.close();
      console.log('Database connection closed');
    }
  }
}

// Run the initialization
initializeDatabase();
