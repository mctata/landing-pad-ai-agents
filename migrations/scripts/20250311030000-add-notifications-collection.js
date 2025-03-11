/**
 * Migration: Add Notifications Collection
 * Created: 2025-03-11
 * 
 * This migration adds a new collection for storing system and user notifications.
 */

module.exports = {
  async up(db, client) {
    // Create the notifications collection with schema validation
    await db.createCollection("notifications", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["notificationId", "type", "message", "status", "createdAt"],
          properties: {
            notificationId: { bsonType: "string" },
            userId: { bsonType: "string" },
            type: { 
              bsonType: "string", 
              enum: ["system", "content", "workflow", "error", "security", "other"] 
            },
            message: { bsonType: "string" },
            title: { bsonType: "string" },
            entityId: { bsonType: "string" },
            entityType: { bsonType: "string" },
            status: { 
              bsonType: "string", 
              enum: ["unread", "read", "archived", "actioned"] 
            },
            priority: { 
              bsonType: "string", 
              enum: ["low", "medium", "high", "critical"] 
            },
            actions: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["actionId", "label", "type"],
                properties: {
                  actionId: { bsonType: "string" },
                  label: { bsonType: "string" },
                  type: { bsonType: "string" },
                  url: { bsonType: "string" },
                  completed: { bsonType: "bool" }
                }
              }
            },
            metadata: { bsonType: "object" },
            expiresAt: { bsonType: "date" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" }
          }
        }
      }
    });
    
    // Create indexes for the notifications collection
    await db.collection('notifications').createIndex({ notificationId: 1 }, { unique: true });
    await db.collection('notifications').createIndex({ userId: 1 });
    await db.collection('notifications').createIndex({ status: 1 });
    await db.collection('notifications').createIndex({ type: 1 });
    await db.collection('notifications').createIndex({ priority: 1 });
    await db.collection('notifications').createIndex({ createdAt: 1 });
    await db.collection('notifications').createIndex({ entityId: 1, entityType: 1 });
    
    // Create a TTL index for automatic expiration
    await db.collection('notifications').createIndex(
      { expiresAt: 1 }, 
      { expireAfterSeconds: 0 }
    );
    
    // Add a system notification for admin users
    const now = new Date();
    await db.collection('notifications').insertOne({
      notificationId: `system-${Date.now()}`,
      type: 'system',
      message: 'Notification system has been activated. Users will now receive notifications for important system events.',
      title: 'Notification System Activated',
      status: 'unread',
      priority: 'medium',
      createdAt: now,
      updatedAt: now
    });
  },

  async down(db, client) {
    // Drop the notifications collection and all its indexes
    await db.collection('notifications').drop();
  }
};