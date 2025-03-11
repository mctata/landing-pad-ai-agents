#!/bin/bash

# Deployment script for AWS Elastic Beanstalk
# This script creates a deployment package and deploys it to Elastic Beanstalk

# Fail on any error
set -e

# Environment variables
APP_NAME="landing-pad-ai-agents"
ENV_NAME=$1
VERSION_LABEL=$2
S3_BUCKET=$3
AWS_REGION=${4:-"us-east-1"}

# Validate input
if [ -z "$ENV_NAME" ] || [ -z "$VERSION_LABEL" ] || [ -z "$S3_BUCKET" ]; then
  echo "Usage: $0 <environment-name> <version-label> <s3-bucket> [aws-region]"
  echo "Example: $0 staging v1.0.0 my-deployment-bucket us-east-1"
  exit 1
fi

# Create deployment directory
echo "Creating deployment package..."
mkdir -p ./deploy

# Copy files to deployment directory
cp -r ./src ./deploy/
cp -r ./migrations ./deploy/
cp -r ./scripts ./deploy/
cp -r ./config ./deploy/
cp package.json ./deploy/
cp package-lock.json ./deploy/
cp .ebextensions ./deploy/ 2>/dev/null || :
cp .platform ./deploy/ 2>/dev/null || :
cp Procfile ./deploy/ 2>/dev/null || :

# Create deployment package
echo "Creating deployment zip..."
cd ./deploy
zip -r "../${APP_NAME}-${VERSION_LABEL}.zip" .
cd ..

# Upload to S3
echo "Uploading to S3..."
aws s3 cp "${APP_NAME}-${VERSION_LABEL}.zip" "s3://${S3_BUCKET}/${APP_NAME}/${ENV_NAME}/${APP_NAME}-${VERSION_LABEL}.zip" --region "${AWS_REGION}"

# Create application version in Elastic Beanstalk
echo "Creating application version in Elastic Beanstalk..."
aws elasticbeanstalk create-application-version \
  --application-name "${APP_NAME}" \
  --version-label "${VERSION_LABEL}" \
  --source-bundle "S3Bucket=${S3_BUCKET},S3Key=${APP_NAME}/${ENV_NAME}/${APP_NAME}-${VERSION_LABEL}.zip" \
  --region "${AWS_REGION}"

# Deploy to environment
echo "Deploying to ${ENV_NAME} environment..."
aws elasticbeanstalk update-environment \
  --environment-name "${APP_NAME}-${ENV_NAME}" \
  --version-label "${VERSION_LABEL}" \
  --region "${AWS_REGION}"

# Clean up
echo "Cleaning up..."
rm -rf ./deploy
rm "${APP_NAME}-${VERSION_LABEL}.zip"

echo "Deployment initiated. Check AWS Elastic Beanstalk console for status."
echo "URL: https://${AWS_REGION}.console.aws.amazon.com/elasticbeanstalk/home?region=${AWS_REGION}#/environment/dashboard?applicationName=${APP_NAME}&environmentId=${APP_NAME}-${ENV_NAME}"