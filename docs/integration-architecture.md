# Landing Pad AI Agents - Integration Architecture

## Overview

The Landing Pad Digital AI Agents system comprises five specialized agents:
1. Content Strategy Agent
2. Content Creation Agent
3. Content Management Agent
4. Optimisation Agent
5. Brand Consistency Agent

This document outlines the integration layer that enables these agents to work together cohesively.

## Core Components

### 1. Message Bus System
- **RabbitMQ Implementation**: Handles asynchronous communication between agents
- **Message Formats**: Standardized JSON schemas for commands, events, and queries
- **Routing Mechanisms**: Topic-based routing to direct messages to appropriate agents
- **Reliability Features**: Acknowledgements, dead letter queues, and retry mechanisms

### 2. Agent Coordination Service
- **Workflow Orchestration**: Manages the flow of tasks between agents
- **State Management**: Tracks content lifecycle using a state machine approach
- **Task Scheduling**: Prioritizes and schedules agent activities
- **Process Monitoring**: Observes system performance and agent health

### 3. Shared Data Store
- **MongoDB Implementation**: Stores all content, metadata, and system state
- **Data Models**: Normalized schemas with appropriate relationships
- **Version Control**: Tracks changes to content over time
- **Access Patterns**: Optimized queries with proper indexing

### 4. Command Line Interface
- **Agent Control**: Commands to activate and monitor agents
- **Workflow Management**: Triggers for starting content workflows
- **System Configuration**: Management of system parameters
- **Reporting**: Basic status reporting and diagnostics

## Data Flow

1. **Content Creation Workflow**
   - Strategy Agent identifies content needs
   - Creation Agent produces content drafts
   - Management Agent stores and organizes content
   - Optimisation Agent improves content performance
   - Brand Consistency Agent ensures alignment with brand guidelines

2. **Event-Driven Communication**
   - State changes trigger events
   - Events are published to the message bus
   - Interested agents subscribe to relevant events
   - Agents respond to events with appropriate actions

3. **Command-Based Actions**
   - CLI or agents issue specific commands
   - Commands are routed to target agents
   - Agents execute commands and publish results
   - Results may trigger subsequent commands

## Message Types and Routing

### Commands
Commands are directives that request an agent to perform a specific action.

- Format: `{agent}.{action}`
- Examples:
  - `content-creation.create-draft`
  - `optimisation.optimize-content`
  - `brand-consistency.check-content`

### Events
Events are notifications that something has happened in the system.

- Format: `{entity}.{event}`
- Examples:
  - `content.created`
  - `content.updated`
  - `workflow.completed`

### Queries
Queries are requests for information from the system.

- Format: `{entity}.{query}`
- Examples:
  - `content.get`
  - `workflow.status`
  - `agent.status`

## Workflow States and Transitions

Each workflow is defined as a state machine with:
- A set of possible states
- Transitions between states
- Agents responsible for each state

For example, the Content Creation Workflow includes these states:
1. `strategy-planning` (Content Strategy Agent)
2. `content-creation` (Content Creation Agent)
3. `content-review` (Content Management Agent)
4. `content-management` (Content Management Agent)
5. `content-optimization` (Optimisation Agent)
6. `brand-consistency-check` (Brand Consistency Agent)
7. `content-revision` (Content Creation Agent)
8. `workflow-completed` (Final state)
9. `workflow-failed` (Final state)

## Data Models

### Content
```javascript
{
  "contentId": "unique-id",
  "title": "Content Title",
  "description": "Content description",
  "body": "Content body...",
  "contentType": "blog-post",
  "tags": ["tag1", "tag2"],
  "status": "draft",
  "version": 3,
  "createdBy": "agent-id",
  "createdAt": "2023-07-15T10:00:00.000Z",
  "updatedBy": "agent-id",
  "updatedAt": "2023-07-15T11:00:00.000Z"
}
```

### Workflow State
```javascript
{
  "workflowId": "unique-id",
  "_state": "content-creation",
  "_created": "2023-07-15T10:00:00.000Z",
  "_lastUpdated": "2023-07-15T11:00:00.000Z",
  "_history": [
    {
      "state": "strategy-planning",
      "timestamp": "2023-07-15T10:00:00.000Z",
      "data": { ... }
    },
    {
      "state": "content-creation",
      "timestamp": "2023-07-15T11:00:00.000Z",
      "data": { ... }
    }
  ],
  "contentId": "related-content-id",
  // Additional workflow-specific data
  ...
}
```

## CLI Commands

The following CLI commands are available:

### Workflow Management
- `workflow:start <type>` - Start a new workflow
- `workflow:status <id>` - Check workflow status
- `workflow:list` - List active workflows

### Content Management
- `content:create` - Create new content
- `content:get <id>` - Get content details
- `content:search` - Search for content

### System Interaction
- `agent:send <agent> <command>` - Send a command to an agent
- `monitor [type]` - Monitor messages on the message bus
- `status` - Show system status

## Implementation Notes

### Reliability and Fault Tolerance
- All message handling includes retry logic
- Failed messages are sent to dead letter queues for inspection
- State is persisted in MongoDB to survive process restarts
- Automatic reconnection to RabbitMQ if connection is lost

### Extensibility
- New agents can be added without modifying existing code
- New workflow types can be defined through the registry
- Message schemas can be extended with new fields

### Performance Considerations
- Database indexes are defined for common query patterns
- Message handling is asynchronous to maximize throughput
- MongoDB is used for efficient document storage and retrieval
- State changes are batched where appropriate

## Deployment Recommendations

- Run RabbitMQ in a clustered configuration for high availability
- Use MongoDB replicas for data redundancy
- Deploy agents as separate services for independent scaling
- Use environment variables for configuration
- Monitor message queue lengths to detect bottlenecks
- Implement proper logging and monitoring

## Future Enhancements

- REST API for integration with external systems
- Web-based admin dashboard for system management
- More sophisticated scheduling and prioritization
- Enhanced reporting and analytics
- Integration with external AI services
