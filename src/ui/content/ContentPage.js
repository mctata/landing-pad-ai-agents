import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Card, CardContent, CardActions,
  Button, Chip, CircularProgress, TextField, FormControl, 
  InputLabel, Select, MenuItem, IconButton, Divider, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Tabs, Tab, Alert, Snackbar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PublishIcon from '@mui/icons-material/Publish';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { contentService, integrationService } from '../services/api';

// Available content publishing destinations - this will be replaced with data from the API
const publishDestinations = [
  { id: 'wordpress', name: 'WordPress', type: 'cms', icon: '🌐' },
  { id: 'shopify', name: 'Shopify Blog', type: 'cms', icon: '🛍️' },
  { id: 'medium', name: 'Medium', type: 'cms', icon: '📝' },
  { id: 'twitter', name: 'Twitter/X', type: 'social', icon: '🐦' },
  { id: 'bluesky', name: 'Bluesky', type: 'social', icon: '🔵' },
  { id: 'facebook', name: 'Facebook', type: 'social', icon: '👍' },
  { id: 'linkedin', name: 'LinkedIn', type: 'social', icon: '💼' },
  { id: 'instagram', name: 'Instagram', type: 'social', icon: '📷' },
  { id: 'mailchimp', name: 'Mailchimp', type: 'email', icon: '📧' },
];

function ContentTable({ items, onEdit, onView, onPublish, onDelete }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium'
    }).format(date);
  };
  
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Title</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Updated</TableCell>
            <TableCell width={180}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.title}</TableCell>
              <TableCell>
                <Chip 
                  label={item.type.charAt(0).toUpperCase() + item.type.slice(1).replace('-', ' ')} 
                  size="small"
                  color={
                    item.type === 'blog' ? 'primary' :
                    item.type === 'landing-page' ? 'secondary' :
                    item.type === 'social-media' ? 'success' : 'default'
                  }
                />
              </TableCell>
              <TableCell>
                <Chip 
                  label={item.status.charAt(0).toUpperCase() + item.status.slice(1)} 
                  size="small" 
                  color={
                    item.status === 'published' ? 'success' :
                    item.status === 'ready' ? 'info' : 'default'
                  }
                />
              </TableCell>
              <TableCell>{formatDate(item.created)}</TableCell>
              <TableCell>{formatDate(item.updated)}</TableCell>
              <TableCell>
                <IconButton size="small" onClick={() => onView(item)} title="View">
                  <VisibilityIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => onEdit(item)} title="Edit">
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton 
                  size="small" 
                  onClick={() => onPublish(item)} 
                  title="Publish"
                  color={item.status === 'published' ? 'primary' : 'default'}
                  disabled={item.status === 'draft'}
                >
                  <PublishIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => onDelete(item)} title="Delete" color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function PublishDialog({ open, content, destinations, onClose, onPublish }) {
  const [selected, setSelected] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (content) {
      setSelected(content.publishDestinations || []);
      setError(null);
    }
  }, [content]);
  
  const handleToggleDestination = (destId) => {
    if (selected.includes(destId)) {
      setSelected(selected.filter(id => id !== destId));
    } else {
      setSelected([...selected, destId]);
    }
  };
  
  const handlePublish = async () => {
    try {
      setPublishing(true);
      setError(null);
      await onPublish(content.id, selected);
    } catch (err) {
      setError('Failed to publish content. Please try again.');
      console.error('Publish error:', err);
    } finally {
      setPublishing(false);
    }
  };
  
  if (!content) return null;
  
  return (
    <Dialog open={open} onClose={!publishing ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle>Publish: {content.title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Typography variant="body2" paragraph>
          Select the platforms where you want to publish this content:
        </Typography>
        
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Content Management Systems
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {destinations
            .filter(dest => dest.type === 'cms')
            .map(dest => (
              <Chip
                key={dest.id}
                icon={<Typography fontSize="small">{dest.icon}</Typography>}
                label={dest.name}
                onClick={() => !publishing && handleToggleDestination(dest.id)}
                color={selected.includes(dest.id) ? 'primary' : 'default'}
                variant={selected.includes(dest.id) ? 'filled' : 'outlined'}
                disabled={publishing}
              />
            ))
          }
        </Box>
        
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Social Media
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {destinations
            .filter(dest => dest.type === 'social')
            .map(dest => (
              <Chip
                key={dest.id}
                icon={<Typography fontSize="small">{dest.icon}</Typography>}
                label={dest.name}
                onClick={() => !publishing && handleToggleDestination(dest.id)}
                color={selected.includes(dest.id) ? 'primary' : 'default'}
                variant={selected.includes(dest.id) ? 'filled' : 'outlined'}
                disabled={publishing}
              />
            ))
          }
        </Box>
        
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Email Platforms
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {destinations
            .filter(dest => dest.type === 'email')
            .map(dest => (
              <Chip
                key={dest.id}
                icon={<Typography fontSize="small">{dest.icon}</Typography>}
                label={dest.name}
                onClick={() => !publishing && handleToggleDestination(dest.id)}
                color={selected.includes(dest.id) ? 'primary' : 'default'}
                variant={selected.includes(dest.id) ? 'filled' : 'outlined'}
                disabled={publishing}
              />
            ))
          }
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={publishing}>Cancel</Button>
        <Button 
          onClick={handlePublish} 
          variant="contained" 
          startIcon={publishing ? <CircularProgress size={20} color="inherit" /> : <PublishIcon />}
          disabled={selected.length === 0 || publishing}
        >
          {publishing ? 'Publishing...' : 'Publish'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ContentPage() {
  const [loading, setLoading] = useState(true);
  const [contentItems, setContentItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [publishDialog, setPublishDialog] = useState({
    open: false,
    content: null
  });
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  
  // Function to fetch content from API
  const fetchContent = async (filterParams = {}) => {
    setLoading(true);
    try {
      // Convert UI filter to API filter parameters
      const apiFilter = {};
      
      if (filter === 'published' || filter === 'ready' || filter === 'draft') {
        apiFilter.status = filter;
      }
      
      if (filter === 'blog' || filter === 'landing-page' || filter === 'social-media' || filter === 'email') {
        apiFilter.type = filter;
      }
      
      // Combine with any additional filter params
      const params = {
        ...apiFilter,
        ...filterParams,
        page: pagination.page,
        limit: pagination.limit
      };
      
      const response = await contentService.getContent(params);
      setContentItems(response.contents);
      setPagination(response.pagination);
      setError(null);
    } catch (err) {
      console.error('Error fetching content:', err);
      setError('Failed to load content. Please try again later.');
      setContentItems([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to fetch available integrations for publishing
  const fetchIntegrations = async () => {
    try {
      const data = await integrationService.getIntegrations();
      setIntegrations(data);
    } catch (err) {
      console.error('Error fetching integrations:', err);
      // Don't show error for this as it's not critical
    }
  };
  
  // Load content and integrations on initial render
  useEffect(() => {
    fetchContent();
    fetchIntegrations();
  }, []);
  
  // Reload content when filter changes
  useEffect(() => {
    fetchContent();
  }, [filter, pagination.page, pagination.limit]);
  
  const handleFilterChange = (event) => {
    setFilter(event.target.value);
    // Reset to first page when changing filters
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
  };
  
  // We handle filtering on the server side now with the fetchContent function
  const filteredItems = contentItems;
  
  const handleViewContent = async (content) => {
    try {
      // Fetch full content details including history and analytics
      const contentDetails = await contentService.getContentById(content.id);
      // This would typically navigate to a detailed view
      console.log('Content details:', contentDetails);
      // For now, we'll just log the details
    } catch (err) {
      console.error(`Error fetching content details for ${content.id}:`, err);
      setError(`Failed to load content details for "${content.title}"`);
    }
  };
  
  const handleEditContent = (content) => {
    // This would typically navigate to an editor
    console.log('Edit content:', content);
  };
  
  const handleOpenPublishDialog = (content) => {
    setPublishDialog({
      open: true,
      content
    });
  };
  
  const handleClosePublishDialog = () => {
    setPublishDialog({
      open: false,
      content: null
    });
  };
  
  const handlePublishContent = async (contentId, destinations) => {
    try {
      setLoading(true);
      // Call the publishContent API
      await contentService.publishContent(contentId, destinations);
      
      // Refresh content list to get updated status
      await fetchContent();
      
      setSuccessMessage('Content published successfully');
      handleClosePublishDialog();
    } catch (err) {
      console.error(`Error publishing content ${contentId}:`, err);
      setError('Failed to publish content. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteContent = async (content) => {
    if (window.confirm(`Are you sure you want to delete "${content.title}"?`)) {
      try {
        setLoading(true);
        // Call the deleteContent API
        await contentService.deleteContent(content.id);
        
        // Refresh content list
        await fetchContent();
        
        setSuccessMessage('Content deleted successfully');
      } catch (err) {
        console.error(`Error deleting content ${content.id}:`, err);
        setError('Failed to delete content. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };
  
  const handleCloseError = () => {
    setError(null);
  };
  
  const handleCloseSuccess = () => {
    setSuccessMessage(null);
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
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Content Management
        </Typography>
        
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => console.log('Create new content')}
        >
          Create New
        </Button>
      </Box>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            Content Library
          </Typography>
          
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="filter-label">Filter</InputLabel>
            <Select
              labelId="filter-label"
              id="filter-select"
              value={filter}
              label="Filter"
              onChange={handleFilterChange}
              startAdornment={<FilterListIcon fontSize="small" sx={{ mr: 1 }} />}
            >
              <MenuItem value="all">All Content</MenuItem>
              <Divider />
              <MenuItem value="published">Published</MenuItem>
              <MenuItem value="ready">Ready to Publish</MenuItem>
              <MenuItem value="draft">Drafts</MenuItem>
              <Divider />
              <MenuItem value="blog">Blog Posts</MenuItem>
              <MenuItem value="landing-page">Landing Pages</MenuItem>
              <MenuItem value="social-media">Social Media</MenuItem>
              <MenuItem value="email">Email Content</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        {contentItems.length > 0 ? (
          <>
            <ContentTable 
              items={filteredItems}
              onView={handleViewContent}
              onEdit={handleEditContent}
              onPublish={handleOpenPublishDialog}
              onDelete={handleDeleteContent}
            />
            
            {/* Pagination controls would go here */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Typography variant="body2">
                Showing page {pagination.page} of {pagination.pages} ({pagination.total} total items)
              </Typography>
            </Box>
          </>
        ) : (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No content items found with the current filter.
            </Typography>
          </Box>
        )}
      </Paper>
      
      <PublishDialog
        open={publishDialog.open}
        content={publishDialog.content}
        destinations={publishDestinations}
        onClose={handleClosePublishDialog}
        onPublish={handlePublishContent}
      />
    </Box>
  );
}

export default ContentPage;