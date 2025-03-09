# Content Management Agent

The Content Management Agent is responsible for organising, categorising, and tracking content across multiple platforms to maintain efficient content workflows and ensure timely creation, review, and publishing.

## Agent Functionality

### Inputs

- Content pieces from Content Creation Agent
- Publishing schedule from Content Strategy Agent
- Performance metrics from Optimisation Agent
- Brand guidelines and feedback from Brand Consistency Agent
- Platform-specific requirements and limitations
- Content taxonomy and categorisation system

### Processes

1. **Content Organisation**
   - Tag and categorise content according to topic, format, and audience
   - Maintain content library and asset management system
   - Track content versions and revisions

2. **Workflow Management**
   - Monitor content progress through creation pipeline
   - Flag bottlenecks or delays in content production
   - Send automated reminders for review deadlines
   - Track approval status across stakeholders

3. **Publishing Management**
   - Format content appropriately for each publishing platform
   - Schedule content according to content calendar
   - Verify publishing success across channels
   - Maintain consistent publishing cadence

4. **Content Freshness Assessment**
   - Flag outdated content for review and updates
   - Track content age and relevance metrics
   - Recommend content consolidation or archiving when appropriate
   - Identify evergreen content for regular promotion

5. **Cross-linking and Content Relationships**
   - Identify related content pieces for internal linking
   - Suggest content packages or series opportunities
   - Manage content dependencies and references

### Outputs

- Organised content library with metadata
- Real-time workflow status dashboards
- Publishing schedules and confirmation reports
- Content freshness reports and update recommendations
- Internal linking recommendations
- Content inventory and audit reports

## Collaboration Interfaces

### Provides To:

- **Content Strategy Agent**: Content inventory and gap analysis
- **Content Creation Agent**: Update requirements for existing content
- **Optimisation Agent**: Content organisation data for performance analysis
- **Brand Consistency Agent**: Content scheduling and deployment information

### Receives From:

- **Content Strategy Agent**: Content calendars and publishing priorities
- **Content Creation Agent**: New and revised content
- **Optimisation Agent**: Performance-based recommendations for content updates
- **Brand Consistency Agent**: Brand compliance status for content pieces

## Implementation Details

### Technologies

- Content management system integration
- Workflow automation tools
- Publishing APIs for various platforms
- Document versioning system
- Metadata management framework

### Required Data Sources

- Content repository
- Brand asset management system
- Publishing platform credentials
- Editorial calendar
- Content performance database

## Example Output

### Content Workflow Status Dashboard

```json
{
  "contentPipeline": {
    "inProduction": [
      {
        "id": "BP-2025-032",
        "title": "AI Design Principles for E-commerce Success",
        "type": "Blog Post",
        "status": "In Writing",
        "assignedTo": "Content Creation Agent",
        "dueDate": "2025-03-15",
        "scheduledPublish": "2025-03-20",
        "completionPercentage": 60
      },
      {
        "id": "SM-2025-047",
        "title": "Instagram Carousel: 7 AI Website Features",
        "type": "Social Media Package",
        "status": "Design Review",
        "assignedTo": "Brand Consistency Agent",
        "dueDate": "2025-03-12",
        "scheduledPublish": "2025-03-14",
        "completionPercentage": 80
      }
    ],
    "scheduled": [
      {
        "id": "NL-2025-008",
        "title": "March Newsletter: AI Design Trends",
        "type": "Email Newsletter",
        "status": "Ready to Publish",
        "platform": "Mailchimp",
        "scheduledPublish": "2025-03-15 09:00:00",
        "approvedBy": "Brand Consistency Agent"
      }
    ],
    "needsRefresh": [
      {
        "id": "BP-2024-103",
        "title": "Getting Started with AI Website Design",
        "type": "Blog Post",
        "published": "2024-08-10",
        "lastUpdated": "2024-08-10",
        "pageviews": 4562,
        "reason": "High-traffic content older than 6 months",
        "updateRecommendation": "Update screenshots to new UI, refresh statistics"
      }
    ]
  },
  "publishingActivity": {
    "today": [
      {
        "id": "SM-2025-046",
        "title": "Quick Tip Tuesday: AI Color Palettes",
        "platform": "Twitter",
        "scheduledTime": "2025-03-11 12:30:00",
        "status": "Published",
        "publishConfirmation": "https://twitter.com/LandingPadDigital/status/1767382932"
      }
    ],
    "thisWeek": 7,
    "nextWeek": 8
  }
}
```

### Content Freshness Report

```markdown
# Content Freshness Report: March 2025

## High Priority Updates Required

1. **"Complete Guide to AI Website Creation" (Landing Page)**
   - Published: November 10, 2024
   - Issues: References outdated feature names, missing 3 new templates
   - Recommendation: Complete refresh with new screenshots and feature names
   - Traffic Impact: High (4,200 monthly visits)

2. **"How AI Transforms Small Business Websites" (Blog Post)**
   - Published: September 5, 2024
   - Issues: Statistics more than 6 months old
   - Recommendation: Update statistics, add 2-3 new case studies
   - Traffic Impact: Medium (1,800 monthly visits)

## Moderate Priority Updates

1. **"AI Website Builder FAQ" (Resource Page)**
   - Published: January 15, 2025
   - Issues: Missing questions about new e-commerce features
   - Recommendation: Add 5 new FAQ items related to latest release
   - Traffic Impact: Medium (950 monthly visits)

## Content Consolidation Opportunities

1. **Combine "AI for Restaurants" and "AI for Hospitality Websites"**
   - Significant content overlap (73%)
   - Recommendation: Create comprehensive industry guide, redirect older URL
   - Traffic Impact: Low (combined 700 monthly visits)

## Evergreen Promotion Candidates

1. **"5-Minute AI Website Setup Tutorial" (Video + Article)**
   - Consistently high engagement (4:32 avg watch time)
   - Recommendation: Refresh thumbnail, promote in newsletter
   - Traffic Potential: High (currently 1,200 monthly views)
```