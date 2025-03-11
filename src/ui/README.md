# Landing Pad AI Agents - User Interface

This directory contains the React-based frontend for the Landing Pad AI Agents platform. It provides a comprehensive admin dashboard for managing content, integrations, and visualizing analytics data.

## Directory Structure

```
/src/ui/
  /admin/          - Admin dashboard components
  /analytics/      - Analytics visualization components
  /content/        - Content management components
  /services/       - API services for backend communication
  App.js           - Main application component with routing
  index.js         - React entry point
```

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Landing Pad AI Agents backend running

### Installation

1. Install dependencies from the project root:
   ```
   npm install
   ```

2. Set up environment variables:
   - Copy `.env.development` to `.env.local` if you need to customize anything
   - Ensure backend API URL is correct in `.env.local`

### Development

To start the UI development server:

```
npm run ui:start
```

This will launch the React app on port 3001 by default, which you can access at `http://localhost:3001`.

### Building for Production

To create a production build:

```
npm run ui:build
```

This creates optimized files in the `build` directory.

## Components Overview

### Admin Dashboard

- Main navigation and layout for the admin interface
- Shows status information and quick access to all sections

### Integrations Management

- Configure and manage external services connections
- CMS platforms (WordPress, Shopify)
- Social media platforms (Twitter/X, Facebook, LinkedIn)
- Analytics platforms (Google Analytics)

### Content Management

- Create, edit and publish content
- Filter content by type, status, etc.
- Push content to integrated platforms
- Track content performance

### Analytics Dashboard

- Visualize key metrics and performance data
- Traffic statistics
- Content performance analytics
- Social media engagement metrics

## API Services

The `services/api.js` file contains services for:

- Authentication
- Content management
- Integration configuration
- Analytics data retrieval

## Authentication

The UI uses JWT for authentication with the backend API. Login credentials are managed via the authentication service.

## Customization

To customize the UI theme:

1. Modify the theme in `src/ui/App.js`
2. Update component styles as needed

## Development Guidelines

1. Follow component-based architecture
2. Keep API service methods isolated
3. Use Material UI components for consistency
4. Handle errors gracefully
5. Use the Redux pattern for state that needs to be shared across multiple components