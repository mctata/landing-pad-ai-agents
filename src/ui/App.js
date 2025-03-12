import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Dashboard from './admin/Dashboard';
import IntegrationsPage from './admin/IntegrationsPage';
import AgentsPage from './admin/AgentsPage';
import WorkflowsPage from './admin/WorkflowsPage';
import ContentPage from './content/ContentPage';
import AnalyticsPage from './analytics/AnalyticsPage';

// Create a theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<Dashboard />}>
          <Route index element={<AnalyticsPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}

export default App;