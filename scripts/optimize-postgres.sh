#!/bin/bash
# PostgreSQL Optimization Script
# This script runs all database optimizations for the landing-pad-ai-agents project

set -e

# Display banner
echo "=============================================="
echo "  PostgreSQL Database Optimization Script"
echo "=============================================="

# Function to run a command with timing
run_timed() {
  echo ""
  echo "📌 $1"
  echo "----------------------------------------------"
  
  local start_time=$(date +%s)
  
  $2
  
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  echo "----------------------------------------------"
  echo "✅ Completed in ${duration}s"
}

# Check environment
if [ -z "$NODE_ENV" ]; then
  echo "NODE_ENV not set, defaulting to development"
  export NODE_ENV=development
fi
echo "Environment: $NODE_ENV"

# Step 1: Apply all migrations
run_timed "Running standard migrations" "npm run migrate:up"

# Step 2: Add full-text search capability
run_timed "Adding PostgreSQL full-text search" "npm run migrate:search"

# Step 3: Add performance indexes
run_timed "Adding performance indexes" "npm run migrate:indexes"

# Step 4: Migrate workflow steps to relational model
run_timed "Migrating workflow steps to relational model" "npm run migrate:workflow-steps"

# Step 5: Analyze database for query optimization
if [ "$NODE_ENV" = "production" ]; then
  run_timed "Analyzing database for query optimization" "npx sequelize-cli db:seed --seed-name optimize-db-analyze.js"
fi

echo ""
echo "=============================================="
echo "✨ PostgreSQL optimization completed successfully!"
echo "=============================================="