/**
 * Initial schema migration for Landing Pad Digital AI Content Agents
 * 
 * This migration represents the initial schema for all collections used by the system.
 * It runs before any other migrations and establishes the base schema.
 */

module.exports = {
  async up(db, client) {
    // Creating collections with schema validation
    
    // 1. Agent collection
    await db.createCollection("agents", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["agentId", "name", "type", "status"],
          properties: {
            agentId: { bsonType: "string" },
            name: { bsonType: "string" },
            description: { bsonType: "string" },
            type: { bsonType: "string" },
            status: { bsonType: "string", enum: ["active", "inactive", "maintenance"] },
            modules: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["name", "enabled"],
                properties: {
                  name: { bsonType: "string" },
                  description: { bsonType: "string" },
                  enabled: { bsonType: "bool" },
                  config: { bsonType: "object" }
                }
              }
            },
            metrics: {
              bsonType: "object",
              properties: {
                requestsProcessed: { bsonType: "int" },
                successRate: { bsonType: "double" },
                averageProcessingTime: { bsonType: "double" },
                lastActivity: { bsonType: "date" }
              }
            },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
            createdBy: { bsonType: "string" },
            updatedBy: { bsonType: "string" }
          }
        }
      }
    });
    
    // 2. Content collection
    await db.createCollection("contents", {
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
    
    // 3. ContentVersion collection
    await db.createCollection("contentversions", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["contentId", "versionNumber", "content"],
          properties: {
            contentId: { bsonType: "string" },
            versionNumber: { bsonType: "int" },
            content: { bsonType: "string" },
            html: { bsonType: "string" },
            changelog: { bsonType: "string" },
            createdAt: { bsonType: "date" },
            createdBy: { bsonType: "string" }
          }
        }
      }
    });
    
    // 4. Brief collection
    await db.createCollection("briefs", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["briefId", "title", "contentType"],
          properties: {
            briefId: { bsonType: "string" },
            title: { bsonType: "string" },
            contentType: { bsonType: "string" },
            description: { bsonType: "string" },
            requirements: { bsonType: "string" },
            audience: { bsonType: "array", items: { bsonType: "string" } },
            keywords: { bsonType: "array", items: { bsonType: "string" } },
            tone: { bsonType: "string" },
            length: { bsonType: "object" },
            status: { bsonType: "string" },
            deadline: { bsonType: "date" },
            assignedTo: { bsonType: "string" },
            references: { bsonType: "array" },
            metadata: { bsonType: "object" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
            createdBy: { bsonType: "string" },
            updatedBy: { bsonType: "string" }
          }
        }
      }
    });
    
    // 5. Metric collection
    await db.createCollection("metrics", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["metricId", "contentId", "metricType"],
          properties: {
            metricId: { bsonType: "string" },
            contentId: { bsonType: "string" },
            metricType: { bsonType: "string" },
            value: { bsonType: ["double", "int", "string"] },
            unit: { bsonType: "string" },
            source: { bsonType: "string" },
            timestamp: { bsonType: "date" },
            metadata: { bsonType: "object" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" }
          }
        }
      }
    });
    
    // 6. BrandGuideline collection
    await db.createCollection("brandguidelines", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["guidelineId", "version"],
          properties: {
            guidelineId: { bsonType: "string" },
            version: { bsonType: "string" },
            lastUpdated: { bsonType: "date" },
            companyName: { bsonType: "object" },
            productNames: { bsonType: "array" },
            voice: { bsonType: "object" },
            terminology: { bsonType: "object" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
            createdBy: { bsonType: "string" },
            updatedBy: { bsonType: "string" }
          }
        }
      }
    });
    
    // 7. User collection
    await db.createCollection("users", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["userId", "email", "password", "roles", "status"],
          properties: {
            userId: { bsonType: "string" },
            firstName: { bsonType: "string" },
            lastName: { bsonType: "string" },
            email: { bsonType: "string" },
            password: { bsonType: "string" },
            roles: { bsonType: "array", items: { bsonType: "string" } },
            status: { bsonType: "string", enum: ["active", "inactive", "pending", "suspended"] },
            lastLogin: { bsonType: "date" },
            preferences: { bsonType: "object" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
            createdBy: { bsonType: "string" },
            updatedBy: { bsonType: "string" }
          }
        }
      }
    });
    
    // 8. Workflow collection
    await db.createCollection("workflows", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["workflowId", "name", "steps", "status"],
          properties: {
            workflowId: { bsonType: "string" },
            name: { bsonType: "string" },
            description: { bsonType: "string" },
            steps: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["stepId", "name", "order"],
                properties: {
                  stepId: { bsonType: "string" },
                  name: { bsonType: "string" },
                  description: { bsonType: "string" },
                  order: { bsonType: "int" },
                  assignedTo: { bsonType: "string" },
                  agentType: { bsonType: "string" },
                  requiredModules: { bsonType: "array", items: { bsonType: "string" } },
                  completionCriteria: { bsonType: "object" }
                }
              }
            },
            status: { bsonType: "string", enum: ["active", "inactive", "archived"] },
            contentTypes: { bsonType: "array", items: { bsonType: "string" } },
            metadata: { bsonType: "object" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
            createdBy: { bsonType: "string" },
            updatedBy: { bsonType: "string" }
          }
        }
      }
    });
    
    // 9. Schedule collection
    await db.createCollection("schedules", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["scheduleId", "contentId", "status", "scheduledTime"],
          properties: {
            scheduleId: { bsonType: "string" },
            contentId: { bsonType: "string" },
            status: { bsonType: "string", enum: ["scheduled", "published", "failed", "cancelled"] },
            scheduledTime: { bsonType: "date" },
            actualPublishTime: { bsonType: "date" },
            publishingPlatform: { bsonType: "string" },
            publishingDetails: { bsonType: "object" },
            recurrence: { bsonType: "object" },
            metadata: { bsonType: "object" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
            createdBy: { bsonType: "string" },
            updatedBy: { bsonType: "string" }
          }
        }
      }
    });
    
    // 10. Report collection
    await db.createCollection("reports", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["reportId", "name", "type", "dateRange"],
          properties: {
            reportId: { bsonType: "string" },
            name: { bsonType: "string" },
            description: { bsonType: "string" },
            type: { bsonType: "string" },
            dateRange: {
              bsonType: "object",
              required: ["startDate", "endDate"],
              properties: {
                startDate: { bsonType: "date" },
                endDate: { bsonType: "date" }
              }
            },
            filters: { bsonType: "object" },
            metrics: { bsonType: "array" },
            data: { bsonType: "object" },
            format: { bsonType: "string" },
            status: { bsonType: "string" },
            generatedBy: { bsonType: "string" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" }
          }
        }
      }
    });
    
    // Create indexes
    await db.collection('agents').createIndex({ agentId: 1 }, { unique: true });
    await db.collection('agents').createIndex({ type: 1 });
    await db.collection('agents').createIndex({ status: 1 });
    
    await db.collection('contents').createIndex({ contentId: 1 }, { unique: true });
    await db.collection('contents').createIndex({ slug: 1 }, { unique: true });
    await db.collection('contents').createIndex({ contentType: 1 });
    await db.collection('contents').createIndex({ status: 1 });
    await db.collection('contents').createIndex({ workflowStatus: 1 });
    await db.collection('contents').createIndex({ keywords: 1 });
    await db.collection('contents').createIndex({ categories: 1 });
    await db.collection('contents').createIndex({ tags: 1 });
    await db.collection('contents').createIndex({ brief: 1 });
    
    await db.collection('contentversions').createIndex({ contentId: 1, versionNumber: 1 }, { unique: true });
    
    await db.collection('briefs').createIndex({ briefId: 1 }, { unique: true });
    await db.collection('briefs').createIndex({ contentType: 1 });
    await db.collection('briefs').createIndex({ status: 1 });
    await db.collection('briefs').createIndex({ deadline: 1 });
    await db.collection('briefs').createIndex({ assignedTo: 1 });
    
    await db.collection('metrics').createIndex({ metricId: 1 }, { unique: true });
    await db.collection('metrics').createIndex({ contentId: 1 });
    await db.collection('metrics').createIndex({ metricType: 1 });
    await db.collection('metrics').createIndex({ timestamp: 1 });
    
    await db.collection('brandguidelines').createIndex({ guidelineId: 1, version: 1 }, { unique: true });
    
    await db.collection('users').createIndex({ userId: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ roles: 1 });
    await db.collection('users').createIndex({ status: 1 });
    
    await db.collection('workflows').createIndex({ workflowId: 1 }, { unique: true });
    await db.collection('workflows').createIndex({ status: 1 });
    await db.collection('workflows').createIndex({ contentTypes: 1 });
    
    await db.collection('schedules').createIndex({ scheduleId: 1 }, { unique: true });
    await db.collection('schedules').createIndex({ contentId: 1 });
    await db.collection('schedules').createIndex({ status: 1 });
    await db.collection('schedules').createIndex({ scheduledTime: 1 });
    
    await db.collection('reports').createIndex({ reportId: 1 }, { unique: true });
    await db.collection('reports').createIndex({ type: 1 });
    await db.collection('reports').createIndex({ 'dateRange.startDate': 1, 'dateRange.endDate': 1 });
    await db.collection('reports').createIndex({ status: 1 });
  },

  async down(db, client) {
    // Drop all collections created in the up method
    await db.collection('agents').drop();
    await db.collection('contents').drop();
    await db.collection('contentversions').drop();
    await db.collection('briefs').drop();
    await db.collection('metrics').drop();
    await db.collection('brandguidelines').drop();
    await db.collection('users').drop();
    await db.collection('workflows').drop();
    await db.collection('schedules').drop();
    await db.collection('reports').drop();
  }
};