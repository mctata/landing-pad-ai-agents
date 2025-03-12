#!/bin/bash

# Script to install git hooks

# Ensure the hooks directory exists
mkdir -p .git/hooks

# Copy pre-commit hook
cp .github/hooks/pre-commit .git/hooks/pre-commit

# Make it executable
chmod +x .git/hooks/pre-commit

echo "Git hooks installed successfully!"