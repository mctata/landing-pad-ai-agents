# Agent Communication Protocol Specification

## Overview

This document defines the communication protocol that enables Landing Pad Digital's AI agents to collaborate effectively, share information, and coordinate activities. The protocol ensures standardized, reliable, and secure communication between all components of the AI agent ecosystem.

## Message Bus Architecture

### Core Components

1. **Message Exchange**: Central routing system for all inter-agent communications
2. **Agent Queues**: Dedicated message queues for each agent
3. **Topic Channels**: Subject-based channels for broadcasting information
4. **Dead Letter Queue**: Storage for undeliverable or unprocessed messages
5. **Priority System**: Mechanism for handling urgent communications

### Protocol Flow

```
               +-------------------+
               |                   |
               | Message Exchange  |
               |                   |
               +-------------------+
                 /      |       \
                /       |        \
               /        |         \
 +-------------+  +-------------+  +-------------+
 |             |  |             |  |             |
 | Agent Queue |  | Agent Queue |  | Agent Queue |
 | (Strategy)  |  | (Creation)  |  |   (etc.)    |
 |             |  |             |  |             |
 +-------------+  +-------------+  +-------------+
        |               |               |
        v               v               v
 +-------------+  +-------------+  +-------------+
 |             |  |             |  |             |
 |  Strategy   |  |  Creation   |  |    Other    |
 |    Agent    |  |    Agent    |  |    Agents   |
 |             |  |             |  |             |
 +-------------+  +-------------+  +-------------+
```

## Message Structure

### Standard Message Format

All messages exchanged between agents follow this JSON structure:

```json
{
  "messageId": "msg-2025-03-11-0042",
  "timestamp": "2025-03-11T14:32:17Z",
  "senderAgent": "ContentStrategyAgent",
  "recipientAgents": ["ContentCreationAgent"],
  "messageType": "ContentBriefAssignment",
  "conversationId": "conv-2025-03-11-0023",
  "priority": "Normal",
  "payload": {
    "contentId": "BP-2025-034",
    "briefLocation": "/briefs/BP-2025-034.json",
    "dueDate": "2025-03-15T17:00:00Z",
    "additionalNotes": "Focus on AI personalization features"
  },
  "requiredResponse": true,
  "responseDeadline": "2025-03-11T16:00:00Z",
  "metadata": {
    "contentType": "Blog",
    "campaign": "March-AI-Features",
    "version": "1.0"
  }
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| messageId | String | Yes | Unique identifier for the message |
| timestamp | ISO 8601 | Yes | Message creation time |
| senderAgent | String | Yes | Identifier of the sending agent |
| recipientAgents | Array | Yes | List of recipient agent identifiers |
| messageType | String | Yes | Type of message defining its purpose |
| conversationId | String | No | Groups related messages together |
| priority | String | Yes | Message importance (Low, Normal, High, Urgent) |
| payload | Object | Yes | Message content specific to the message type |
| requiredResponse | Boolean | Yes | Whether the message requires a response |
| responseDeadline | ISO 8601 | No | When a response is needed by |
| metadata | Object | No | Additional contextual information |

## Message Types

### Content Strategy Messages

| Message Type | Description | Sender | Recipients |
|--------------|-------------|--------|------------|
| `ContentBriefAssignment` | Assigns new content brief | Strategy | Creation |
| `ContentCalendarUpdate` | Publishes updated content schedule | Strategy | All |
| `TrendAlert` | Notifies of emerging industry trend | Strategy | All |
| `AudienceInsight` | Shares new audience behavior data | Strategy | All |
| `ContentGapNotification` | Identifies missing content areas | Strategy | Creation, Management |

#### Example: ContentBriefAssignment

```json
{
  "messageId": "msg-2025-03-11-0042",
  "timestamp": "2025-03-11T14:32:17Z",
  "senderAgent": "ContentStrategyAgent",
  "recipientAgents": ["ContentCreationAgent"],
  "messageType": "ContentBriefAssignment",
  "conversationId": "conv-2025-03-11-0023",
  "priority": "Normal",
  "payload": {
    "contentId": "BP-2025-034",
    "contentType": "BlogPost",
    "title": "5 Ways AI Transforms Website Personalization",
    "targetKeywords": ["ai website personalization", "dynamic content", "personalized web experience"],
    "targetAudience": "Small business owners with established websites",
    "objective": "Highlight Landing Pad Digital's personalization features and drive trial signups",
    "dueDate": "2025-03-15T17:00:00Z",
    "wordCount": {"min": 1200, "max": 1800},
    "briefLocation": "/briefs/BP-2025-034.json",
    "additionalNotes": "Include customer examples and specific metrics where possible"
  },
  "requiredResponse": true,
  "responseDeadline": "2025-03-11T16:00:00Z"
}
```

### Content Creation Messages

| Message Type | Description | Sender | Recipients |
|--------------|-------------|--------|------------|
| `ContentDraftSubmission` | Submits new content draft | Creation | Brand, Management |
| `RevisionRequest` | Requests clarification or info | Creation | Strategy, Brand |
| `ContentStatusUpdate` | Updates on draft progress | Creation | Strategy, Management |
| `AlternativeHeadlinesProposal` | Suggests multiple title options | Creation | Strategy, Brand |
| `ContentComponentDelivery` | Delivers specific content parts | Creation | Management |

#### Example: ContentDraftSubmission

```json
{
  "messageId": "msg-2025-03-12-0067",
  "timestamp": "2025-03-12T10:45:22Z",
  "senderAgent": "ContentCreationAgent",
  "recipientAgents": ["BrandConsistencyAgent", "ContentManagementAgent"],
  "messageType": "ContentDraftSubmission",
  "conversationId": "conv-2025-03-11-0023",
  "priority": "Normal",
  "payload": {
    "contentId": "BP-2025-034",
    "contentType": "BlogPost",
    "title": "5 Ways AI Transforms Website Personalization for Small Businesses",
    "draftLocation": "/content/drafts/BP-2025-034-v1.md",
    "wordCount": 1456,
    "keywordsIncluded": ["ai website personalization", "dynamic content", "personalized web experience", "customer engagement"],
    "readingTime": "6 minutes",
    "notes": "Focused on SMB applications with specific examples as requested"
  },
  "requiredResponse": true,
  "responseDeadline": "2025-03-13T10:45:22Z"
}
```

### Content Management Messages

| Message Type | Description | Sender | Recipients |
|--------------|-------------|--------|------------|
| `PublishingScheduleUpdate` | Updates content publish dates | Management | All |
| `ContentStatusChange` | Notifies of content status change | Management | All |
| `ContentRefreshRequest` | Requests update of older content | Management | Strategy, Creation |
| `PublishingConfirmation` | Confirms content publication | Management | All |
| `ContentOrganizationUpdate` | Updates to content taxonomy | Management | All |

#### Example: PublishingConfirmation

```json
{
  "messageId": "msg-2025-03-17-0112",
  "timestamp": "2025-03-17T09:00:05Z",
  "senderAgent": "ContentManagementAgent",
  "recipientAgents": ["ContentStrategyAgent", "ContentCreationAgent", "BrandConsistencyAgent", "OptimisationAgent"],
  "messageType": "PublishingConfirmation",
  "conversationId": "conv-2025-03-11-0023",
  "priority": "Normal",
  "payload": {
    "contentId": "BP-2025-034",
    "contentType": "BlogPost",
    "title": "5 Ways AI Transforms Website Personalization for Small Businesses",
    "publishedUrl": "https://landingpaddigital.com/blog/ai-website-personalization-small-business",
    "publishTimestamp": "2025-03-17T09:00:00Z",
    "socialShareStatus": {
      "twitter": "scheduled",
      "linkedin": "scheduled",
      "facebook": "scheduled"
    },
    "authorAttribution": "Landing Pad Digital Team",
    "categories": ["AI Features", "Website Personalization", "Small Business"]
  },
  "requiredResponse": false
}
```

### Brand Consistency Messages

| Message Type | Description | Sender | Recipients |
|--------------|-------------|--------|------------|
| `BrandReviewResult` | Provides brand compliance review | Brand | Creation, Management |
| `TerminologyUpdate` | Updates to approved terminology | Brand | All |
| `BrandGuidelineChange` | Notifies of brand guide changes | Brand | All |
| `ToneVoiceRecommendation` | Suggests tone adjustments | Brand | Creation |
| `VisualAssetRecommendation` | Suggests image/design assets | Brand | Creation, Management |

#### Example: BrandReviewResult

```json
{
  "messageId": "msg-2025-03-13-0078",
  "timestamp": "2025-03-13T11:30:45Z",
  "senderAgent": "BrandConsistencyAgent",
  "recipientAgents": ["ContentCreationAgent", "ContentManagementAgent"],
  "messageType": "BrandReviewResult",
  "conversationId": "conv-2025-03-11-0023",
  "priority": "High",
  "payload": {
    "contentId": "BP-2025-034",
    "overallScore": 87,
    "approvalStatus": "RevisionRequired",
    "requiredChanges": [
      {
        "type": "Terminology",
        "location": "Paragraph 3, sentence 2",
        "current": "AI website creator",
        "suggested": "AI website builder",
        "rationale": "Consistent product terminology"
      },
      {
        "type": "Tone",
        "location": "Introduction",
        "issue": "Overly technical language",
        "suggestion": "Simplify technical concepts for small business audience",
        "rationale": "Maintain approachable brand voice"
      }
    ],
    "recommendedChanges": [
      {
        "type": "VisualAsset",
        "location": "Header image",
        "suggestion": "Replace stock image with branded illustration from asset library",
        "recommendedAssets": ["/assets/images/personalization-illustration-01.jpg", "/assets/images/dashboard-customization-02.jpg"]
      }
    ],
    "reviewNotes": "Overall strong alignment with brand voice, minor terminology issues to address before publishing."
  },
  "requiredResponse": true,
  "responseDeadline": "2025-03-14T11:30:45Z"
}
```

### Optimisation Messages

| Message Type | Description | Sender | Recipients |
|--------------|-------------|--------|------------|
| `PerformanceReport` | Shares content performance data | Optimisation | All |
| `SEORecommendation` | Provides SEO improvement ideas | Optimisation | Creation, Management |
| `ABTestResult` | Reports on A/B test outcomes | Optimisation | All |
| `ConversionInsight` | Shares conversion funnel data | Optimisation | Strategy, Creation |
| `CompetitorAnalysisUpdate` | Updates on competitor content | Optimisation | Strategy, Creation |

## Message Exchange Patterns

### Request-Response

Used when one agent needs information or action from another agent and expects a direct response.

```sequence
Agent A->Agent B: Request (requiredResponse: true)
Agent B->Agent A: Response (references original messageId)
```

### Publish-Subscribe

Used for broadcasting information to multiple agents without expecting direct responses.

```sequence
Agent A->Message Bus: Publish to Topic
Message Bus->Agent B: Distribute
Message Bus->Agent C: Distribute
Message Bus->Agent D: Distribute
```

### Workflow Coordination

Used to coordinate multi-step processes involving several agents.

```sequence
Strategy->Creation: ContentBriefAssignment
Creation->Brand: ContentDraftSubmission
Brand->Creation: BrandReviewResult
Creation->Management: ContentDraftSubmission (revised)
Management->Optimisation: SEOReviewRequest
Optimisation->Management: SEORecommendation
Management->All: PublishingConfirmation
```

## Implementation Guidelines

### RabbitMQ Configuration

```javascript
// Sample RabbitMQ topic exchange setup
const exchangeOptions = {
  durable: true,
  autoDelete: false
};

channel.assertExchange('agent-messages', 'topic', exchangeOptions);

// Queue binding for Content Creation Agent
channel.assertQueue('creation-queue', { durable: true });
channel.bindQueue('creation-queue', 'agent-messages', 'strategy.brief.#');
channel.bindQueue('creation-queue', 'agent-messages', 'brand.review.#');
channel.bindQueue('creation-queue', 'agent-messages', 'optimisation.seo.#');
```

### Routing Keys Structure

The routing key format follows this pattern: `<sender>.<message-type>.<sub-type>`

Examples:
- `strategy.brief.assignment` - Content brief assignments from Strategy Agent
- `creation.draft.submission` - Content draft submissions from Creation Agent
- `brand.review.result` - Brand review results from Brand Consistency Agent
- `optimisation.seo.recommendation` - SEO recommendations from Optimisation Agent
- `management.publishing.confirmation` - Publishing confirmations from Management Agent