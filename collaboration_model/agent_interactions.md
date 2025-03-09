# Agent Collaboration Model

## Overview

The Landing Pad Digital AI Agents collaborate through a structured event-driven system that allows them to work together while maintaining separation of concerns. This document outlines the specific interactions between agents, detailing how they communicate and collaborate to create a seamless content operations workflow.

## Core Interaction Patterns

### 1. Event-Based Collaboration

Agents communicate primarily through events published to a central message bus. This enables:
- Loose coupling between agents
- Asynchronous processing
- Parallel operations
- Selective event subscription

### 2. Command-Based Interactions

For direct, synchronous operations, agents use a command pattern where:
- Commands are explicit requests for an agent to perform an action
- Commands include all necessary data for processing
- Responses are returned directly to the caller

### 3. Data-Sharing Through Storage

Agents share information via a centralized storage system for:
- Persistent content items
- Workflow state
- Analytics data
- Configuration settings

## Agent Interaction Diagram

```
┌─────────────────┐    Creates Brief     ┌─────────────────┐
│                 │──────────────────────>                 │
│                 │                       │                 │
│ Content Strategy│                       │ Content Creation│
│                 │<─────────────────────┤                 │
│                 │   Content Created     │                 │
└─────────────────┘                       └─────────────────┘
        │                                          │
        │                                          │
        │                                          │
        │                                          ▼
        │                                 ┌─────────────────┐
        │                                 │                 │
        │                                 │Brand Consistency│
        │                                 │                 │
        │                                 │                 │
        │                                 └─────────────────┘
        │                                          │
        │                                          │
        │                                          │
        ▼                                          ▼
┌─────────────────┐                       ┌─────────────────┐
│                 │                       │                 │
│  Optimisation   │<─────────────────────┤Content Management│
│                 │                       │                 │
│                 │──────────────────────>                 │
└─────────────────┘                       └─────────────────┘
```

## Key Interaction Flows

### 1. Content Creation Workflow

**Trigger**: New content brief creation

**Flow**:
1. Content Strategy Agent creates a content brief
2. Content Strategy Agent publishes `brief_created` event
3. Content Creation Agent subscribes to `brief_created` events
4. Content Creation Agent generates content based on brief
5. Content Creation Agent publishes `content_created` event
6. Brand Consistency Agent reviews content and publishes `review_completed` event
7. Content Management Agent categorizes and tracks content
8. Optimisation Agent generates SEO recommendations
9. Content Creation Agent applies recommendations
10. Content Management Agent schedules content for publishing

### 2. Content Optimization Workflow

**Trigger**: Performance analysis request or scheduled evaluation

**Flow**:
1. Optimisation Agent analyzes content performance
2. Optimisation Agent publishes `analysis_completed` event
3. Content Strategy Agent adjusts future content strategy
4. Optimisation Agent generates `seo_recommendations`
5. Content Creation Agent applies SEO recommendations
6. Brand Consistency Agent verifies updated content
7. Content Management Agent updates content status

### 3. Content Management Workflow

**Trigger**: Content status change or scheduled check

**Flow**:
1. Content Management Agent checks content freshness
2. Content Management Agent publishes `content_needs_refresh` event
3. Content Strategy Agent evaluates refresh priority
4. Content Creation Agent updates content
5. Brand Consistency Agent reviews updated content
6. Optimisation Agent provides new recommendations
7. Content Management Agent schedules republishing

## Detailed Event Catalog

Below are the key events used for inter-agent communication:

### Content Strategy Agent Events

| Event Name | Description | Subscribers |
|------------|-------------|-------------|
| `brief_created` | New content brief created | Content Creation |
| `brief_updated` | Existing brief updated | Content Creation |
| `content_calendar_generated` | New content calendar created | Content Management |
| `audience_analyzed` | New audience analysis completed | All Agents |
| `trend_researched` | Topic trend analysis completed | Content Creation, Optimisation |

### Content Creation Agent Events

| Event Name | Description | Subscribers |
|------------|-------------|-------------|
| `content_created` | New content generated | Brand Consistency, Content Management, Optimisation |
| `content_edited` | Content edited or updated | Brand Consistency, Content Management |
| `content_approved` | Content ready for publishing | Content Management |
| `seo_recommendations_applied` | SEO changes applied to content | Optimisation, Content Management |

### Content Management Agent Events

| Event Name | Description | Subscribers |
|------------|-------------|-------------|
| `content_categorised` | Content categorized | Optimisation |
| `content_scheduled` | Content scheduled for publishing | Optimisation |
| `content_published` | Content published to platform | Optimisation, Content Strategy |
| `content_needs_refresh` | Content identified as stale | Content Strategy, Content Creation |
| `workflow_status_updated` | Content workflow status changed | All Agents |

### Optimisation Agent Events

| Event Name | Description | Subscribers |
|------------|-------------|-------------|
| `analysis_completed` | Content performance analysis completed | Content Strategy, Content Creation |
| `seo_recommendations` | SEO recommendations generated | Content Creation |
| `ab_testing_suggestions` | A/B testing variation suggestions | Content Creation, Content Management |
| `metric_threshold_alert` | Performance metric threshold crossed | Content Strategy, Content Management |

### Brand Consistency Agent Events

| Event Name | Description | Subscribers |
|------------|-------------|-------------|
| `review_completed` | Brand consistency review completed | Content Creation, Content Management |
| `issues_fixed` | Brand consistency issues fixed | Content Management |
| `guidelines_updated` | Brand guidelines updated | All Agents |

## Command Interfaces

Each agent exposes a set of commands that can be called by external systems or other agents:

### Content Strategy Agent Commands

- `create_brief`: Create a new content brief
- `update_brief`: Update an existing content brief
- `generate_calendar`: Generate a content calendar
- `analyze_audience`: Analyze audience data
- `research_trend`: Research trend for a topic

### Content Creation Agent Commands

- `generate_content`: Generate content based on a brief
- `edit_content`: Edit existing content
- `generate_campaign`: Generate multiple pieces of content for a campaign
- `generate_headlines`: Generate headlines and calls-to-action

### Content Management Agent Commands

- `track_content`: Track content item
- `categorise_content`: Categorise content
- `schedule_content`: Schedule content for publishing
- `update_workflow_status`: Update content workflow status
- `check_content_freshness`: Check content freshness
- `generate_report`: Generate content report
- `search_content`: Search content

### Optimisation Agent Commands

- `analyse_performance`: Analyse content performance
- `generate_seo_recommendations`: Generate SEO recommendations
- `generate_ab_testing_suggestions`: Generate A/B testing suggestions
- `track_metrics`: Track content metrics
- `generate_report`: Generate content performance report

### Brand Consistency Agent Commands

- `review_content`: Review content for brand consistency
- `fix_consistency_issues`: Fix brand consistency issues
- `update_guidelines`: Update brand guidelines
- `check_terminology`: Check content against brand terminology
- `generate_aligned_content`: Generate brand-aligned content

## Data Exchange Formats

Agents exchange data in standardized JSON formats:

### Content Item

```json
{
  "_id": "content_item_id",
  "type": "blog|social|website|email",
  "title": "Content Title",
  "content": "Content text or structured object",
  "meta_description": "SEO meta description",
  "keywords": ["keyword1", "keyword2"],
  "categories": ["category1", "category2"],
  "status": "draft|pending_review|approved|published",
  "review_status": "pending|approved|needs_revision",
  "brand_review_status": "pending|approved|needs_revision",
  "created_at": "2025-01-01T12:00:00Z",
  "created_by": "user_id",
  "updated_at": "2025-01-02T12:00:00Z",
  "updated_by": "user_id",
  "metrics": {
    "views": 1000,
    "engagement_rate": 2.5,
    "conversion_rate": 1.2
  }
}
```

### Content Brief

```json
{
  "_id": "brief_id",
  "type": "blog|social|website|email",
  "topic": "Brief Topic",
  "target_audience": "Target audience description or object",
  "keywords": ["keyword1", "keyword2"],
  "content": "Brief content structure and requirements",
  "status": "created|in_progress|completed",
  "created_at": "2025-01-01T12:00:00Z",
  "created_by": "user_id"
}
```

### Event Message

```json
{
  "id": "event_id",
  "type": "event_type",
  "agent": "agent_name",
  "payload": {
    "key1": "value1",
    "key2": "value2"
  },
  "timestamp": "2025-01-01T12:00:00Z",
  "correlation_id": "original_command_id"
}
```

### Command Message

```json
{
  "id": "command_id",
  "type": "command_type",
  "payload": {
    "key1": "value1",
    "key2": "value2"
  },
  "timestamp": "2025-01-01T12:00:00Z",
  "user_id": "user_id"
}
```

## Collaboration Examples

### Example 1: Blog Post Creation

1. Content Strategy Agent creates a brief for a blog post about "AI Website Building Trends"
2. Content Creation Agent generates a draft blog post
3. Brand Consistency Agent reviews and approves the post with minor suggestions
4. Content Creation Agent applies the suggested changes
5. Optimisation Agent provides SEO recommendations
6. Content Creation Agent applies SEO recommendations
7. Content Management Agent categorizes the post under "AI Technology" and "Website Building"
8. Content Management Agent schedules the post for publication
9. Optimisation Agent begins tracking metrics after publication

### Example 2: Content Refresh Workflow

1. Content Management Agent's scheduled freshness check identifies a blog post as outdated
2. Content Strategy Agent evaluates the post and determines it needs significant updates
3. Content Creation Agent updates the post with current information and statistics
4. Brand Consistency Agent verifies the updates maintain brand consistency
5. Optimisation Agent provides updated SEO recommendations
6. Content Management Agent updates the post's status and republishes it
7. Optimisation Agent compares performance metrics before and after the refresh

## Error Handling and Resilience

The collaboration model includes mechanisms for handling errors and ensuring system resilience:

1. **Event Retry**: Failed event processing can be retried with exponential backoff
2. **Dead Letter Queues**: Unprocessable events are moved to a dead letter queue for investigation
3. **Circuit Breaking**: Agents can temporarily suspend operations when downstream dependencies fail
4. **State Recovery**: Agents can recover state after restart by querying the database
5. **Graceful Degradation**: Agents can operate with reduced functionality when some modules are unavailable

## Monitoring and Debugging

The collaboration model supports comprehensive monitoring:

1. **Correlation IDs**: Events and commands include correlation IDs for end-to-end tracing
2. **Structured Logging**: All agents log events in a structured format with consistent fields
3. **Performance Metrics**: Agents report processing times and throughput metrics
4. **Event Visualization**: A dashboard shows event flow and processing status
5. **Replay Capability**: Events can be replayed for debugging or recovery purposes