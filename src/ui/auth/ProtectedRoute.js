import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { authService } from '../services/api';

/**
 * A wrapper for routes that should only be accessible to authenticated users.
 * If the user is not logged in, they will be redirected to the login page.
 */
function ProtectedRoute({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const verifyAuth = async () => {
      setIsChecking(true);
      try {
        // Check if user is authenticated using the token
        if (authService.isAuthenticated()) {
          // Optionally verify token with the server
          // This could be a call to validate the token or get the current user
          // await authService.getCurrentUserFromServer();
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        // If there's an error (like an invalid token), set as not authenticated
        setIsAuthenticated(false);
        // Clear any invalid auth data
        authService.logout(false);
      } finally {
        setIsChecking(false);
      }
    };

    verifyAuth();
  }, []);

  if (isChecking) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page, keeping the intended destination in state
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated, render the protected route content
  return children;
}

export default ProtectedRoute;