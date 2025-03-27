#!/bin/bash

# Print a colorful banner
echo ""
echo -e "\033[1;33m  _        _    ____   \033[0m"
echo -e "\033[1;33m | |      / \  |  _ \  \033[0m"
echo -e "\033[1;33m | |     / _ \ | |_) | \033[0m"
echo -e "\033[1;33m | |___ / ___ \|  __/  \033[0m"
echo -e "\033[1;33m |_____/_/   \_\_|     \033[0m"
echo -e "\033[1;33m                        \033[0m"
echo -e "\033[1;37mLocal App Launcher\033[0m"
echo ""
echo -e "\033[1;32mStarting API and Web Server...\033[0m"
echo ""

echo "Starting API and Web Server..."
echo

echo "Checking dependencies..."
npm install

# Check if concurrently is already available locally
if ! npx concurrently --version &> /dev/null; then
  echo "Installing concurrently locally..."
  npm install --save-dev concurrently
fi

echo "Starting servers..."
npx concurrently "npm run dev" "npm run api" 