'use strict';
const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create an admin user
    const hashedPassword = await bcrypt.hash('AdminPassword123!', 10);
    const userId = nanoid();
    const timestamp = new Date();

    return queryInterface.bulkInsert('users', [{
      user_id: userId,
      email: 'admin@landingpad.ai',
      password: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      roles: ['admin', 'user'],
      status: 'active',
      preferences: JSON.stringify({}),
      security_settings: JSON.stringify({
        mfa_enabled: false,
        last_password_change: timestamp
      }),
      created_by: userId, // Self-reference for first user
      created_at: timestamp,
      updated_at: timestamp
    }], {});
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('users', {
      email: 'admin@landingpad.ai'
    }, {});
  }
};