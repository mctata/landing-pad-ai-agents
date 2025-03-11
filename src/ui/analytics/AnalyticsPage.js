import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Card, CardContent, 
  FormControl, InputLabel, Select, MenuItem,
  CircularProgress, Tab, Tabs
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

// Mock data - in a real app this would come from your API
const mockAnalyticsData = {
  // Website traffic
  traffic: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Sessions',
        data: [2500, 2800, 3200, 4000, 4500, 5200, 5800, 6200, 6800, 7500, 8200, 9000],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
      {
        label: 'Users',
        data: [2000, 2200, 2600, 3200, 3600, 4100, 4500, 4800, 5200, 5700, 6300, 6800],
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  },
  
  // Content performance
  contentPerformance: {
    labels: ['Landing Page', 'Blog Post 1', 'Blog Post 2', 'Product Page', 'About Us'],
    datasets: [
      {
        label: 'Page Views',
        data: [5200, 3800, 2900, 4100, 1800],
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
      {
        label: 'Avg. Time on Page (sec)',
        data: [120, 240, 180, 90, 60],
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  },
  
  // Social media engagement
  socialEngagement: {
    labels: ['Facebook', 'Twitter/X', 'Bluesky', 'LinkedIn', 'Instagram'],
    datasets: [
      {
        label: 'Engagement',
        data: [1200, 780, 680, 1500, 950],
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(153, 102, 255, 0.5)',
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
        ],
        borderWidth: 1,
      },
    ],
  },
  
  // Conversion rates
  conversionRates: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Conversion Rate (%)',
        data: [1.8, 2.0, 2.2, 2.5, 2.8, 3.0, 3.2, 3.5, 3.8, 4.0, 4.2, 4.5],
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.5)',
        tension: 0.3,
      },
    ],
  },
};

// Dashboard metrics summary
const summaryMetrics = [
  { 
    title: 'Total Sessions', 
    value: '65,800', 
    change: '+15.3%',
    color: 'success.main'
  },
  { 
    title: 'Avg. Engagement Rate', 
    value: '4.2%', 
    change: '+0.8%',
    color: 'success.main'
  },
  { 
    title: 'Content Conversions', 
    value: '2,340', 
    change: '+23.5%',
    color: 'success.main'
  },
  { 
    title: 'Avg. Session Duration', 
    value: '2m 45s', 
    change: '-0.3%',
    color: 'error.main'
  },
];

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
  const [analyticsData, setAnalyticsData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setAnalyticsData(mockAnalyticsData);
      setLoading(false);
    }, 1500);
  }, []);
  
  const handleTimeRangeChange = (event) => {
    setTimeRange(event.target.value);
    // In a real app, you would fetch new data based on the time range
  };
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Analytics Dashboard
        </Typography>
        
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