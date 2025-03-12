import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Grid, Button, 
  CircularProgress, Tabs, Tab, Card, 
  CardContent, Divider, Chip
} from '@mui/material';
import { Add, Refresh } from '@mui/icons-material';
import WorkflowVisualizer from '../components/WorkflowVisualizer';

function WorkflowsPage() {
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState([]);
  const [activeTab, setActiveTab] = useState('active');
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  // Mock data for demonstration
  const mockWorkflows = [
    {
      id: 'workflow-1',
      name: 'Weekly Blog Content',
      status: 'in_progress',
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      completedAt: null,
      type: 'content_creation',
      initiatedBy: 'john.doe@example.com'
    },
    {
      id: 'workflow-2',
      name: 'Landing Page Optimization',
      status: 'completed',
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(), // 20 hours ago
      type: 'optimization',
      initiatedBy: 'marketing@example.com'
    },
    {
      id: 'workflow-3',
      name: 'Social Media Campaign',
      status: 'error',
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
      completedAt: null,
      type: 'content_creation',
      initiatedBy: 'social@example.com'
    },
    {
      id: 'workflow-4',
      name: 'Brand Consistency Audit',
      status: 'completed',
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 45).toISOString(), // 45 hours ago
      type: 'brand_audit',
      initiatedBy: 'brand@example.com'
    },
    {
      id: 'workflow-5',
      name: 'Newsletter Generation',
      status: 'in_progress',
      startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
      completedAt: null,
      type: 'content_creation',
      initiatedBy: 'john.doe@example.com'
    }
  ];

  const fetchWorkflows = () => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setWorkflows(mockWorkflows);
      setLoading(false);
    }, 800);
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getFilteredWorkflows = () => {
    if (activeTab === 'active') {
      return workflows.filter(wf => wf.status === 'in_progress');
    } else if (activeTab === 'completed') {
      return workflows.filter(wf => wf.status === 'completed');
    } else if (activeTab === 'error') {
      return workflows.filter(wf => wf.status === 'error');
    } else {
      return workflows;
    }
  };

  const getStatusChip = (status) => {
    let color;
    let label;
    
    switch (status) {
      case 'completed':
        color = 'success';
        label = 'Completed';
        break;
      case 'in_progress':
        color = 'primary';
        label = 'In Progress';
        break;
      case 'pending':
        color = 'default';
        label = 'Pending';
        break;
      case 'error':
        color = 'error';
        label = 'Error';
        break;
      default:
        color = 'default';
        label = status;
    }
    
    return <Chip size="small" color={color} label={label} />;
  };

  if (loading && workflows.length === 0) {
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
          Workflows
        </Typography>
        <Box>
          <Button 
            variant="outlined" 
            startIcon={<Refresh />}
            onClick={fetchWorkflows}
            sx={{ mr: 2 }}
          >
            Refresh
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Add />}
            onClick={() => alert('New workflow dialog would open here')}
          >
            New Workflow
          </Button>
        </Box>
      </Box>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Active" value="active" />
          <Tab label="Completed" value="completed" />
          <Tab label="Error" value="error" />
          <Tab label="All" value="all" />
        </Tabs>
      </Box>
      
      <Grid container spacing={3}>
        {/* Workflow list */}
        <Grid item xs={12} md={selectedWorkflow ? 4 : 12}>
          <Grid container spacing={2}>
            {getFilteredWorkflows().map(workflow => (
              <Grid item xs={12} key={workflow.id}>
                <Card 
                  variant="outlined"
                  sx={{ 
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { boxShadow: 2 },
                    bgcolor: selectedWorkflow?.id === workflow.id ? '#f5f5f5' : 'inherit'
                  }}
                  onClick={() => setSelectedWorkflow(workflow)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" component="div">
                        {workflow.name}
                      </Typography>
                      {getStatusChip(workflow.status)}
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary">
                      Type: {workflow.type.replace('_', ' ')}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary">
                      Started: {new Date(workflow.startedAt).toLocaleString()}
                    </Typography>
                    
                    {workflow.completedAt && (
                      <Typography variant="body2" color="text.secondary">
                        Completed: {new Date(workflow.completedAt).toLocaleString()}
                      </Typography>
                    )}
                    
                    <Divider sx={{ my: 1 }} />
                    
                    <Typography variant="caption" color="text.secondary">
                      Initiated by: {workflow.initiatedBy}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            
            {getFilteredWorkflows().length === 0 && (
              <Grid item xs={12}>
                <Box sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="body1" color="text.secondary">
                    No workflows found
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </Grid>
        
        {/* Workflow details */}
        {selectedWorkflow && (
          <Grid item xs={12} md={8}>
            <Box sx={{ position: 'sticky', top: 20 }}>
              <Typography variant="h5" sx={{ mb: 2 }}>
                Workflow Details
              </Typography>
              <WorkflowVisualizer 
                workflowId={selectedWorkflow.id} 
                onRefresh={() => console.log('Refreshing workflow', selectedWorkflow.id)}
              />
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

export default WorkflowsPage;