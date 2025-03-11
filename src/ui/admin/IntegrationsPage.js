import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Card, CardContent, 
  CardActions, Button, Chip, CircularProgress, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControlLabel, Switch
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SettingsIcon from '@mui/icons-material/Settings';

// This would come from your API in a real implementation
const mockIntegrations = {
  cms: [
    { 
      id: 'wordpress', 
      name: 'WordPress', 
      status: 'connected', 
      lastSync: '2025-03-11T10:30:00Z',
      config: {
        apiUrl: 'https://example-site.com/wp-json',
        username: 'admin',
        enabled: true
      }
    },
    { 
      id: 'shopify', 
      name: 'Shopify', 
      status: 'connected', 
      lastSync: '2025-03-11T09:15:00Z',
      config: {
        shopName: 'example-store',
        accessToken: '***********',
        enabled: true
      }
    }
  ],
  social: [
    { 
      id: 'twitter', 
      name: 'Twitter/X', 
      status: 'error', 
      lastSync: '2025-03-10T22:45:00Z',
      error: 'Authentication token expired',
      config: {
        apiKey: '***********',
        apiSecret: '***********',
        enabled: true
      }
    },
    { 
      id: 'facebook', 
      name: 'Facebook', 
      status: 'connected', 
      lastSync: '2025-03-11T08:00:00Z',
      config: {
        appId: '***********',
        appSecret: '***********',
        pageId: '***********',
        enabled: true
      }
    }
  ],
  analytics: [
    { 
      id: 'google-analytics', 
      name: 'Google Analytics', 
      status: 'connected', 
      lastSync: '2025-03-11T11:00:00Z',
      config: {
        propertyId: 'GA-12345678',
        credentials: '***********',
        enabled: true
      }
    }
  ]
};

function IntegrationCard({ integration, onConfigure }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="div">
            {integration.name}
          </Typography>
          <Chip 
            icon={integration.status === 'connected' ? <CheckCircleIcon /> : <ErrorIcon />} 
            label={integration.status === 'connected' ? 'Connected' : 'Error'} 
            color={integration.status === 'connected' ? 'success' : 'error'}
            size="small"
          />
        </Box>
        
        {integration.status === 'error' && (
          <Typography color="error" variant="body2" sx={{ mb: 1 }}>
            {integration.error}
          </Typography>
        )}
        
        <Typography variant="body2" color="text.secondary">
          Last synchronized: {formatDate(integration.lastSync)}
        </Typography>
      </CardContent>
      <CardActions>
        <Button 
          size="small" 
          startIcon={<SettingsIcon />} 
          onClick={() => onConfigure(integration)}
        >
          Configure
        </Button>
      </CardActions>
    </Card>
  );
}

function ConfigurationDialog({ open, integration, onClose, onSave }) {
  const [config, setConfig] = useState({});
  
  useEffect(() => {
    if (integration) {
      setConfig({...integration.config});
    }
  }, [integration]);
  
  const handleChange = (key, value) => {
    setConfig({
      ...config,
      [key]: value
    });
  };
  
  if (!integration) return null;
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Configure {integration.name}</DialogTitle>
      <DialogContent>
        {Object.entries(config).map(([key, value]) => {
          if (key === 'enabled') {
            return (
              <FormControlLabel
                key={key}
                control={
                  <Switch 
                    checked={value} 
                    onChange={(e) => handleChange(key, e.target.checked)}
                  />
                }
                label="Enabled"
                sx={{ mt: 2, display: 'block' }}
              />
            );
          }
          
          // Don't show actual values for credential fields
          const isSecret = ['apiKey', 'apiSecret', 'accessToken', 'appSecret', 'credentials', 'password'].includes(key);
          
          return (
            <TextField
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
              value={isSecret ? '*'.repeat(10) : value}
              onChange={(e) => handleChange(key, e.target.value)}
              type={isSecret ? 'password' : 'text'}
              fullWidth
              margin="normal"
            />
          );
        })}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(integration.id, config)} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState(null);
  const [configDialog, setConfigDialog] = useState({
    open: false,
    integration: null
  });
  
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setIntegrations(mockIntegrations);
      setLoading(false);
    }, 1000);
  }, []);
  
  const handleOpenConfig = (integration) => {
    setConfigDialog({
      open: true,
      integration
    });
  };
  
  const handleCloseConfig = () => {
    setConfigDialog({
      open: false,
      integration: null
    });
  };
  
  const handleSaveConfig = (id, config) => {
    // This would be an API call in a real implementation
    console.log('Saving configuration for', id, config);
    
    // Update local state
    const newIntegrations = {...integrations};
    
    for (const category of Object.keys(newIntegrations)) {
      const index = newIntegrations[category].findIndex(i => i.id === id);
      if (index !== -1) {
        newIntegrations[category][index].config = config;
        break;
      }
    }
    
    setIntegrations(newIntegrations);
    handleCloseConfig();
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        External Integrations
      </Typography>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Content Management Systems
        </Typography>
        <Grid container spacing={3}>
          {integrations.cms.map(integration => (
            <Grid item xs={12} sm={6} md={4} key={integration.id}>
              <IntegrationCard 
                integration={integration}
                onConfigure={handleOpenConfig}
              />
            </Grid>
          ))}
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Social Media
        </Typography>
        <Grid container spacing={3}>
          {integrations.social.map(integration => (
            <Grid item xs={12} sm={6} md={4} key={integration.id}>
              <IntegrationCard 
                integration={integration}
                onConfigure={handleOpenConfig}
              />
            </Grid>
          ))}
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Analytics Platforms
        </Typography>
        <Grid container spacing={3}>
          {integrations.analytics.map(integration => (
            <Grid item xs={12} sm={6} md={4} key={integration.id}>
              <IntegrationCard 
                integration={integration}
                onConfigure={handleOpenConfig}
              />
            </Grid>
          ))}
        </Grid>
      </Paper>
      
      <ConfigurationDialog
        open={configDialog.open}
        integration={configDialog.integration}
        onClose={handleCloseConfig}
        onSave={handleSaveConfig}
      />
    </Box>
  );
}

export default IntegrationsPage;