/**
 * Migration script to add security enhancements
 * 
 * - Adds API key collection
 * - Updates User schema with security fields
 * - Ensures existing users get security upgrades
 */

module.exports = {
  async up(db, client) {
    // Create API key collection with indexes
    await db.createCollection('apikeys');
    await db.collection('apikeys').createIndex({ key: 1 }, { unique: true });
    await db.collection('apikeys').createIndex({ owner: 1 });
    
    // Update users collection
    // 1. Add security-related fields to existing users
    await db.collection('users').updateMany(
      {}, 
      { 
        $set: {
          passwordChangedAt: null,
          twoFactorEnabled: false,
          previousPasswords: [],
          requiresPasswordChange: true,
          status: 'active'
        } 
      }
    );
    
    // 2. Create indexes for security-related queries
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ passwordResetToken: 1 }, { sparse: true });
    await db.collection('users').createIndex({ status: 1 });
    
    console.log('Security enhancements migration completed');
  },

  async down(db, client) {
    // Remove API key collection
    await db.collection('apikeys').drop();
    
    // Remove security fields from users
    await db.collection('users').updateMany(
      {},
      {
        $unset: {
          passwordChangedAt: "",
          twoFactorEnabled: "",
          twoFactorSecret: "",
          previousPasswords: "",
          requiresPasswordChange: "",
          passwordResetToken: "",
          passwordResetExpires: "",
          lockUntil: ""
        }
      }
    );
    
    // Remove indexes
    await db.collection('users').dropIndex({ passwordResetToken: 1 });
    
    console.log('Security enhancements migration rolled back');
  }
};