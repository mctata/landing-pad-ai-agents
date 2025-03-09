# Content Strategy Agent

The Content Strategy Agent is responsible for analyzing target audience data and generating data-driven content strategies for Landing Pad Digital.

## Agent Functionality

### Inputs

- Market research data
- User behavior analytics
- Competitor content analysis
- Platform objectives and KPIs
- Current content performance metrics
- Industry trends and news

### Processes

1. **Audience Analysis**
   - Segment audiences based on demographics, behavior, and preferences
   - Identify content consumption patterns and preferences
   - Map user journeys and touchpoints

2. **Content Calendar Planning**
   - Develop weekly/monthly content calendars
   - Assign topics to appropriate channels
   - Schedule content for optimal audience engagement

3. **Trend Analysis**
   - Monitor industry news and trends
   - Identify emerging topics relevant to AI website building
   - Flag competitive positioning opportunities

4. **Content Gap Analysis**
   - Identify underserved topics or questions
   - Compare content coverage with competitor offerings
   - Recommend new content areas to establish authority

5. **Channel Strategy**
   - Recommend optimal content formats for each platform
   - Suggest content adaptation strategies for cross-platform publishing
   - Prioritize channels based on audience presence and engagement potential

### Outputs

- Detailed content calendars (weekly/monthly)
- Audience persona profiles with content preferences
- Trend reports and topic recommendations
- Channel-specific content strategies
- Content gap analysis reports
- Priority topic lists with rationale

## Collaboration Interfaces

### Provides To:

- **Content Creation Agent**: Topic briefs, audience insights, and strategic direction
- **Optimisation Agent**: Target keywords and competitive positioning information
- **Content Management Agent**: Publishing schedules and content prioritization

### Receives From:

- **Optimisation Agent**: Performance data and content effectiveness metrics
- **Content Management Agent**: Content inventory and gap analysis
- **Brand Consistency Agent**: Brand positioning guidelines

## Implementation Details

### Technologies

- Natural Language Processing for trend analysis
- Data visualization for audience insights
- Predictive analytics for content performance forecasting
- API integrations with analytics platforms

### Required Data Sources

- Google Analytics
- Social media analytics
- Search Console data
- Industry publications API
- Competitor content monitoring tools

## Example Output

```json
{
  "contentCalendar": {
    "week": "March 10-16, 2025",
    "theme": "AI-Powered Design for Small Businesses",
    "contentItems": [
      {
        "title": "5 Ways AI Website Builders Save Small Business Owners Time",
        "format": "Blog post",
        "channel": "Company blog",
        "publishDate": "2025-03-12",
        "targetAudience": "Small business owners, time-constrained entrepreneurs",
        "keywords": ["AI website builder", "time-saving", "small business website"],
        "objective": "Highlight Landing Pad Digital's time-saving features"
      },
      {
        "title": "AI Website Design: Before and After Transformations",
        "format": "Carousel post",
        "channel": "Instagram",
        "publishDate": "2025-03-14",
        "targetAudience": "Visual learners, design-conscious entrepreneurs",
        "objective": "Showcase Landing Pad Digital's design capabilities"
      }
    ]
  },
  "trendInsights": [
    {
      "trend": "Voice-optimized websites",
      "relevance": "High",
      "opportunity": "Create content explaining how Landing Pad Digital's AI helps optimize for voice search"
    },
    {
      "trend": "E-commerce integration simplification",
      "relevance": "Medium",
      "opportunity": "Highlight the platform's one-click e-commerce setup features"
    }
  ]
}
```