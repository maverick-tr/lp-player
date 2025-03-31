#!/bin/bash

# Print a colorful banner
echo ""
echo -e "\033[1;33m  _      ____    ____  _                           \033[0m"
echo -e "\033[1;33m | |    |  _ \  |  _ \| | __ _ _   _  ___ _ __    \033[0m"
echo -e "\033[1;33m | |    | |_) | | |_) | |/ _\` | | | |/ _ \ '__|   \033[0m"
echo -e "\033[1;33m | |___ |  __/  |  __/| | (_| | |_| |  __/ |      \033[0m"
echo -e "\033[1;33m |_____|_|     |_|   |_|\__,_|\__, |\___|_|       \033[0m"
echo -e "\033[1;33m                               |___/                \033[0m"
echo -e "\033[1;37mLP Player\033[0m"
echo ""
echo -e "\033[1;32mStarting Server...\033[0m"
echo ""

# Check if concurrently is available or install it
ensure_concurrently() {
  if ! npx concurrently --version &> /dev/null; then
    echo "Installing concurrently locally..."
    npm install --save-dev concurrently
  fi
}

# Check if clean flag is provided
CLEAN_BUILD=false
if [ "$2" == "clean" ]; then
  CLEAN_BUILD=true
fi

# Check if production mode is requested
if [ "$1" == "prod" ] || [ "$1" == "production" ]; then
    echo "Starting in PRODUCTION mode..."
    echo

    echo "Installing dependencies (including build tools)..."
    # We need dev dependencies for building
    npm install

    # Clean build if requested
    if [ "$CLEAN_BUILD" == "true" ]; then
      echo "Performing clean build..."
      rm -rf dist
      echo "Cleaned dist directory"
    fi

    echo "Building application..."
    # Use npx to ensure vite is found
    npx vite build

    # Ensure concurrently is available
    ensure_concurrently

    echo "Starting production servers..."
    echo "Web UI will be available at: http://localhost:4242"
    export HOST=0.0.0.0
    export PORT=4242

    # Check if api:prod script exists, otherwise fall back to api
    if grep -q "\"api:prod\":" package.json; then
      API_SCRIPT="api:prod"
    else
      echo "No api:prod script found, using api script instead..."
      API_SCRIPT="api"
    fi

    npx concurrently "npx vite preview --host --port 4242" "npm run $API_SCRIPT -- --host 0.0.0.0 --port 4243"
else
    echo "Starting in DEVELOPMENT mode..."
    echo

    echo "Installing dependencies..."
    npm install

    # Ensure concurrently is available
    ensure_concurrently

    echo "Starting development servers..."
    echo "Web UI will be available at: http://localhost:4242"
    export HOST=0.0.0.0
    export PORT=4242
    npx concurrently "npm run dev -- --host --port 4242" "npm run api -- --host 0.0.0.0 --port 4243"
fi 