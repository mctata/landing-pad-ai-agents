import React, { useState, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Stepper, 
  Step, StepLabel, StepContent, Paper, Divider,
  CircularProgress, Chip, Button
} from '@mui/material';
import { Check, Error, Refresh, Warning } from '@mui/icons-material';

const WorkflowVisualizer = ({ workflowId, onRefresh, showControls = true }) => {
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mock function to fetch workflow - in a real implementation, this would call your API
  const fetchWorkflow = async (id) => {
    setLoading(true);
    setError(null);
    
    try {
      // Replace with actual API call
      // const response = await api.getWorkflow(id);
      
      // Mock data
      const mockData = {
        id: id,
        name: 'Content Creation Workflow',
        status: 'in_progress',
        startedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
        completedAt: null,
        steps: [
          {
            id: 'brief_creation',
            name: 'Content Brief Creation',
            agent: 'contentStrategy',
            status: 'completed',
            startedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
            completedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
            output: {
              briefId: '12345',
              topic: 'AI-Powered Content Creation',
              targetAudience: 'Marketing Teams'
            }
          },
          {
            id: 'content_generation',
            name: 'Content Generation',
            agent: 'contentCreation',
            status: 'completed',
            startedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
            completedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            output: {
              contentId: '67890',
              title: 'How AI is Revolutionizing Content Creation'
            }
          },
          {
            id: 'brand_check',
            name: 'Brand Consistency Check',
            agent: 'brandConsistency',
            status: 'in_progress',
            startedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            completedAt: null,
            output: null
          },
          {
            id: 'seo_optimization',
            name: 'SEO Optimization',
            agent: 'optimisation',
            status: 'pending',
            startedAt: null,
            completedAt: null,
            output: null
          },
          {
            id: 'publish',
            name: 'Publishing',
            agent: 'contentManagement',
            status: 'pending',
            startedAt: null,
            completedAt: null,
            output: null
          }
        ]
      };
      
      setWorkflow(mockData);
    } catch (err) {
      console.error('Error fetching workflow:', err);
      setError('Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workflowId) {
      fetchWorkflow(workflowId);
    }
  }, [workflowId]);

  // Get current active step
  const getActiveStep = () => {
    if (!workflow) return 0;
    
    const inProgressIndex = workflow.steps.findIndex(step => step.status === 'in_progress');
    if (inProgressIndex !== -1) return inProgressIndex;
    
    const lastCompletedIndex = workflow.steps.findIndex(step => step.status !== 'completed');
    return lastCompletedIndex === -1 ? workflow.steps.length : lastCompletedIndex;
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':
        return <Check color="success" />;
      case 'in_progress':
        return <CircularProgress size={20} />;
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      default:
        return null;
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
      case 'warning':
        color = 'warning';
        label = 'Warning';
        break;
      default:
        color = 'default';
        label = status;
    }
    
    return <Chip size="small" color={color} label={label} />;
  };

  if (loading && !workflow) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
        <Typography color="error">{error}</Typography>
        {showControls && (
          <Button 
            startIcon={<Refresh />} 
            onClick={() => fetchWorkflow(workflowId)}
            sx={{ mt: 1 }}
          >
            Retry
          </Button>
        )}
      </Box>
    );
  }

  if (!workflow) {
    return (
      <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
        <Typography>No workflow data available</Typography>
      </Box>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h6" component="div">
              {workflow.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Started: {new Date(workflow.startedAt).toLocaleString()}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {getStatusChip(workflow.status)}
            {showControls && (
              <Button 
                startIcon={<Refresh />} 
                size="small"
                sx={{ ml: 1 }}
                onClick={() => onRefresh ? onRefresh() : fetchWorkflow(workflowId)}
              >
                Refresh
              </Button>
            )}
          </Box>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        <Stepper activeStep={getActiveStep()} orientation="vertical">
          {workflow.steps.map((step, index) => (
            <Step key={step.id}>
              <StepLabel StepIconComponent={() => getStepIcon(step.status)}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">{step.name}</Typography>
                  {getStatusChip(step.status)}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Agent: {step.agent}
                </Typography>
              </StepLabel>
              <StepContent>
                <Box sx={{ mb: 2 }}>
                  {step.startedAt && (
                    <Typography variant="body2">
                      Started: {new Date(step.startedAt).toLocaleString()}
                    </Typography>
                  )}
                  
                  {step.completedAt && (
                    <Typography variant="body2">
                      Completed: {new Date(step.completedAt).toLocaleString()}
                    </Typography>
                  )}
                  
                  {step.output && (
                    <Paper sx={{ p: 2, mt: 1, bgcolor: '#f5f5f5' }}>
                      <Typography variant="subtitle2">Output:</Typography>
                      <pre style={{ margin: 0, fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(step.output, null, 2)}
                      </pre>
                    </Paper>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
        
        {workflow.completedAt && (
          <Box sx={{ mt: 2, p: 1, bgcolor: '#e8f5e9', borderRadius: 1 }}>
            <Typography variant="body2">
              Workflow completed: {new Date(workflow.completedAt).toLocaleString()}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkflowVisualizer;