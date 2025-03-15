# Landing Pad Digital AI Content Agents

A comprehensive framework for automating and enhancing Landing Pad Digital's daily content operations using a team of specialised AI agents.

## Project Overview

This repository contains the implementation details, collaboration models, and example outputs for Landing Pad Digital's AI agent content team. Each agent is designed to perform specific tasks while collaborating seamlessly to achieve the overarching goal of:

1. Educating users about Landing Pad Digital's AI-powered website builder
2. Establishing the brand as a professional authority in the website creation space
3. Streamlining content operations for maximum efficiency and impact

## Agent Team Structure

Our AI content team consists of five specialised agents:

1. **Content Strategy Agent**: Analyses audience data and trends to inform content decisions
2. **Content Creation Agent**: Generates high-quality blog posts, website copy, and social media content
3. **Content Management Agent**: Organises, categorises, and tracks content across platforms
4. **Optimisation Agent**: Analyses performance metrics and provides SEO recommendations
5. **Brand Consistency Agent**: Maintains Landing Pad Digital's voice, tone, and messaging

## Implementation Status

The following components have been implemented:

| Agent | Status | Key Modules |
|-------|--------|-------------|
| Content Strategy | ✅ Complete | Trend Analyzer, Audience Insights, Brief Generator |
| Content Creation | ✅ Complete | Blog Generator, Social Media Generator, Website Copy Generator, Headline Generator, Content Editor |
| Content Management | ✅ Complete | Content Categoriser, Content Tracker, Freshness Checker, Workflow Manager |
| Optimisation | ✅ Complete | SEO Optimizer, Performance Analyzer, A/B Testing Generator, Metrics Tracker, Reporting |
| Brand Consistency | ✅ Complete | Consistency Checker, Terminology Checker, Consistency Fixer, Aligned Generator |

## Recent Updates

- Added Performance Analyzer module to Optimisation Agent
- Added A/B Testing Generator module to Optimisation Agent
- Added Metrics Tracker module to Optimisation Agent
- Added Reporting module to Optimisation Agent
- Added comprehensive implementation guide
- Updated project documentation

## Architecture and Collaboration Model

The system follows an event-driven architecture with message-based communication between agents. This approach enables:

- Loose coupling between agents
- Asynchronous processing
- Scalable and resilient operation
- Extensibility for new features

For detailed information on:
- [System Architecture](system_architecture/README.md)
- [Agent Collaboration Model](collaboration_model/agent_interactions.md)
- [Getting Started Guide](getting_started.md)
- [Implementation Guide](IMPLEMENTATION_GUIDE.md)

## Key Features

- **AI-Powered Content Generation**: Create high-quality, brand-consistent content across multiple formats
- **SEO Optimization**: Automatically optimize content for search engines
- **Brand Consistency Enforcement**: Ensure all content adheres to brand guidelines
- **Automated Content Management**: Track, categorize, and manage content across its lifecycle
- **Data-Driven Strategy**: Use audience and performance data to inform content strategy
- **Performance Analysis**: Track and analyze content performance metrics
- **A/B Testing**: Generate and evaluate content variations

## Example Outputs

See the `/examples/daily_outputs` directory for sample outputs including:
- [Blog posts](examples/daily_outputs/blog_post.md)
- [Social media updates](examples/daily_outputs/social_media_package.md)
- [Landing page copy](examples/daily_outputs/landing_page.md)
- [Content calendars](examples/daily_outputs/content_calendar.md)
- [Performance reports](examples/daily_outputs/optimisation_report.md)

## Core Services

The system is built around several core services that provide shared functionality:

- **Messaging Service**: Handles communication between agents via RabbitMQ
- **Storage Service**: Provides database access via PostgreSQL
- **AI Provider Service**: Manages interaction with AI models from Anthropic and OpenAI

## Technology Stack

- **Language**: JavaScript/Node.js
- **Message Broker**: RabbitMQ
- **Database**: PostgreSQL with Sequelize ORM
- **AI Models**: Anthropic Claude and OpenAI GPT models
- **API Framework**: Express.js
- **Container Platform**: Docker

## Getting Started

1. Clone this repository
2. Copy `.env.example` to `.env` and configure your environment variables
3. Install dependencies with `npm install`
4. Run the database initialization script: `npm run db:init`
5. Start the system with `npm start` or in development mode with `npm run dev`

See the [Getting Started Guide](getting_started.md) for detailed instructions, including how to install all prerequisites.

## Running Individual Agents

You can run agents individually using the following commands:

```bash
npm run agent:strategy    # Run Content Strategy Agent
npm run agent:creation    # Run Content Creation Agent
npm run agent:management  # Run Content Management Agent
npm run agent:optimisation # Run Optimisation Agent
npm run agent:brand       # Run Brand Consistency Agent
```

## System Status and Health Checks

The system includes health check endpoints to verify operation:

- `GET /api/health`: Basic health check
- `GET /api/status`: Detailed system status (requires authentication)

## Agent Interaction Examples

### Example 1: Content Creation Flow

1. Content Strategy Agent generates a content brief with topic "AI Website Design Trends"
2. Content Creation Agent receives brief and creates a blog post
3. Brand Consistency Agent checks content for brand alignment
4. Content Management Agent categorizes and schedules the content
5. Optimisation Agent provides SEO recommendations before publishing

### Example 2: Content Optimisation Flow

1. Metrics Tracker module collects performance data for published content
2. Performance Analyzer module identifies underperforming content
3. SEO Optimizer and A/B Testing Generator modules create improvement suggestions
4. Reporting module generates a weekly performance report
5. Content Creation Agent receives recommendations for content updates

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

© 2025 Landing Pad Digital
