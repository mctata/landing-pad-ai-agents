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
- MongoDB 6.0 or higher
- RabbitMQ 3.10 or higher
- Python 3.10 or higher (for analytics components)

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

4. Initialize the database:
   ```bash
   npm run db:init
   ```

5. Start the agent system:
   ```bash
   npm run start
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

- **Messaging Errors**: Check RabbitMQ status and connection settings
- **Agent Unresponsive**: Verify agent process is running and check logs
- **Content Generation Failed**: Ensure AI models are accessible and API keys are valid
- **Performance Data Missing**: Check analytics integration configurations

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
