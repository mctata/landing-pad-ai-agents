'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the User table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      roles: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: ['user']
      },
      status: {
        type: "enum_user_status",
        defaultValue: 'active'
      },
      last_login: {
        type: Sequelize.DATE,
        allowNull: true
      },
      preferences: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      security_settings: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      created_by: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create the Agent table
    await queryInterface.createTable('agents', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      agent_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: "enum_agent_status",
        defaultValue: 'active'
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      modules: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      configuration: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      metrics: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      created_by: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      version: {
        type: Sequelize.STRING(20),
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
      logo_usage: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      color_palette: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      typography: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      last_updated: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_by: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create the Brief table
    await queryInterface.createTable('briefs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      brief_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      title: {
        type: Sequelize.STRING(200),
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
        type: "enum_brief_status",
        defaultValue: 'draft'
      },
      content_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      due_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      assigned_to: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      created_by: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      brief_id: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      title: {
        type: Sequelize.STRING(200),
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
        type: Sequelize.STRING(50),
        allowNull: false
      },
      status: {
        type: "enum_content_status",
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
        type: Sequelize.STRING(36),
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create the ContentVersion table
    await queryInterface.createTable('content_versions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      version_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      content_id: {
        type: Sequelize.STRING(36),
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
      change_summary: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_by: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create a unique constraint for content_id and version
    await queryInterface.addConstraint('content_versions', {
      fields: ['content_id', 'version'],
      type: 'unique',
      name: 'unique_content_version'
    });

    // Create the ApiKey table
    await queryInterface.createTable('api_keys', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      key_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      user_id: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      key: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(100),
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
        type: "enum_api_key_status",
        defaultValue: 'active'
      },
      created_by: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      status: {
        type: "enum_workflow_status",
        defaultValue: 'pending'
      },
      priority: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      content_id: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      brief_id: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      steps: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      current_step: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      created_by: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      content_id: {
        type: Sequelize.STRING(36),
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
        type: Sequelize.STRING(50),
        allowNull: false
      },
      created_by: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create the Report table
    await queryInterface.createTable('reports', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      report_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      parameters: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      created_by: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create the Schedule table
    await queryInterface.createTable('schedules', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      schedule_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      content_id: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      workflow_id: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'pending'
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      created_by: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      updated_by: {
        type: Sequelize.STRING(36),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create the Session table (for express-session with connect-pg-simple)
    await queryInterface.createTable('sessions', {
      sid: {
        type: Sequelize.STRING(255),
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

    // Create notifications table
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      notification_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true
      },
      user_id: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'unread'
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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
    await queryInterface.addIndex('content_versions', ['version_id']);
    
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

    await queryInterface.addIndex('reports', ['report_id']);
    await queryInterface.addIndex('reports', ['type']);
    
    await queryInterface.addIndex('schedules', ['schedule_id']);
    await queryInterface.addIndex('schedules', ['content_id']);
    await queryInterface.addIndex('schedules', ['workflow_id']);
    await queryInterface.addIndex('schedules', ['scheduled_at']);
    
    await queryInterface.addIndex('notifications', ['notification_id']);
    await queryInterface.addIndex('notifications', ['user_id']);
    await queryInterface.addIndex('notifications', ['status']);
  },

  async down(queryInterface, Sequelize) {
    // Drop all tables in reverse order of creation
    await queryInterface.dropTable('notifications');
    await queryInterface.dropTable('schedules');
    await queryInterface.dropTable('reports');
    await queryInterface.dropTable('sessions');
    await queryInterface.dropTable('metrics');
    await queryInterface.dropTable('workflows');
    await queryInterface.dropTable('api_keys');
    await queryInterface.dropTable('content_versions');
    await queryInterface.dropTable('contents');
    await queryInterface.dropTable('briefs');
    await queryInterface.dropTable('brand_guidelines');
    await queryInterface.dropTable('agents');
    await queryInterface.dropTable('users');
  }
};