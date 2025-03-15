# Deployment Guide

This guide provides instructions for deploying the Landing Pad AI Agents system using our CI/CD pipeline.

## CI/CD Pipeline

The system uses GitHub Actions for continuous integration and deployment. The pipeline is configured to:

1. Run tests and linting on pull requests and pushes to main branch
2. Deploy to staging environment when code is merged to main
3. Deploy to production environment when a version tag is created

## Environments

### Development

- Used for local development
- Configure via `.env` file (copy from `.env.example`)
- MongoDB database is local or development instance
- Runs with hot reloading using `npm run dev`

### Test

- Used for automated testing
- Configured via environment variables in GitHub Actions
- Uses in-memory MongoDB or test container
- Runs using `npm test`

### Staging

- Deployed automatically when code is merged to main branch
- Configured via environment variables in GitHub Actions and AWS
- Full environment mimicking production
- Used for QA, integration testing, and demos

### Production

- Deployed manually via GitHub Actions when ready for release
- Requires version tag (e.g., v1.0.0) or manual workflow dispatch
- Configured via environment variables in AWS and GitHub Secrets
- Includes additional monitoring, logging, and performance optimizations

## Required Environment Variables

For deployment, ensure the following environment variables are set in GitHub Secrets:

### Common Variables (All Environments)

- `NODE_ENV` - Environment name (development, test, staging, production)
- `PORT` - HTTP port to listen on
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT authentication
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` - API keys for AI providers

### S3 Storage Variables

- `S3_ACCESS_KEY_ID` - S3 access key for storage
- `S3_SECRET_ACCESS_KEY` - S3 secret key for storage
- `S3_REGION` - S3 region for storage
- `S3_BUCKET` - S3 bucket for assets and deployment artifacts

### Optional Variables

- `REDIS_URL` - Redis connection string for caching (recommended for production)
- `SENTRY_DSN` - Sentry DSN for error tracking
- `RABBITMQ_URL` - RabbitMQ connection string for message queuing

## Deployment Process

### Setting Up a New Environment

1. Create necessary infrastructure (EC2 instances, Elastic Beanstalk, MongoDB, etc.)
2. Configure environment variables in AWS Elastic Beanstalk or EC2
3. Set up corresponding environment in GitHub Actions
4. Add required secrets to GitHub repository settings

### First-time Deployment

1. Ensure database migrations are created (`npm run migrate:create "initial schema"`)
2. Push code to main branch or create a version tag
3. Monitor GitHub Actions workflow for deployment status
4. Verify application is running correctly in the new environment

### Regular Deployments

Deployments occur automatically based on git workflow:

- **Staging**: Push or merge to main branch
- **Production**: Create a version tag or manually trigger workflow

### Manual Deployment

If needed, you can manually trigger the deployment workflow:

1. Go to GitHub Actions tab
2. Select "Deploy" workflow
3. Click "Run workflow"
4. Select the branch and environment
5. Click "Run workflow"

## Database Migrations

Database migrations are run automatically during deployment, but can also be run manually:

```bash
# Check migration status
npm run migrate:status

# Apply pending migrations
npm run migrate:up

# Revert last migration
npm run migrate:down
```

## Rollback Procedure

If a deployment fails or causes issues:

1. Go to AWS Elastic Beanstalk console
2. Select the environment
3. Click "Application versions"
4. Select a previous version
5. Click "Deploy"

Alternatively, you can revert the code and push again:

```bash
git revert <commit-hash>
git push
```

## Monitoring and Logs

- Application logs are available in CloudWatch Logs
- Health check status is available in Elastic Beanstalk console
- Custom monitoring dashboard is available at `/monitor` (admin access only)

## Security Considerations

- JWT secrets and API keys should never be committed to the repository
- Use IAM roles with minimal permissions for AWS resources
- Enable AWS CloudTrail for auditing
- Regularly rotate secrets and API keys
- Use VPC and security groups to restrict access to resources