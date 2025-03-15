'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the Agent table
    await queryInterface.createTable('agents', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      agent_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'active'
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      modules: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Create the User table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      roles: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: ['user']
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'active'
      },
      last_login: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Create the Content table
    await queryInterface.createTable('contents', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      content_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      brief_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'draft'
      },
      categories: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Create the ContentVersion table
    await queryInterface.createTable('content_versions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      content_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Create a unique constraint for content_id and version
    await queryInterface.addConstraint('content_versions', {
      fields: ['content_id', 'version'],
      type: 'unique',
      name: 'unique_content_version'
    });

    // Create the Brief table
    await queryInterface.createTable('briefs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      brief_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      details: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'draft'
      },
      content_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      due_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Create the Metric table
    await queryInterface.createTable('metrics', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      performance_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      content_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      date_range: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      metrics: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      source: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Create the BrandGuideline table
    await queryInterface.createTable('brand_guidelines', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      guideline_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      version: {
        type: Sequelize.STRING,
        allowNull: false
      },
      last_updated: {
        type: Sequelize.DATE,
        allowNull: false
      },
      company_name: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      product_names: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      voice: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      terminology: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Create the Workflow table
    await queryInterface.createTable('workflows', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      workflow_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'pending'
      },
      priority: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      content_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      brief_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      steps: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Create the ApiKey table
    await queryInterface.createTable('api_keys', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      key_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      key: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      permissions: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_used: {
        type: Sequelize.DATE,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'active'
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Create the Session table (for express-session with connect-pg-simple)
    await queryInterface.createTable('sessions', {
      sid: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      sess: {
        type: Sequelize.JSON,
        allowNull: false
      },
      expire: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Create indices for better performance
    await queryInterface.addIndex('agents', ['agent_id']);
    await queryInterface.addIndex('agents', ['type']);
    await queryInterface.addIndex('agents', ['status']);
    
    await queryInterface.addIndex('users', ['user_id']);
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['status']);
    
    await queryInterface.addIndex('contents', ['content_id']);
    await queryInterface.addIndex('contents', ['brief_id']);
    await queryInterface.addIndex('contents', ['type']);
    await queryInterface.addIndex('contents', ['status']);
    await queryInterface.addIndex('contents', ['created_at']);
    
    await queryInterface.addIndex('content_versions', ['content_id']);
    
    await queryInterface.addIndex('briefs', ['brief_id']);
    await queryInterface.addIndex('briefs', ['status']);
    await queryInterface.addIndex('briefs', ['content_type']);
    
    await queryInterface.addIndex('metrics', ['performance_id']);
    await queryInterface.addIndex('metrics', ['content_id']);
    
    await queryInterface.addIndex('brand_guidelines', ['guideline_id']);
    
    await queryInterface.addIndex('workflows', ['workflow_id']);
    await queryInterface.addIndex('workflows', ['content_id']);
    await queryInterface.addIndex('workflows', ['brief_id']);
    await queryInterface.addIndex('workflows', ['status']);
    await queryInterface.addIndex('workflows', ['type']);
    
    await queryInterface.addIndex('api_keys', ['key_id']);
    await queryInterface.addIndex('api_keys', ['user_id']);
    await queryInterface.addIndex('api_keys', ['key']);
    
    await queryInterface.addIndex('sessions', ['expire']);
  },

  async down(queryInterface, Sequelize) {
    // Drop all tables in reverse order of creation
    await queryInterface.dropTable('sessions');
    await queryInterface.dropTable('api_keys');
    await queryInterface.dropTable('workflows');
    await queryInterface.dropTable('brand_guidelines');
    await queryInterface.dropTable('metrics');
    await queryInterface.dropTable('briefs');
    await queryInterface.dropTable('content_versions');
    await queryInterface.dropTable('contents');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('agents');
  }
};