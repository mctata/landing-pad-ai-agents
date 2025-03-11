import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Card, CardContent, CardActions,
  Button, Chip, CircularProgress, TextField, FormControl, 
  InputLabel, Select, MenuItem, IconButton, Divider, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Tabs, Tab
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PublishIcon from '@mui/icons-material/Publish';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityIcon from '@mui/icons-material/Visibility';

// Mock data - in a real app this would come from your API
const mockContentItems = [
  {
    id: 'c001',
    title: 'Why AI is Transforming Content Marketing',
    type: 'blog',
    status: 'published',
    author: 'AI Content Agent',
    created: '2025-03-01T14:30:00Z',
    updated: '2025-03-10T09:15:00Z',
    publishDestinations: ['wordpress', 'medium'],
    tags: ['AI', 'Content Marketing', 'Technology'],
    snippet: 'Artificial intelligence is revolutionizing how brands create and distribute content. Here's how to leverage AI in your content marketing strategy.'
  },
  {
    id: 'c002',
    title: 'Spring Sale Landing Page',
    type: 'landing-page',
    status: 'draft',
    author: 'AI Content Agent',
    created: '2025-03-08T16:45:00Z',
    updated: '2025-03-09T10:20:00Z',
    publishDestinations: [],
    tags: ['ecommerce', 'promotion', 'seasonal'],
    snippet: 'Limited time spring promotion featuring our most popular products with special discounts and free shipping offers.'
  },
  {
    id: 'c003',
    title: 'Product Launch Social Media Kit',
    type: 'social-media',
    status: 'ready',
    author: 'AI Content Agent',
    created: '2025-03-05T11:30:00Z',
    updated: '2025-03-11T08:45:00Z',
    publishDestinations: [],
    tags: ['product-launch', 'social-media', 'marketing'],
    snippet: 'Complete social media kit including post copy, images, and hashtags for Facebook, Twitter, Instagram and LinkedIn.'
  },
  {
    id: 'c004',
    title: '10 SEO Tips for 2025',
    type: 'blog',
    status: 'published',
    author: 'AI Content Agent',
    created: '2025-02-28T09:00:00Z',
    updated: '2025-03-02T14:30:00Z',
    publishDestinations: ['wordpress'],
    tags: ['SEO', 'digital marketing', 'tips'],
    snippet: 'The latest search engine optimization techniques to improve your website ranking and visibility in 2025.'
  },
  {
    id: 'c005',
    title: 'Email Newsletter - March Edition',
    type: 'email',
    status: 'ready',
    author: 'AI Content Agent',
    created: '2025-03-07T15:20:00Z',
    updated: '2025-03-10T11:05:00Z',
    publishDestinations: [],
    tags: ['newsletter', 'email-marketing'],
    snippet: 'Monthly newsletter featuring product updates, industry news, and special offers for March 2025.'
  }
];

const publishDestinations = [
  { id: 'wordpress', name: 'WordPress', type: 'cms', icon: '🌐' },
  { id: 'shopify', name: 'Shopify Blog', type: 'cms', icon: '🛍️' },
  { id: 'medium', name: 'Medium', type: 'cms', icon: '📝' },
  { id: 'twitter', name: 'Twitter/X', type: 'social', icon: '🐦' },
  { id: 'facebook', name: 'Facebook', type: 'social', icon: '👍' },
  { id: 'linkedin', name: 'LinkedIn', type: 'social', icon: '💼' },
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
  
  useEffect(() => {
    if (content) {
      setSelected(content.publishDestinations || []);
    }
  }, [content]);
  
  const handleToggleDestination = (destId) => {
    if (selected.includes(destId)) {
      setSelected(selected.filter(id => id !== destId));
    } else {
      setSelected([...selected, destId]);
    }
  };
  
  if (!content) return null;
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Publish: {content.title}</DialogTitle>
      <DialogContent>
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
                onClick={() => handleToggleDestination(dest.id)}
                color={selected.includes(dest.id) ? 'primary' : 'default'}
                variant={selected.includes(dest.id) ? 'filled' : 'outlined'}
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
                onClick={() => handleToggleDestination(dest.id)}
                color={selected.includes(dest.id) ? 'primary' : 'default'}
                variant={selected.includes(dest.id) ? 'filled' : 'outlined'}
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
                onClick={() => handleToggleDestination(dest.id)}
                color={selected.includes(dest.id) ? 'primary' : 'default'}
                variant={selected.includes(dest.id) ? 'filled' : 'outlined'}
              />
            ))
          }
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={() => onPublish(content.id, selected)} 
          variant="contained" 
          startIcon={<PublishIcon />}
          disabled={selected.length === 0}
        >
          Publish
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
  
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setContentItems(mockContentItems);
      setLoading(false);
    }, 1000);
  }, []);
  
  const handleFilterChange = (event) => {
    setFilter(event.target.value);
  };
  
  const filteredItems = contentItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'published') return item.status === 'published';
    if (filter === 'ready') return item.status === 'ready';
    if (filter === 'draft') return item.status === 'draft';
    if (filter === 'blog') return item.type === 'blog';
    if (filter === 'landing-page') return item.type === 'landing-page';
    if (filter === 'social-media') return item.type === 'social-media';
    if (filter === 'email') return item.type === 'email';
    return true;
  });
  
  const handleViewContent = (content) => {
    console.log('View content:', content);
    // In a real app, you would navigate to a detailed view of this content
  };
  
  const handleEditContent = (content) => {
    console.log('Edit content:', content);
    // In a real app, you would navigate to an editor for this content
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
  
  const handlePublishContent = (contentId, destinations) => {
    console.log('Publishing content ID:', contentId, 'to destinations:', destinations);
    
    // Update local state - in a real app this would be an API call
    const newContentItems = contentItems.map(item => {
      if (item.id === contentId) {
        return {
          ...item,
          status: 'published',
          publishDestinations: destinations
        };
      }
      return item;
    });
    
    setContentItems(newContentItems);
    handleClosePublishDialog();
  };
  
  const handleDeleteContent = (content) => {
    console.log('Delete content:', content);
    
    // Update local state - in a real app this would be an API call with confirmation
    const newContentItems = contentItems.filter(item => item.id !== content.id);
    setContentItems(newContentItems);
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
        
        <ContentTable 
          items={filteredItems}
          onView={handleViewContent}
          onEdit={handleEditContent}
          onPublish={handleOpenPublishDialog}
          onDelete={handleDeleteContent}
        />
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