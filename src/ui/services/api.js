import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add authentication interceptor
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
      const response = await apiClient.post('/auth/login', credentials);
      const { token, user } = response.data;
      
      // Store token in localStorage
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      return user;
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  },
  
  // Logout user
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },
  
  // Get current logged in user
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  // Check if user is logged in
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  }
};

export default {
  integrationService,
  contentService,
  analyticsService,
  authService
};