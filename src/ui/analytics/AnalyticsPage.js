import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Card, CardContent, 
  FormControl, InputLabel, Select, MenuItem,
  CircularProgress, Tab, Tabs, Alert
} from '@mui/material';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  Title, 
  Tooltip, 
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { analyticsService } from '../services/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

function MetricCard({ title, value, change, color }) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center' }}>
        <Typography variant="h5" component="div" gutterBottom>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        {change && (
          <Typography variant="caption" sx={{ color: color }}>
            {change} vs previous period
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function ChartContainer({ title, children }) {
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6" component="h3" gutterBottom>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('lastMonth');
  const [analyticsData, setAnalyticsData] = useState({
    traffic: null,
    contentPerformance: null,
    socialEngagement: null,
    conversionRates: null
  });
  const [summaryMetrics, setSummaryMetrics] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState(null);
  
  // Function to fetch all analytics data
  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all data in parallel
      const [dashboardData, trafficData, contentData, socialData] = await Promise.all([
        analyticsService.getSummaryMetrics(timeRange),
        analyticsService.getTrafficData(timeRange),
        analyticsService.getContentPerformance(timeRange),
        analyticsService.getSocialEngagement(timeRange)
      ]);
      
      // Process dashboard summary metrics
      setSummaryMetrics(dashboardData.metrics || []);
      
      // Update all chart data
      setAnalyticsData({
        traffic: trafficData,
        contentPerformance: contentData,
        socialEngagement: socialData,
        conversionRates: trafficData.conversionData // This might be part of traffic data
      });
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch data initially and when time range changes
  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);
  
  const handleTimeRangeChange = (event) => {
    setTimeRange(event.target.value);
  };
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  const handleRefresh = () => {
    fetchAnalyticsData();
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  // Common options for charts
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };
  
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };
  
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
    },
  };
  
  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
    
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Analytics Dashboard
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="time-range-label">Time Range</InputLabel>
            <Select
              labelId="time-range-label"
              id="time-range-select"
              value={timeRange}
              label="Time Range"
              onChange={handleTimeRangeChange}
            >
              <MenuItem value="last7Days">Last 7 Days</MenuItem>
              <MenuItem value="last30Days">Last 30 Days</MenuItem>
              <MenuItem value="lastMonth">Last Month</MenuItem>
              <MenuItem value="lastQuarter">Last Quarter</MenuItem>
              <MenuItem value="ytd">Year to Date</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>
      
      {/* Summary metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {summaryMetrics.map((metric, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <MetricCard {...metric} />
          </Grid>
        ))}
      </Grid>
      
      {/* Tabs for different analytics views */}
      <Box sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Website Analytics" />
          <Tab label="Content Performance" />
          <Tab label="Social Media" />
        </Tabs>
      </Box>
      
      {/* Website Analytics Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <ChartContainer title="Website Traffic">
              <Box sx={{ height: 350 }}>
                <Line options={lineOptions} data={analyticsData.traffic} />
              </Box>
            </ChartContainer>
          </Grid>
          <Grid item xs={12} md={4}>
            <ChartContainer title="Conversion Rates">
              <Box sx={{ height: 350 }}>
                <Line options={lineOptions} data={analyticsData.conversionRates} />
              </Box>
            </ChartContainer>
          </Grid>
        </Grid>
      )}
      
      {/* Content Performance Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <ChartContainer title="Content Performance Metrics">
              <Box sx={{ height: 400 }}>
                <Bar options={barOptions} data={analyticsData.contentPerformance} />
              </Box>
            </ChartContainer>
          </Grid>
        </Grid>
      )}
      
      {/* Social Media Tab */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <ChartContainer title="Social Media Engagement">
              <Box sx={{ height: 350 }}>
                <Pie options={pieOptions} data={analyticsData.socialEngagement} />
              </Box>
            </ChartContainer>
          </Grid>
          <Grid item xs={12} md={6}>
            <ChartContainer title="Social Media Traffic">
              <Box sx={{ height: 350 }}>
                <Bar options={barOptions} data={{
                  labels: ['Facebook', 'Twitter/X', 'Bluesky', 'LinkedIn', 'Instagram'],
                  datasets: [
                    {
                      label: 'Sessions',
                      data: [3200, 2400, 1850, 2800, 1900],
                      backgroundColor: 'rgba(53, 162, 235, 0.5)',
                    },
                  ],
                }} />
              </Box>
            </ChartContainer>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default AnalyticsPage;