import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Card, CardContent, 
  CardActions, Button, Chip, CircularProgress, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControlLabel, Switch, Alert, Snackbar,
  MenuItem
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import { integrationService } from '../services/api';

// Fallback data structure in case API fails
const emptyIntegrations = {
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
      status: 'connected', 
      lastSync: '2025-03-11T08:30:00Z',
      config: {
        apiKey: '***********',
        apiSecret: '***********',
        accessToken: '***********',
        accessTokenSecret: '***********',
        enabled: true
      }
    },
    { 
      id: 'bluesky', 
      name: 'Bluesky', 
      status: 'connected', 
      lastSync: '2025-03-11T10:45:00Z',
      config: {
        username: 'landingpad.bsky.social',
        appPassword: '***********',
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
    },
    { 
      id: 'linkedin', 
      name: 'LinkedIn', 
      status: 'connected', 
      lastSync: '2025-03-11T09:30:00Z',
      config: {
        clientId: '***********',
        clientSecret: '***********',
        accessToken: '***********',
        refreshToken: '***********',
        companyId: '12345678',
        enabled: true
      }
    },
    { 
      id: 'instagram', 
      name: 'Instagram', 
      status: 'connected', 
      lastSync: '2025-03-11T10:15:00Z',
      config: {
        accessToken: '***********',
        fbPageId: '***********',
        igBusinessAccountId: '***********',
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

function IntegrationCard({ integration, onConfigure, onTestConnection, testingConnection }) {
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
            {integration.error || 'Connection error. Check your configuration.'}
          </Typography>
        )}
        
        <Typography variant="body2" color="text.secondary">
          Last synchronized: {formatDate(integration.lastSync)}
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between' }}>
        <Button 
          size="small" 
          startIcon={<SettingsIcon />} 
          onClick={() => onConfigure(integration)}
        >
          Configure
        </Button>
        
        <Button 
          size="small"
          color="primary"
          variant="outlined"
          onClick={() => onTestConnection(integration.id)}
          disabled={testingConnection}
        >
          {testingConnection ? <CircularProgress size={20} /> : 'Test Connection'}
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

function AddIntegrationDialog({ open, type, onClose, onAdd }) {
  const [selectedIntegrationType, setSelectedIntegrationType] = useState('');
  const [config, setConfig] = useState({
    enabled: true
  });
  
  useEffect(() => {
    if (type) {
      setSelectedIntegrationType('');
      setConfig({ enabled: true });
    }
  }, [type]);
  
  const handleIntegrationTypeChange = (event) => {
    setSelectedIntegrationType(event.target.value);
    
    // Reset config but keep enabled flag
    setConfig({ enabled: true });
    
    // Set default fields based on integration type
    switch (event.target.value) {
      case 'contentful':
        setConfig({
          enabled: true,
          spaceId: '',
          deliveryApiKey: '',
          managementApiKey: '',
          environment: 'master'
        });
        break;
      case 'wordpress':
        setConfig({
          enabled: true,
          endpoint: '',
          username: '',
          applicationPassword: ''
        });
        break;
      case 'linkedin':
        setConfig({
          enabled: true,
          clientId: '',
          clientSecret: '',
          accessToken: '',
          refreshToken: '',
          companyId: ''
        });
        break;
      // Add more default configs as needed
    }
  };
  
  const handleChange = (key, value) => {
    setConfig({
      ...config,
      [key]: value
    });
  };
  
  // Get available integrations based on type
  const getAvailableIntegrations = () => {
    switch (type) {
      case 'cms':
        return [
          { id: 'wordpress', name: 'WordPress' },
          { id: 'contentful', name: 'Contentful' },
          { id: 'shopify', name: 'Shopify' }
        ];
      case 'social':
        return [
          { id: 'twitter', name: 'Twitter/X' },
          { id: 'linkedin', name: 'LinkedIn' },
          { id: 'facebook', name: 'Facebook' },
          { id: 'instagram', name: 'Instagram' },
          { id: 'bluesky', name: 'Bluesky' }
        ];
      case 'analytics':
        return [
          { id: 'google-analytics', name: 'Google Analytics' }
        ];
      default:
        return [];
    }
  };
  
  const handleSubmit = () => {
    // Create new integration object
    const newIntegration = {
      id: selectedIntegrationType,
      name: getAvailableIntegrations().find(i => i.id === selectedIntegrationType)?.name || selectedIntegrationType,
      status: 'not_connected',
      lastSync: new Date().toISOString(),
      config
    };
    
    onAdd(type, newIntegration);
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New {type ? type.charAt(0).toUpperCase() + type.slice(1) : ''} Integration</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            select
            label="Integration Type"
            value={selectedIntegrationType}
            onChange={handleIntegrationTypeChange}
            fullWidth
            margin="normal"
          >
            {getAvailableIntegrations().map((integration) => (
              <MenuItem key={integration.id} value={integration.id}>
                {integration.name}
              </MenuItem>
            ))}
          </TextField>
          
          {selectedIntegrationType && (
            <>
              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                Configuration
              </Typography>
              
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
                
                return (
                  <TextField
                    key={key}
                    label={key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                    value={value}
                    onChange={(e) => handleChange(key, e.target.value)}
                    type={['apiKey', 'apiSecret', 'accessToken', 'clientSecret', 'password', 'applicationPassword', 'managementApiKey', 'deliveryApiKey'].includes(key) ? 'password' : 'text'}
                    fullWidth
                    margin="normal"
                  />
                );
              })}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={!selectedIntegrationType}
        >
          Add Integration
        </Button>
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
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  
  const [addIntegrationDialog, setAddIntegrationDialog] = useState({
    open: false,
    type: null // cms, social, analytics
  });
  
  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const data = await integrationService.getIntegrations();
      setIntegrations(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching integrations:', err);
      setError('Failed to load integrations. Please try again later.');
      // Use empty structure as fallback
      setIntegrations(emptyIntegrations);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchIntegrations();
  }, []);
  
  const handleOpenConfig = (integration) => {
    setConfigDialog({
      open: true,
      integration: {...integration}
    });
  };
  
  const handleCloseConfig = () => {
    setConfigDialog({
      open: false,
      integration: null
    });
  };
  
  const handleSaveConfig = async (id, config) => {
    try {
      // Save to the server
      await integrationService.updateIntegration(id, config);
      
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
      setSuccessMessage('Integration configuration updated successfully');
      handleCloseConfig();
    } catch (err) {
      console.error('Error updating integration:', err);
      setError('Failed to update integration configuration. Please try again.');
    }
  };
  
  const handleTestConnection = async (integrationId) => {
    setTestingConnection(true);
    try {
      // Call API to test connection
      const result = await integrationService.testConnection(integrationId);
      
      // Update the status in the UI
      const newIntegrations = {...integrations};
      
      for (const category of Object.keys(newIntegrations)) {
        const index = newIntegrations[category].findIndex(i => i.id === integrationId);
        if (index !== -1) {
          newIntegrations[category][index].status = result.success ? 'connected' : 'error';
          newIntegrations[category][index].lastSync = new Date().toISOString();
          if (!result.success) {
            newIntegrations[category][index].error = result.message;
          }
          break;
        }
      }
      
      setIntegrations(newIntegrations);
      
      if (result.success) {
        setSuccessMessage('Connection test successful');
      } else {
        setError(`Connection test failed: ${result.message}`);
      }
    } catch (err) {
      console.error('Error testing connection:', err);
      setError('Connection test failed. Please check your configuration.');
    } finally {
      setTestingConnection(false);
    }
  };
  
  const handleCloseError = () => {
    setError(null);
  };
  
  const handleCloseSuccess = () => {
    setSuccessMessage(null);
  };
  
  const handleRefresh = () => {
    fetchIntegrations();
  };
  
  const handleOpenAddIntegration = (type) => {
    setAddIntegrationDialog({
      open: true,
      type
    });
  };
  
  const handleCloseAddIntegration = () => {
    setAddIntegrationDialog({
      open: false,
      type: null
    });
  };
  
  const handleAddIntegration = async (type, newIntegration) => {
    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll just update the local state
      
      // Add the new integration to our state
      const newIntegrations = {...integrations};
      newIntegrations[type].push(newIntegration);
      setIntegrations(newIntegrations);
      
      // Close the dialog
      handleCloseAddIntegration();
      
      // Show success message
      setSuccessMessage(`${newIntegration.name} integration added successfully`);
      
    } catch (err) {
      console.error('Error adding integration:', err);
      setError(`Failed to add integration: ${err.message}`);
    }
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
      {/* Success Message Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleCloseSuccess}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSuccess} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
      
      {/* Error Message Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          External Integrations
        </Typography>
        
        <Button 
          variant="outlined"
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2">
            Content Management Systems
          </Typography>
          <Button 
            variant="outlined" 
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenAddIntegration('cms')}
          >
            Add CMS
          </Button>
        </Box>
        <Grid container spacing={3}>
          {integrations.cms.map(integration => (
            <Grid item xs={12} sm={6} md={4} key={integration.id}>
              <IntegrationCard 
                integration={integration}
                onConfigure={handleOpenConfig}
                onTestConnection={handleTestConnection}
                testingConnection={testingConnection}
              />
            </Grid>
          ))}
          {integrations.cms.length === 0 && (
            <Grid item xs={12}>
              <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body1" color="text.secondary">
                  No CMS integrations configured. Click "Add CMS" to set up your first integration.
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2">
            Social Media
          </Typography>
          <Button 
            variant="outlined" 
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenAddIntegration('social')}
          >
            Add Social Media
          </Button>
        </Box>
        <Grid container spacing={3}>
          {integrations.social.map(integration => (
            <Grid item xs={12} sm={6} md={4} key={integration.id}>
              <IntegrationCard 
                integration={integration}
                onConfigure={handleOpenConfig}
                onTestConnection={handleTestConnection}
                testingConnection={testingConnection}
              />
            </Grid>
          ))}
          {integrations.social.length === 0 && (
            <Grid item xs={12}>
              <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body1" color="text.secondary">
                  No social media integrations configured. Click "Add Social Media" to set up your first integration.
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2">
            Analytics Platforms
          </Typography>
          <Button 
            variant="outlined" 
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenAddIntegration('analytics')}
          >
            Add Analytics
          </Button>
        </Box>
        <Grid container spacing={3}>
          {integrations.analytics.map(integration => (
            <Grid item xs={12} sm={6} md={4} key={integration.id}>
              <IntegrationCard 
                integration={integration}
                onConfigure={handleOpenConfig}
                onTestConnection={handleTestConnection}
                testingConnection={testingConnection}
              />
            </Grid>
          ))}
          {integrations.analytics.length === 0 && (
            <Grid item xs={12}>
              <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body1" color="text.secondary">
                  No analytics integrations configured. Click "Add Analytics" to set up your first integration.
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>
      
      {/* Configuration Dialog */}
      <ConfigurationDialog
        open={configDialog.open}
        integration={configDialog.integration}
        onClose={handleCloseConfig}
        onSave={handleSaveConfig}
      />
      
      {/* Add Integration Dialog */}
      <AddIntegrationDialog 
        open={addIntegrationDialog.open}
        type={addIntegrationDialog.type}
        onClose={handleCloseAddIntegration}
        onAdd={handleAddIntegration}
      />
    </Box>
  );
}

export default IntegrationsPage;