# Security Testing Guide

This document outlines the security testing approach for the Landing Pad AI Agents platform. It covers automated test suites, security scanning tools, and best practices for maintaining security across the application.

## Authentication System Tests

The authentication system tests are designed to verify the correct functioning of all security-related components, including:

- JWT token generation and validation
- Refresh token mechanism
- Role-based access control (RBAC)
- Permission-based access control
- Account locking and brute force protection
- Password security policies
- API key authentication
- CSRF protection
- XSS prevention
- Rate limiting

### Running Authentication Tests

To run only the security-related tests:

```bash
npm run test:security
```

This will execute all tests in the authentication and security modules.

## Security Scanning in CI/CD Pipeline

Our CI/CD pipeline includes several security scanning tools to automatically detect vulnerabilities and security issues:

### 1. Dependency Vulnerability Scanning

We use npm audit to scan for known vulnerabilities in our dependencies:

```bash
npm run security:audit
```

### 2. Static Code Analysis

ESLint with security plugins is used to detect potential security issues in the codebase:

```bash
npm run lint:security
```

### 3. Secret Scanning

GitLeaks is configured to detect accidentally committed secrets, API keys, and sensitive information:

```bash
# This runs automatically in the CI/CD pipeline
# For local scans, install gitleaks (https://github.com/zricethezav/gitleaks)
gitleaks detect --source . --config .github/gitleaks.toml
```

### 4. License Compliance

To ensure all dependencies have approved licenses:

```bash
npm run security:license
```

### 5. Container Image Scanning

Trivy is used to scan Docker images for vulnerabilities:

```bash
# This runs automatically in the CI/CD pipeline
# For local scans, install trivy (https://aquasecurity.github.io/trivy/)
trivy image landing-pad-ai-agents:latest
```

### 6. SAST Scanning

NodeJSScan is used for static application security testing specific to Node.js applications:

```bash
# This runs automatically in the CI/CD pipeline
# For local scans, install njsscan (https://github.com/ajinabraham/njsscan)
njsscan .
```

## Complete Security Scan

To run a complete security scan locally:

```bash
npm run security:scan
```

This will execute:
1. ESLint security rules
2. Security-specific unit and integration tests
3. npm audit for dependency vulnerabilities

## Security Monitoring

In production, we implement the following security monitoring practices:

1. **Failed Authentication Monitoring**: Alerts on multiple failed authentication attempts
2. **Rate Limit Breach Notifications**: Notifications when API rate limits are consistently breached
3. **Dependency Vulnerability Alerts**: Automated alerts for new vulnerabilities in dependencies
4. **Audit Logging**: Secure logging of all authentication events and sensitive operations

## Security Testing Best Practices

When developing new features or making changes to security-related components:

1. **Always write tests for security features**: Every security-related feature should have comprehensive test coverage
2. **Test both positive and negative scenarios**: Ensure both valid and invalid access attempts are properly handled
3. **Test edge cases**: Especially around token expiration, account locking, and permission boundaries
4. **Review security scans**: Regularly review security scan reports and address any issues promptly
5. **Perform manual testing**: For critical security features, complement automated tests with manual verification

## Common Security Testing Scenarios

When writing security tests, be sure to cover these common scenarios:

1. **Authentication**:
   - Valid/invalid credentials
   - Token expiration and refresh
   - Account locking after failed attempts
   - Password change detection

2. **Authorization**:
   - Role-based access verification
   - Permission-based access verification
   - Admin vs. regular user access

3. **API Security**:
   - Rate limiting effectiveness
   - API key validation
   - Input validation and sanitization

4. **Session Management**:
   - Session timeout
   - Session invalidation on logout
   - Cookie security attributes

5. **Data Protection**:
   - Input validation
   - Output encoding
   - SQL/NoSQL injection prevention

## Reporting Security Issues

Security issues should be reported to the security team following our responsible disclosure policy:

1. Do not disclose security issues publicly until they have been addressed
2. Report issues directly to the security team at security@landingpad.example.com
3. Provide detailed information to reproduce the issue
4. Allow a reasonable timeframe for issues to be addressed before disclosure