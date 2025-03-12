import React, { useState, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Grid, Button, 
  CircularProgress, Chip, Divider, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Accordion, AccordionSummary, AccordionDetails, Alert
} from '@mui/material';
import { 
  PlayArrow, Stop, Refresh, ExpandMore,
  Info, Settings, CheckCircle, ErrorOutline
} from '@mui/icons-material';
import { agentService } from '../services/api';

function AgentsPage() {
  const [agents, setAgents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState({ open: false, type: null, agent: null });
  const [actionForm, setActionForm] = useState({});
  const [actionResult, setActionResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const agentData = await agentService.getAllAgentStatus();
      setAgents(agentData);
    } catch (err) {
      setError(err.message || 'Failed to fetch agents');
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();

    // Set up polling every 30 seconds
    const interval = setInterval(() => {
      fetchAgents();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleOpenDetails = async (agentName) => {
    try {
      const agentDetails = await agentService.getAgentStatus(agentName);
      setSelectedAgent(agentDetails);
      setDetailsOpen(true);
    } catch (err) {
      setError(`Failed to fetch details for ${agentName}: ${err.message}`);
    }
  };

  const handleStartAgent = async (agentName) => {
    try {
      await agentService.startAgent(agentName);
      fetchAgents();
    } catch (err) {
      setError(`Failed to start ${agentName}: ${err.message}`);
    }
  };

  const handleStopAgent = async (agentName) => {
    try {
      await agentService.stopAgent(agentName);
      fetchAgents();
    } catch (err) {
      setError(`Failed to stop ${agentName}: ${err.message}`);
    }
  };

  const openActionDialog = (type, agent) => {
    setActionDialog({ open: true, type, agent });
    setActionForm({});
    setActionResult(null);
  };

  const closeActionDialog = () => {
    setActionDialog({ open: false, type: null, agent: null });
    setActionForm({});
    setActionResult(null);
  };

  const handleActionFormChange = (e) => {
    const { name, value } = e.target;
    setActionForm(prev => ({ ...prev, [name]: value }));
  };

  const executeAgentAction = async () => {
    setActionLoading(true);
    setActionResult(null);
    
    try {
      let result;
      const { type, agent } = actionDialog;
      const userId = JSON.parse(localStorage.getItem('user'))?.id || 'anonymous';
      
      // Add user ID to all requests
      const formData = { ...actionForm, userId };
      
      switch (type) {
        case 'createBrief':
          result = await agentService.createContentBrief(formData);
          break;
        case 'generateCalendar':
          result = await agentService.generateContentCalendar(formData);
          break;
        case 'generateContent':
          result = await agentService.generateContent(formData);
          break;
        case 'generateHeadlines':
          result = await agentService.generateHeadlines(formData);
          break;
        case 'reviewBrand':
          result = await agentService.reviewContentForBrand(formData);
          break;
        case 'generateSeo':
          result = await agentService.generateSeoRecommendations(formData);
          break;
        case 'generateAbTesting':
          result = await agentService.generateAbTestingSuggestions(formData);
          break;
        default:
          throw new Error(`Unknown action type: ${type}`);
      }
      
      setActionResult({ success: true, data: result });
    } catch (err) {
      console.error('Error executing agent action:', err);
      setActionResult({ 
        success: false, 
        error: err.message || 'An error occurred while executing the action' 
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Render form fields based on action type
  const renderActionForm = () => {
    const { type } = actionDialog;
    
    switch (type) {
      case 'createBrief':
        return (
          <>
            <FormControl fullWidth margin="normal">
              <InputLabel>Content Type</InputLabel>
              <Select
                name="type"
                value={actionForm.type || ''}
                onChange={handleActionFormChange}
                required
              >
                <MenuItem value="blog">Blog Post</MenuItem>
                <MenuItem value="social">Social Media</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="landing_page">Landing Page</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              margin="normal"
              label="Topic"
              name="topic"
              value={actionForm.topic || ''}
              onChange={handleActionFormChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label="Target Audience"
              name="targetAudience"
              value={actionForm.targetAudience || ''}
              onChange={handleActionFormChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label="Keywords (comma separated)"
              name="keywords"
              value={actionForm.keywords || ''}
              onChange={handleActionFormChange}
              helperText="Enter keywords separated by commas"
            />
          </>
        );
        
      case 'generateContent':
        return (
          <>
            <TextField
              fullWidth
              margin="normal"
              label="Brief ID (optional)"
              name="briefId"
              value={actionForm.briefId || ''}
              onChange={handleActionFormChange}
              helperText="Leave empty to use overrides instead"
            />
            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              Overrides (if not using Brief ID):
            </Typography>
            <FormControl fullWidth margin="normal">
              <InputLabel>Content Type</InputLabel>
              <Select
                name="overrides.type"
                value={actionForm.overrides?.type || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setActionForm(prev => ({
                    ...prev,
                    overrides: { ...prev.overrides, type: value }
                  }));
                }}
              >
                <MenuItem value="blog">Blog Post</MenuItem>
                <MenuItem value="social">Social Media</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="landing_page">Landing Page</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              margin="normal"
              label="Topic"
              name="overrides.topic"
              value={actionForm.overrides?.topic || ''}
              onChange={(e) => {
                const value = e.target.value;
                setActionForm(prev => ({
                  ...prev,
                  overrides: { ...prev.overrides, topic: value }
                }));
              }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Target Audience"
              name="overrides.target_audience"
              value={actionForm.overrides?.target_audience || ''}
              onChange={(e) => {
                const value = e.target.value;
                setActionForm(prev => ({
                  ...prev,
                  overrides: { ...prev.overrides, target_audience: value }
                }));
              }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Keywords (comma separated)"
              name="overrides.keywords"
              value={actionForm.overrides?.keywords || ''}
              onChange={(e) => {
                const value = e.target.value;
                setActionForm(prev => ({
                  ...prev,
                  overrides: { ...prev.overrides, keywords: value.split(',').map(k => k.trim()) }
                }));
              }}
            />
          </>
        );
        
      case 'generateHeadlines':
        return (
          <>
            <TextField
              fullWidth
              margin="normal"
              label="Topic"
              name="topic"
              value={actionForm.topic || ''}
              onChange={handleActionFormChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label="Number of Headlines"
              name="count"
              type="number"
              value={actionForm.count || 5}
              onChange={handleActionFormChange}
              inputProps={{ min: 1, max: 10 }}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Content Type</InputLabel>
              <Select
                name="type"
                value={actionForm.type || 'blog'}
                onChange={handleActionFormChange}
              >
                <MenuItem value="blog">Blog Post</MenuItem>
                <MenuItem value="social">Social Media</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="landing_page">Landing Page</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              margin="normal"
              label="Target Audience"
              name="targetAudience"
              value={actionForm.targetAudience || ''}
              onChange={handleActionFormChange}
            />
          </>
        );
        
      case 'reviewBrand':
        return (
          <>
            <TextField
              fullWidth
              margin="normal"
              label="Content ID"
              name="contentId"
              value={actionForm.contentId || ''}
              onChange={handleActionFormChange}
              required
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Check Level</InputLabel>
              <Select
                name="checkLevel"
                value={actionForm.checkLevel || 'standard'}
                onChange={handleActionFormChange}
              >
                <MenuItem value="basic">Basic</MenuItem>
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="comprehensive">Comprehensive</MenuItem>
              </Select>
            </FormControl>
          </>
        );
        
      case 'generateSeo':
        return (
          <>
            <TextField
              fullWidth
              margin="normal"
              label="Content ID"
              name="contentId"
              value={actionForm.contentId || ''}
              onChange={handleActionFormChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label="Keywords (comma separated)"
              name="keywords"
              value={actionForm.keywords || ''}
              onChange={(e) => {
                const value = e.target.value;
                setActionForm(prev => ({
                  ...prev,
                  keywords: value.split(',').map(k => k.trim())
                }));
              }}
              helperText="Enter keywords separated by commas"
            />
          </>
        );
        
      case 'generateAbTesting':
        return (
          <>
            <TextField
              fullWidth
              margin="normal"
              label="Content ID"
              name="contentId"
              value={actionForm.contentId || ''}
              onChange={handleActionFormChange}
              required
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Elements to Test</InputLabel>
              <Select
                multiple
                name="elements"
                value={actionForm.elements || []}
                onChange={(e) => {
                  setActionForm(prev => ({
                    ...prev,
                    elements: e.target.value
                  }));
                }}
              >
                <MenuItem value="headline">Headlines</MenuItem>
                <MenuItem value="cta">Call to Action</MenuItem>
                <MenuItem value="images">Images</MenuItem>
                <MenuItem value="layout">Layout</MenuItem>
                <MenuItem value="copy">Body Copy</MenuItem>
              </Select>
            </FormControl>
          </>
        );
        
      default:
        return <Typography>No form fields for this action</Typography>;
    }
  };

  const renderActionResults = () => {
    if (!actionResult) return null;
    
    if (!actionResult.success) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          {actionResult.error}
        </Alert>
      );
    }
    
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          Result:
        </Typography>
        <Paper 
          sx={{ 
            p: 2, 
            mt: 1, 
            maxHeight: 300, 
            overflow: 'auto',
            backgroundColor: '#f5f5f5'
          }}
        >
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(actionResult.data, null, 2)}
          </pre>
        </Paper>
      </Box>
    );
  };

  const getActionTitle = () => {
    const { type } = actionDialog;
    
    switch (type) {
      case 'createBrief': return 'Create Content Brief';
      case 'generateCalendar': return 'Generate Content Calendar';
      case 'generateContent': return 'Generate Content';
      case 'generateHeadlines': return 'Generate Headlines';
      case 'reviewBrand': return 'Review Brand Consistency';
      case 'generateSeo': return 'Generate SEO Recommendations';
      case 'generateAbTesting': return 'Generate A/B Testing Suggestions';
      default: return 'Agent Action';
    }
  };

  if (loading && Object.keys(agents).length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          AI Agents
        </Typography>
        <Button 
          variant="outlined" 
          startIcon={<Refresh />}
          onClick={fetchAgents}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {Object.entries(agents).map(([name, agent]) => (
          <Grid item xs={12} md={6} lg={4} key={name}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderLeft: agent.isRunning ? '4px solid #4caf50' : '4px solid #bdbdbd'
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6" component="h2">
                    {name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Typography>
                  <Chip 
                    label={agent.isRunning ? 'Running' : 'Stopped'} 
                    color={agent.isRunning ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {agent.moduleCount} modules
                </Typography>
                
                {agent.lastActivity && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Last activity: {new Date(agent.lastActivity).toLocaleString()}
                  </Typography>
                )}
              </CardContent>
              
              <Divider />
              
              <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <IconButton 
                    color="primary" 
                    size="small"
                    onClick={() => handleOpenDetails(name)}
                    title="Details"
                  >
                    <Info />
                  </IconButton>
                  
                  <IconButton 
                    color="default" 
                    size="small"
                    title="Agent Settings"
                    disabled
                  >
                    <Settings />
                  </IconButton>
                </Box>
                
                <Box>
                  {agent.isRunning ? (
                    <Button 
                      startIcon={<Stop />} 
                      color="error"
                      size="small"
                      onClick={() => handleStopAgent(name)}
                    >
                      Stop
                    </Button>
                  ) : (
                    <Button 
                      startIcon={<PlayArrow />}
                      color="success"
                      size="small"
                      onClick={() => handleStartAgent(name)}
                    >
                      Start
                    </Button>
                  )}
                </Box>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        Agent Actions
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Content Strategy Actions</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => openActionDialog('createBrief', 'contentStrategy')}
                  fullWidth
                >
                  Create Content Brief
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={() => openActionDialog('generateCalendar', 'contentStrategy')}
                  fullWidth
                >
                  Generate Content Calendar
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Content Creation Actions</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => openActionDialog('generateContent', 'contentCreation')}
                  fullWidth
                >
                  Generate Content
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={() => openActionDialog('generateHeadlines', 'contentCreation')}
                  fullWidth
                >
                  Generate Headlines
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Brand Consistency Actions</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => openActionDialog('reviewBrand', 'brandConsistency')}
                  fullWidth
                >
                  Review Content for Brand Consistency
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Optimization Actions</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => openActionDialog('generateSeo', 'optimisation')}
                  fullWidth
                >
                  Generate SEO Recommendations
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={() => openActionDialog('generateAbTesting', 'optimisation')}
                  fullWidth
                >
                  Generate A/B Testing Suggestions
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
      
      {/* Agent Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedAgent && (
          <>
            <DialogTitle>
              Agent Details: {selectedAgent.name}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1">Status</Typography>
                  <Chip 
                    label={selectedAgent.isRunning ? 'Running' : 'Stopped'} 
                    color={selectedAgent.isRunning ? 'success' : 'default'}
                    sx={{ mt: 1 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1">Last Activity</Typography>
                  <Typography variant="body2">
                    {selectedAgent.lastActivity 
                      ? new Date(selectedAgent.lastActivity).toLocaleString() 
                      : 'No activity recorded'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Modules</Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Grid container spacing={2}>
                      {selectedAgent.modules.map(module => (
                        <Grid item xs={12} sm={6} md={4} key={module.name}>
                          <Box 
                            sx={{ 
                              p: 2, 
                              border: '1px solid #e0e0e0', 
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1
                            }}
                          >
                            {module.isInitialized 
                              ? <CheckCircle color="success" fontSize="small" /> 
                              : <ErrorOutline color="error" fontSize="small" />}
                            <Typography variant="body2">
                              {module.name}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                </Grid>
                
                {selectedAgent.config && Object.keys(selectedAgent.config).length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Configuration</Typography>
                    <Paper 
                      variant="outlined" 
                      sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}
                    >
                      <pre style={{ margin: 0 }}>
                        {JSON.stringify(selectedAgent.config, null, 2)}
                      </pre>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailsOpen(false)}>Close</Button>
              {selectedAgent.isRunning ? (
                <Button 
                  color="error"
                  onClick={() => {
                    handleStopAgent(selectedAgent.name);
                    setDetailsOpen(false);
                  }}
                >
                  Stop Agent
                </Button>
              ) : (
                <Button 
                  color="primary"
                  onClick={() => {
                    handleStartAgent(selectedAgent.name);
                    setDetailsOpen(false);
                  }}
                >
                  Start Agent
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* Agent Action Dialog */}
      <Dialog
        open={actionDialog.open}
        onClose={closeActionDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {getActionTitle()}
        </DialogTitle>
        <DialogContent>
          {renderActionForm()}
          {renderActionResults()}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeActionDialog} disabled={actionLoading}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={executeAgentAction}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : null}
          >
            {actionLoading ? 'Processing...' : 'Execute'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AgentsPage;