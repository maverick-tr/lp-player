# LAP - Local App Manager

A modern web application that serves as a centralized hub for managing and running local applications and projects. Built with React, Vite, and Tailwind CSS.

## Features

- 🚀 Run and manage local applications from a central dashboard
- 🔍 Search functionality for apps by name, path, or tags
- 🌓 Dark/Light theme support
- 📱 Responsive design
- 💻 System resource monitoring (CPU and RAM usage)
- 🔄 Environment detection for virtual environments and conda
- ➕ Easy app addition through the UI

## App Management

LAP allows you to:
- Configure and run local projects with a single click
- Automatically detect environment settings
- Monitor running status of all your applications
- View system resource usage while apps are running

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   # Run the frontend only (no backend persistence)
   npm run dev
   
   # Run both frontend and simplified API server
   npm run dev:api
   
   # Alternative: Run with the full server (if you have the server code)
   npm run dev:all
   ```

## API Server

The application provides two options for running the backend API:

1. **Simplified API Server** (Recommended): A lightweight Express server that handles saving and loading tools directly from the tools.json file.
   ```bash
   npm run api
   ```

2. **Full Server**: The original server implementation with all features.
   ```bash
   npm run server
   ```

Without a running server, the app will:
- Store changes in localStorage (persists between refreshes in the same browser)
- Show a warning in the console but continue to function
- Not be able to save changes to the tools.json file

## Adding Applications

Click the "+" button in the top left corner to add a new application. You'll need to provide:
- App name and description
- Project root path
- Environment settings (if applicable)
- Command to run the application

## Development

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build

## Technology Stack

- Frontend: React + Vite
- Styling: Tailwind CSS
- State Management: React Context
- Build Tool: Vite

## License

This project is proprietary software. All rights reserved.

## Contact

LAP Development Team 