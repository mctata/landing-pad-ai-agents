# Updated Setup Instructions for Landing Pad Digital AI Agent System

These instructions have been updated based on our modifications to the system, migrating from MongoDB to PostgreSQL and implementing an in-memory message bus.

## Key Changes

1. MongoDB dependencies have been removed and replaced with PostgreSQL/Sequelize
2. RabbitMQ dependency is now optional (in-memory message bus is used by default)
3. Database schema has been updated for PostgreSQL
4. Agent initialization and health monitoring have been fixed

## Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/mctata/landing-pad-ai-agents.git
   cd landing-pad-ai-agents
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   
   Minimum required settings in `.env`:
   ```
   # PostgreSQL Connection
   DATABASE_URL=postgres://postgres:password@localhost:5432/agents_db
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=agents_db
   
   # AI API Keys (optional for basic functionality)
   ANTHROPIC_API_KEY=your_anthropic_api_key
   OPENAI_API_KEY=your_openai_api_key
   
   # Application Settings
   NODE_ENV=development
   PORT=3000
   ```

4. **Set up the PostgreSQL database**:
   ```bash
   # Create the database
   createdb agents_db
   # OR using psql
   psql -c "CREATE DATABASE agents_db;"
   
   # Initialize database schema and defaults
   npm run db:init
   ```

5. **Start the system**:
   ```bash
   npm run dev
   ```

## Verification

* The system will start on `http://localhost:3000`
* You should see a message `Web server running on port 3000 (0.0.0.0)` in the console
* Warning messages about missing agent configurations can be ignored

## Troubleshooting

### Connection Refused
If you see `Error: connect ECONNREFUSED 127.0.0.1:3000`, check:
1. Is the server running? Look for the process with `ps aux | grep node`
2. Are there any errors in the console output?
3. Try accessing it directly in a browser at `http://localhost:3000/api/system/health`

### Missing Tables
If you see database table errors:
1. Check if the database exists: `psql -c "\l" | grep agents_db`
2. Make sure `npm run db:init` completed successfully
3. Manually check tables with: `psql -d agents_db -c "\dt"`

### Agent Configuration Warnings
Warnings like `Missing configuration for agent: content_strategy` are expected and won't prevent core functionality from working.

## Safe Commands Summary

These commands are safe to run:

* `npm install` - Install dependencies
* `npm run db:init` - Initialize database with schema and default data
* `npm run dev` - Start the system in development mode
* `npm run test` - Run tests (if available)

## Next Steps

For further development:
1. Configure agent settings in `config/agents.json`
2. Test API endpoints at `/api/agents`, `/api/content`, etc.
3. Check `PROJECT_STATUS.md` for current project status and future tasks

Note: The original RabbitMQ-based message bus has been replaced with an in-memory implementation, which is simpler for development but not recommended for production use.