import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple token refresh requests
let isRefreshing = false;
// Queue of requests to retry after token refresh
let requestsQueue = [];

// Process the requests queue with new token
const processQueue = (error, token = null) => {
  requestsQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  
  requestsQueue = [];
};

// Add request interceptor for authentication
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If it's a 401 response and we haven't already tried to refresh
    if (
      error.response && 
      error.response.status === 401 && 
      error.response.data?.error?.code === 'token_expired' &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // If we're already refreshing, add this request to the queue
        return new Promise((resolve, reject) => {
          requestsQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axios(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        // Try to refresh the token - this would call your /auth/refresh endpoint
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          // If no refresh token, logout and reject
          authService.logout();
          return Promise.reject(new Error('No refresh token available. Please login again.'));
        }
        
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken
        });
        
        const { token, user } = response.data;
        
        // Store the new token
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        // Update Authorization header for original request
        originalRequest.headers.Authorization = `Bearer ${token}`;
        
        // Process any queued requests
        processQueue(null, token);
        
        // Return the original request with the new token
        return axios(originalRequest);
      } catch (err) {
        // If refresh fails, logout user and reject all queued requests
        authService.logout();
        processQueue(new Error('Failed to refresh token. Please login again.'));
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    
    // If it's not a token issue or we already tried to refresh, reject normally
    return Promise.reject(error);
  }
);

// API service for integrations
export const integrationService = {
  // Get all integrations
  getIntegrations: async () => {
    try {
      const response = await apiClient.get('/integrations');
      return response.data;
    } catch (error) {
      console.error('Error fetching integrations:', error);
      throw error;
    }
  },
  
  // Update integration configuration
  updateIntegration: async (id, config) => {
    try {
      const response = await apiClient.put(`/integrations/${id}`, { config });
      return response.data;
    } catch (error) {
      console.error(`Error updating integration ${id}:`, error);
      throw error;
    }
  },
  
  // Test integration connection
  testConnection: async (id) => {
    try {
      const response = await apiClient.post(`/integrations/${id}/test`);
      return response.data;
    } catch (error) {
      console.error(`Error testing integration ${id}:`, error);
      throw error;
    }
  }
};

// API service for content
export const contentService = {
  // Get all content items
  getContent: async (filters = {}) => {
    try {
      const response = await apiClient.get('/content', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching content:', error);
      throw error;
    }
  },
  
  // Get a single content item by ID
  getContentById: async (id) => {
    try {
      const response = await apiClient.get(`/content/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching content ${id}:`, error);
      throw error;
    }
  },
  
  // Create a new content item
  createContent: async (content) => {
    try {
      const response = await apiClient.post('/content', content);
      return response.data;
    } catch (error) {
      console.error('Error creating content:', error);
      throw error;
    }
  },
  
  // Update a content item
  updateContent: async (id, content) => {
    try {
      const response = await apiClient.put(`/content/${id}`, content);
      return response.data;
    } catch (error) {
      console.error(`Error updating content ${id}:`, error);
      throw error;
    }
  },
  
  // Delete a content item
  deleteContent: async (id) => {
    try {
      const response = await apiClient.delete(`/content/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting content ${id}:`, error);
      throw error;
    }
  },
  
  // Publish content to specific destinations
  publishContent: async (id, destinations) => {
    try {
      const response = await apiClient.post(`/content/${id}/publish`, { destinations });
      return response.data;
    } catch (error) {
      console.error(`Error publishing content ${id}:`, error);
      throw error;
    }
  }
};

// API service for analytics
export const analyticsService = {
  // Get dashboard summary metrics
  getSummaryMetrics: async (timeRange) => {
    try {
      const response = await apiClient.get('/analytics/summary', { params: { timeRange } });
      return response.data;
    } catch (error) {
      console.error('Error fetching summary metrics:', error);
      throw error;
    }
  },
  
  // Get website traffic data
  getTrafficData: async (timeRange) => {
    try {
      const response = await apiClient.get('/analytics/traffic', { params: { timeRange } });
      return response.data;
    } catch (error) {
      console.error('Error fetching traffic data:', error);
      throw error;
    }
  },
  
  // Get content performance data
  getContentPerformance: async (timeRange) => {
    try {
      const response = await apiClient.get('/analytics/content-performance', { params: { timeRange } });
      return response.data;
    } catch (error) {
      console.error('Error fetching content performance:', error);
      throw error;
    }
  },
  
  // Get social media engagement data
  getSocialEngagement: async (timeRange) => {
    try {
      const response = await apiClient.get('/analytics/social-engagement', { params: { timeRange } });
      return response.data;
    } catch (error) {
      console.error('Error fetching social engagement:', error);
      throw error;
    }
  }
};

// Authentication service
export const authService = {
  // Login user
  login: async (credentials) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, credentials);
      const { token, refreshToken, user } = response.data;
      
      // Store tokens in localStorage
      localStorage.setItem('authToken', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      return user;
    } catch (error) {
      console.error('Error during login:', error);
      
      // Provide more specific error messages based on server response
      if (error.response) {
        if (error.response.status === 401) {
          throw new Error('Invalid username or password');
        } else if (error.response.data && error.response.data.error) {
          throw new Error(error.response.data.error.message || 'Authentication failed');
        }
      }
      
      throw new Error('Login failed. Please check your network connection and try again.');
    }
  },
  
  // Logout user
  logout: async (fromServer = true) => {
    if (fromServer) {
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          // Notify server to invalidate the refresh token
          await apiClient.post('/auth/logout', { refreshToken });
        }
      } catch (error) {
        console.error('Error during server logout:', error);
        // Continue with local logout even if server logout fails
      }
    }
    
    // Clear all auth-related data from localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Optional: redirect to login page
    // window.location.href = '/login';
  },
  
  // Refresh authentication token
  refreshToken: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      const { token, user } = response.data;
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      return { token, user };
    } catch (error) {
      console.error('Error refreshing token:', error);
      // If refresh fails, logout
      authService.logout(false);
      throw error;
    }
  },
  
  // Get current logged in user
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  // Check if user is logged in
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },
  
  // Register a new user
  register: async (userData) => {
    try {
      const response = await apiClient.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      console.error('Error during registration:', error);
      
      // Provide more specific error messages
      if (error.response) {
        if (error.response.status === 409) {
          throw new Error('Username or email already exists');
        } else if (error.response.data && error.response.data.error) {
          throw new Error(error.response.data.error.message || 'Registration failed');
        }
      }
      
      throw error;
    }
  },
  
  // Request password reset
  requestPasswordReset: async (email) => {
    try {
      const response = await apiClient.post('/auth/request-reset', { email });
      return response.data;
    } catch (error) {
      console.error('Error requesting password reset:', error);
      throw error;
    }
  },
  
  // Reset password using token
  resetPassword: async (token, newPassword) => {
    try {
      const response = await apiClient.post('/auth/reset-password', { 
        token,
        newPassword
      });
      return response.data;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  },
  
  // Update user profile
  updateProfile: async (userData) => {
    try {
      const response = await apiClient.put('/auth/profile', userData);
      
      // Update stored user data
      const updatedUser = response.data;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      return updatedUser;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },
  
  // Change password
  changePassword: async (currentPassword, newPassword) => {
    try {
      const response = await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      return response.data;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }
};

// API service for agent operations
export const agentService = {
  // Get all agents status
  getAllAgentStatus: async () => {
    try {
      const response = await apiClient.get('/agents');
      return response.data.agents;
    } catch (error) {
      console.error('Error fetching agent status:', error);
      throw error;
    }
  },
  
  // Get specific agent status
  getAgentStatus: async (agentName) => {
    try {
      const response = await apiClient.get(`/agents/${agentName}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching agent ${agentName} status:`, error);
      throw error;
    }
  },
  
  // Start an agent
  startAgent: async (agentName) => {
    try {
      const response = await apiClient.post(`/agents/${agentName}/start`);
      return response.data;
    } catch (error) {
      console.error(`Error starting agent ${agentName}:`, error);
      throw error;
    }
  },
  
  // Stop an agent
  stopAgent: async (agentName) => {
    try {
      const response = await apiClient.post(`/agents/${agentName}/stop`);
      return response.data;
    } catch (error) {
      console.error(`Error stopping agent ${agentName}:`, error);
      throw error;
    }
  },
  
  // Create a content brief
  createContentBrief: async (briefData) => {
    try {
      const response = await apiClient.post('/strategy/brief', briefData);
      return response.data;
    } catch (error) {
      console.error('Error creating content brief:', error);
      throw error;
    }
  },
  
  // Generate content calendar
  generateContentCalendar: async (calendarData) => {
    try {
      const response = await apiClient.post('/strategy/calendar', calendarData);
      return response.data;
    } catch (error) {
      console.error('Error generating content calendar:', error);
      throw error;
    }
  },
  
  // Generate content
  generateContent: async (contentData) => {
    try {
      const response = await apiClient.post('/creation/generate', contentData);
      return response.data;
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
    }
  },
  
  // Edit content
  editContent: async (editData) => {
    try {
      const response = await apiClient.post('/creation/edit', editData);
      return response.data;
    } catch (error) {
      console.error('Error editing content:', error);
      throw error;
    }
  },
  
  // Generate headlines
  generateHeadlines: async (headlineData) => {
    try {
      const response = await apiClient.post('/creation/headlines', headlineData);
      return response.data;
    } catch (error) {
      console.error('Error generating headlines:', error);
      throw error;
    }
  },
  
  // Check content for brand consistency
  reviewContentForBrand: async (reviewData) => {
    try {
      const response = await apiClient.post('/brand/review', reviewData);
      return response.data;
    } catch (error) {
      console.error('Error reviewing content for brand consistency:', error);
      throw error;
    }
  },
  
  // Generate SEO recommendations
  generateSeoRecommendations: async (seoData) => {
    try {
      const response = await apiClient.post('/optimization/seo', seoData);
      return response.data;
    } catch (error) {
      console.error('Error generating SEO recommendations:', error);
      throw error;
    }
  },
  
  // Generate A/B testing suggestions
  generateAbTestingSuggestions: async (abData) => {
    try {
      const response = await apiClient.post('/optimization/ab-testing', abData);
      return response.data;
    } catch (error) {
      console.error('Error generating A/B testing suggestions:', error);
      throw error;
    }
  }
};

// API service for workflow operations
export const workflowService = {
  // Get all workflows
  getAllWorkflows: async (filters = {}) => {
    try {
      const response = await apiClient.get('/workflows', { params: filters });
      return response.data.workflows;
    } catch (error) {
      console.error('Error fetching workflows:', error);
      throw error;
    }
  },
  
  // Get a specific workflow by ID
  getWorkflow: async (workflowId) => {
    try {
      const response = await apiClient.get(`/workflows/${workflowId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching workflow ${workflowId}:`, error);
      throw error;
    }
  },
  
  // Create a new workflow
  createWorkflow: async (workflowData) => {
    try {
      const response = await apiClient.post('/workflows', workflowData);
      return response.data;
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  },
  
  // Cancel a workflow
  cancelWorkflow: async (workflowId) => {
    try {
      const response = await apiClient.post(`/workflows/${workflowId}/cancel`);
      return response.data;
    } catch (error) {
      console.error(`Error canceling workflow ${workflowId}:`, error);
      throw error;
    }
  },
  
  // Pause a workflow
  pauseWorkflow: async (workflowId) => {
    try {
      const response = await apiClient.post(`/workflows/${workflowId}/pause`);
      return response.data;
    } catch (error) {
      console.error(`Error pausing workflow ${workflowId}:`, error);
      throw error;
    }
  },
  
  // Resume a workflow
  resumeWorkflow: async (workflowId) => {
    try {
      const response = await apiClient.post(`/workflows/${workflowId}/resume`);
      return response.data;
    } catch (error) {
      console.error(`Error resuming workflow ${workflowId}:`, error);
      throw error;
    }
  },
  
  // Get predefined workflow templates
  getWorkflowTemplates: async () => {
    try {
      const response = await apiClient.get('/workflow-templates');
      return response.data.templates;
    } catch (error) {
      console.error('Error fetching workflow templates:', error);
      throw error;
    }
  },
  
  // Create workflow from template
  createFromTemplate: async (templateId, parameters) => {
    try {
      const response = await apiClient.post(`/workflow-templates/${templateId}/create`, { parameters });
      return response.data;
    } catch (error) {
      console.error(`Error creating workflow from template ${templateId}:`, error);
      throw error;
    }
  }
};

export default {
  integrationService,
  contentService,
  analyticsService,
  authService,
  agentService,
  workflowService
};