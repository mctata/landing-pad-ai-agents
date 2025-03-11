/**
 * Migration: Add Content Analytics Fields
 * Created: 2025-03-11
 * 
 * This migration adds new analytics-related fields to the content schema
 * to support improved content performance tracking.
 */

module.exports = {
  async up(db, client) {
    // Add analytics fields to the content collection
    await db.collection('contents').updateMany(
      {}, 
      { 
        $set: { 
          analytics: {
            views: 0,
            shares: 0,
            comments: 0,
            conversions: 0,
            averageTimeOnPage: 0,
            bounceRate: 0,
            lastAnalyticsUpdate: new Date()
          }
        } 
      }
    );
    
    // Create indexes for analytics queries
    await db.collection('contents').createIndex({ 'analytics.views': -1 });
    await db.collection('contents').createIndex({ 'analytics.shares': -1 });
    await db.collection('contents').createIndex({ 'analytics.conversions': -1 });
    
    // Update the schema validation to include the new fields
    await db.command({
      collMod: 'contents',
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["contentId", "title", "contentType", "status"],
          properties: {
            contentId: { bsonType: "string" },
            title: { bsonType: "string" },
            slug: { bsonType: "string" },
            description: { bsonType: "string" },
            contentType: { bsonType: "string" },
            content: { bsonType: "string" },
            html: { bsonType: "string" },
            status: { bsonType: "string" },
            workflowStatus: { bsonType: "string" },
            author: { bsonType: "string" },
            brief: { bsonType: "string" },
            keywords: { bsonType: "array", items: { bsonType: "string" } },
            categories: { bsonType: "array", items: { bsonType: "string" } },
            tags: { bsonType: "array", items: { bsonType: "string" } },
            versions: { bsonType: "array", items: { bsonType: "string" } },
            currentVersion: { bsonType: "int" },
            publishedAt: { bsonType: "date" },
            expiresAt: { bsonType: "date" },
            analytics: {
              bsonType: "object",
              properties: {
                views: { bsonType: "int" },
                shares: { bsonType: "int" },
                comments: { bsonType: "int" },
                conversions: { bsonType: "int" },
                averageTimeOnPage: { bsonType: "double" },
                bounceRate: { bsonType: "double" },
                lastAnalyticsUpdate: { bsonType: "date" }
              }
            },
            metadata: { bsonType: "object" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
            createdBy: { bsonType: "string" },
            updatedBy: { bsonType: "string" }
          }
        }
      }
    });
  },

  async down(db, client) {
    // Remove the analytics fields from all content documents
    await db.collection('contents').updateMany(
      {}, 
      { $unset: { analytics: "" } }
    );
    
    // Remove the analytics indexes
    await db.collection('contents').dropIndex({ 'analytics.views': -1 });
    await db.collection('contents').dropIndex({ 'analytics.shares': -1 });
    await db.collection('contents').dropIndex({ 'analytics.conversions': -1 });
    
    // Revert the schema validation
    await db.command({
      collMod: 'contents',
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["contentId", "title", "contentType", "status"],
          properties: {
            contentId: { bsonType: "string" },
            title: { bsonType: "string" },
            slug: { bsonType: "string" },
            description: { bsonType: "string" },
            contentType: { bsonType: "string" },
            content: { bsonType: "string" },
            html: { bsonType: "string" },
            status: { bsonType: "string" },
            workflowStatus: { bsonType: "string" },
            author: { bsonType: "string" },
            brief: { bsonType: "string" },
            keywords: { bsonType: "array", items: { bsonType: "string" } },
            categories: { bsonType: "array", items: { bsonType: "string" } },
            tags: { bsonType: "array", items: { bsonType: "string" } },
            versions: { bsonType: "array", items: { bsonType: "string" } },
            currentVersion: { bsonType: "int" },
            publishedAt: { bsonType: "date" },
            expiresAt: { bsonType: "date" },
            metadata: { bsonType: "object" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
            createdBy: { bsonType: "string" },
            updatedBy: { bsonType: "string" }
          }
        }
      }
    });
  }
};