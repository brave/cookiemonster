#!/bin/bash
set -e

# Check if running in Docker by checking /.dockerenv
if [ ! -f "/.dockerenv" ]; then
    echo "Error: This script must be run within Docker container"
    exit 1
fi

if [ -d "profile" ]; then
    echo "Removing existing profiles directory"
    rm -rf profile
fi

echo "Installing dependencies"
npm ci

echo "Applying browser patches"
npm run rebrowser-patches

echo "Setting up browser profile"
npm run setup -- ${BRAVE_BINARY}

chmod -R o+rX profile