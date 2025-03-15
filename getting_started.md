# Getting Started with Landing Pad Digital AI Agent System

This guide provides instructions for setting up and using the Landing Pad Digital AI agent system for content operations.

## Overview

The Landing Pad Digital AI agent system is a comprehensive framework of specialized AI agents designed to automate and enhance daily content operations. The system focuses on educating users about Landing Pad Digital's AI-powered website builder and establishing the brand as a professional authority in the website creation space.

## System Architecture

The system consists of five specialized agents:

1. **Content Strategy Agent**: Analyzes audience data and trends to inform content decisions
2. **Content Creation Agent**: Generates high-quality content across various formats
3. **Content Management Agent**: Organizes, categorizes, and tracks content across platforms
4. **Optimisation Agent**: Analyzes performance metrics and provides SEO recommendations
5. **Brand Consistency Agent**: Maintains brand voice, tone, and messaging

These agents work together through a shared message bus and knowledge repository to create cohesive content that meets Landing Pad Digital's business objectives.

## Installation

### Prerequisites

- Node.js 18.x or higher
- PostgreSQL 14.0 or higher
- RabbitMQ 3.10 or higher
- Python 3.10 or higher (for analytics components)
- API keys for AI services (Anthropic Claude and OpenAI)
- AWS account for S3 storage (for production)

### Installing Prerequisites

#### 1. Node.js

**On Ubuntu/Debian:**
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 8.x.x or higher
```

**On macOS (using Homebrew):**
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@18

# Add to PATH if needed
echo 'export PATH="/usr/local/opt/node@18/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify installation
node --version
npm --version
```

**On Windows:**
1. Download the Node.js installer from [nodejs.org](https://nodejs.org/)
2. Run the installer and follow the installation wizard
3. Open Command Prompt or PowerShell and verify installation:
   ```
   node --version
   npm --version
   ```

#### 2. PostgreSQL

**On Ubuntu/Debian:**
```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Update package lists
sudo apt-get update

# Install PostgreSQL and development libraries
sudo apt-get install -y postgresql-14 postgresql-contrib-14 libpq-dev

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
psql --version
```

**On macOS (using Homebrew):**
```bash
# Install PostgreSQL
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Verify installation
psql --version
```

**On Windows:**
1. Download the PostgreSQL installer from [PostgreSQL Download Page](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the installation wizard
3. Choose components to install (PostgreSQL Server, pgAdmin 4, Command Line Tools)
4. Set a password for the postgres user
5. Verify installation by opening pgAdmin or using the following in Command Prompt:
   ```
   psql -V
   ```

#### 3. RabbitMQ

**On Ubuntu/Debian:**
```bash
# Add RabbitMQ repository
curl -s https://packagecloud.io/install/repositories/rabbitmq/rabbitmq-server/script.deb.sh | sudo bash

# Install RabbitMQ
sudo apt-get install -y rabbitmq-server

# Start RabbitMQ service
sudo systemctl start rabbitmq-server
sudo systemctl enable rabbitmq-server

# Enable RabbitMQ management plugin (optional)
sudo rabbitmq-plugins enable rabbitmq_management

# Create admin user (optional)
sudo rabbitmqctl add_user admin your_password
sudo rabbitmqctl set_user_tags admin administrator
sudo rabbitmqctl set_permissions -p / admin ".*" ".*" ".*"

# Verify installation
sudo rabbitmqctl status
```

**On macOS (using Homebrew):**
```bash
# Install RabbitMQ
brew install rabbitmq

# Start RabbitMQ service
brew services start rabbitmq

# Verify installation
rabbitmqctl status
```

**On Windows:**
1. Install Erlang first from [Erlang Solutions](https://www.erlang.org/downloads)
2. Download and install RabbitMQ from [RabbitMQ Website](https://www.rabbitmq.com/install-windows.html)
3. After installation, RabbitMQ service should start automatically
4. To verify, open a Command Prompt as Administrator and run:
   ```
   rabbitmqctl.bat status
   ```

#### 4. Python (for analytics components)

**On Ubuntu/Debian:**
```bash
# Install Python 3.10
sudo apt-get install -y python3.10 python3.10-venv python3-pip

# Verify installation
python3.10 --version
```

**On macOS (using Homebrew):**
```bash
# Install Python 3.10
brew install python@3.10

# Verify installation
python3.10 --version
```

**On Windows:**
1. Download Python 3.10 installer from [python.org](https://www.python.org/downloads/release/python-3100/)
2. Run the installer and make sure to check "Add Python to PATH"
3. Open Command Prompt and verify installation:
   ```
   python --version
   ```

#### 5. AWS S3 (for production storage)

1. Sign up for an AWS account if you don't have one at [aws.amazon.com](https://aws.amazon.com/)
2. Create an IAM user with programmatic access:
   - Open the IAM console in AWS
   - Navigate to Users and click "Add user"
   - Set a username (e.g., "landing-pad-ai-agents")
   - Select "Programmatic access"
   - Attach the "AmazonS3FullAccess" policy (or create a custom policy with restricted permissions)
   - Complete the user creation process
   - Save the Access Key ID and Secret Access Key securely

3. Configure AWS credentials locally:
   ```bash
   # Install AWS CLI
   pip install awscli

   # Configure with your credentials
   aws configure
   # Enter Access Key ID, Secret Access Key, default region (us-east-1), and output format (json)
   ```

4. Verify S3 access:
   ```bash
   aws s3 ls
   ```

The project is configured to use these S3 buckets:
- Production: s3://landing-pad-ai-agents/
- Development: s3://landing-pad-ai-agents-dev/

#### 6. AI API Keys

1. **Anthropic Claude API Key**:
   - Sign up for an account at [Anthropic's website](https://www.anthropic.com/)
   - Navigate to the API section of your account
   - Generate a new API key
   - Save this key securely for use in the `.env` file

2. **OpenAI API Key**:
   - Sign up for an account at [OpenAI's website](https://openai.com/)
   - Navigate to the API section in your account settings
   - Create a new secret key
   - Save this key securely for use in the `.env` file

### Setup Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/mctata/landing-pad-ai-agents.git
   cd landing-pad-ai-agents
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration settings
   ```

   Essential settings to configure in your `.env` file:
   ```
   # PostgreSQL Connection
   DATABASE_URL=postgres://postgres:password@localhost:5432/agents_db
   DB_USER=postgres
   DB_PASSWORD=password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=agents_db
   
   # Redis Connection (for caching)
   REDIS_LOCAL_URL=redis://localhost:6379
   
   # S3 Storage Configuration
   S3_BUCKET_DEV=landing-pad-ai-agents-dev
   S3_REGION=us-east-1
   S3_STORAGE_PREFIX=storage
   S3_UPLOADS_PREFIX=uploads
   
   # Message Queue Configuration
   RABBITMQ_URL=amqp://localhost
   
   # AI Service API Keys
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Application Settings
   NODE_ENV=development
   PORT=3000
   HOST=localhost
   ```

4. Create PostgreSQL database locally:
   ```bash
   # Log into PostgreSQL
   sudo -u postgres psql

   # Create the database
   CREATE DATABASE agents_db;

   # Create a user (if needed)
   CREATE USER your_username WITH PASSWORD 'your_password';

   # Grant privileges
   GRANT ALL PRIVILEGES ON DATABASE agents_db TO your_username;

   # Exit
   \q
   ```

5. Initialize the database:
   ```bash
   npm run db:init
   ```

5. Start the agent system:
   ```bash
   npm run start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

## Verifying Your Installation

After starting the system, you should be able to:

1. Access the admin interface at http://localhost:3000/admin
2. See agent logs in the console or logs directory
3. Run a simple test to verify all agents are functioning:
   ```bash
   npm run test:system
   ```

### Testing Individual Agents

You can test individual agents using these commands:

```bash
# Test Content Strategy Agent
npm run agent:strategy -- test

# Test Content Creation Agent
npm run agent:creation -- test

# Test other agents...
npm run agent:management -- test
npm run agent:optimisation -- test
npm run agent:brand -- test
```

## Configuration

The system is configured through several key files:

- `config/agents.json`: Settings for each agent's behavior and capabilities
- `config/messaging.json`: Message bus and communication settings
- `config/storage.json`: Knowledge repository and data storage configuration
- `config/external-services.json`: API keys and endpoints for external services

## Usage

### Admin Dashboard

Access the admin dashboard at `http://localhost:3000/admin` (or your configured URL). The dashboard provides:

- Real-time agent status monitoring
- Content pipeline visualization
- Content performance metrics
- Manual intervention capabilities

### Agent Commands

Interact with agents through the CLI for testing and development:

```bash
# Generate a content brief
npm run agent:strategy create-brief --type=blog --topic="AI Website Features"

# Create content from a brief
npm run agent:creation generate --brief=BRIEF-2025-001

# Run content through brand verification
npm run agent:brand verify --content=DRAFT-2025-001

# Publish approved content
npm run agent:management publish --content=DRAFT-2025-001 --schedule="2025-04-01T09:00:00Z"

# Analyze content performance
npm run agent:optimisation analyze --content=CONT-2025-001
```

## Development

### Adding New Agent Capabilities

1. Create a new module in the appropriate agent directory:
   ```bash
   mkdir -p agents/content-strategy/modules/your-module-name
   touch agents/content-strategy/modules/your-module-name/index.js
   ```

2. Implement the module following the agent interface template
3. Register the module in the agent's main configuration
4. Test the module using the provided testing framework

### Custom Integrations

To integrate with additional external systems:

1. Create a new connector in the `integrations/` directory
2. Implement the standard connector interface methods
3. Add configuration to `config/external-services.json`
4. Register the connector with relevant agents

## Examples

The repository includes example outputs from the agent system:

- Blog posts in `examples/daily_outputs/blog_post.md`
- Social media content in `examples/daily_outputs/social_media_package.md`
- Landing page copy in `examples/daily_outputs/landing_page.md`
- Content calendars in `examples/daily_outputs/content_calendar.md`
- Performance reports in `examples/daily_outputs/optimisation_report.md`

These examples demonstrate the capabilities of the agent system and provide templates for customization.

## Workflows

### Daily Content Operations

1. **Morning Planning (08:00-09:00)**
   - Content Strategy Agent reviews performance data and updates priorities
   - Content Management Agent provides status report on scheduled content

2. **Content Production (09:00-15:00)**
   - Content Creation Agent generates assigned content pieces
   - Brand Consistency Agent reviews and provides feedback
   - Optimisation Agent evaluates for SEO and conversion optimization

3. **Publishing and Distribution (15:00-17:00)**
   - Content Management Agent formats and schedules approved content
   - Content Strategy Agent plans next day's priorities
   - Optimisation Agent begins monitoring performance

### Special Campaign Workflow

1. **Campaign Planning**
   - Content Strategy Agent develops campaign brief and content plan
   - All agents collaborate to establish campaign requirements

2. **Asset Development**
   - Content Creation Agent produces campaign assets in parallel
   - Brand Consistency Agent ensures unified messaging
   - Optimisation Agent provides pre-launch recommendations

3. **Launch and Optimization**
   - Content Management Agent coordinates synchronized publishing
   - Optimisation Agent monitors real-time performance
   - Content Strategy Agent adjusts approach based on initial results

## Troubleshooting

### Common Issues

- **Messaging Errors**: Check RabbitMQ status and connection settings with `rabbitmqctl status`
- **Agent Unresponsive**: Verify agent process is running and check logs
- **Content Generation Failed**: Ensure AI models are accessible and API keys are valid
- **Performance Data Missing**: Check analytics integration configurations
- **Database Connection Issues**: Verify PostgreSQL is running with `pg_isready -h localhost -p 5432`
- **S3 Storage Issues**: Check AWS credentials with `aws sts get-caller-identity`
- **Redis Connection Issues**: Check Redis connection with `redis-cli ping`

### Logging

Logs are stored in the `logs/` directory with the following files:

- `system.log`: Overall system operation logs
- `agents/*.log`: Individual agent activity logs
- `messaging.log`: Message bus transactions
- `errors.log`: Consolidated error reporting

### Support

For additional support:

- Check the documentation in the `docs/` directory
- Review known issues in the GitHub repository
- Contact the development team at dev@landingpaddigital.com

## Roadmap

Future development plans include:

- Enhanced AI models for more personalized content creation
- Additional industry-specific content templates
- Improved analytics and prediction capabilities
- Multi-language support for international markets
- Visual content generation capabilities

## Contributing

Contributions to the project are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the project's coding standards and includes appropriate tests.

## License

This project is licensed under the terms of the custom Landing Pad Digital license. See the LICENSE file for details.

---

For additional information, please contact the Landing Pad Digital AI team at ai-team@landingpaddigital.com