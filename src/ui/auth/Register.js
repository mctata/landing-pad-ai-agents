import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  CircularProgress,
  Alert,
  Link,
  InputAdornment,
  IconButton,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { authService } from '../services/api';

function Register({ onRegistrationSuccess }) {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const steps = ['Personal Information', 'Account Setup', 'Confirmation'];
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field-specific error when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const validateStep = () => {
    const newErrors = {};
    
    if (activeStep === 0) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    } else if (activeStep === 1) {
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
        newErrors.email = 'Invalid email address';
      }
      
      if (!formData.username.trim()) {
        newErrors.username = 'Username is required';
      } else if (formData.username.length < 4) {
        newErrors.username = 'Username must be at least 4 characters';
      }
      
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
      
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleNext = () => {
    if (validateStep()) {
      setActiveStep(prev => prev + 1);
    }
  };
  
  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep()) {
      return;
    }
    
    setLoading(true);
    setGeneralError(null);
    
    try {
      // Prepare data for API
      const userData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        username: formData.username,
        password: formData.password
      };
      
      // Call register API
      await authService.register(userData);
      
      // Move to success step
      setActiveStep(2);
      
      // Call success callback if provided
      if (onRegistrationSuccess) {
        onRegistrationSuccess();
      }
    } catch (error) {
      console.error('Registration error:', error);
      setGeneralError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <>
            <TextField
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              margin="normal"
              fullWidth
              autoFocus
              disabled={loading}
              error={!!errors.firstName}
              helperText={errors.firstName}
            />
            
            <TextField
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              margin="normal"
              fullWidth
              disabled={loading}
              error={!!errors.lastName}
              helperText={errors.lastName}
            />
          </>
        );
        
      case 1:
        return (
          <>
            <TextField
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              fullWidth
              disabled={loading}
              error={!!errors.email}
              helperText={errors.email}
            />
            
            <TextField
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              margin="normal"
              fullWidth
              disabled={loading}
              error={!!errors.username}
              helperText={errors.username}
            />
            
            <TextField
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              fullWidth
              disabled={loading}
              error={!!errors.password}
              helperText={errors.password}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleTogglePasswordVisibility}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            <TextField
              label="Confirm Password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleChange}
              margin="normal"
              fullWidth
              disabled={loading}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword}
            />
          </>
        );
        
      case 2:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="h6" gutterBottom>
              Registration Successful!
            </Typography>
            
            <Typography variant="body1" paragraph>
              Your account has been created successfully.
            </Typography>
            
            <Button 
              variant="contained" 
              component={Link} 
              href="/login"
              sx={{ mt: 2 }}
            >
              Go to Login
            </Button>
          </Box>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      bgcolor: 'background.default',
      py: 4
    }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          maxWidth: 600, 
          width: '100%',
          mx: 2
        }}
      >
        <Typography variant="h4" component="h1" align="center" gutterBottom>
          Create Account
        </Typography>
        
        <Stepper activeStep={activeStep} sx={{ mb: 4, pt: 2 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {generalError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {generalError}
          </Alert>
        )}
        
        <Box component="form" onSubmit={activeStep === 1 ? handleSubmit : undefined}>
          {renderStepContent()}
          
          {activeStep < 2 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button
                disabled={activeStep === 0 || loading}
                onClick={handleBack}
              >
                Back
              </Button>
              
              {activeStep === 0 ? (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={loading}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Register'}
                </Button>
              )}
            </Box>
          )}
        </Box>
        
        {activeStep < 2 && (
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2">
              Already have an account?{' '}
              <Link href="/login" underline="hover">
                Sign in
              </Link>
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

export default Register;