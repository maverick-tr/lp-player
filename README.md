# LAP - Local App Manager (LP Player)

A sophisticated and beautifully crafted web application that serves as a centralized hub for managing and running local applications and projects. Built with React, Vite, and Tailwind CSS with meticulous attention to detail and user experience.

## ✨ Core Features

### 🚀 Project Management
- ✅ **Centralized Dashboard** - Manage all local applications from one unified interface
- ✅ **One-Click Execution** - Start projects instantly with a single click
- ✅ **Multiple Concurrent Apps** - Run several applications simultaneously
- ✅ **Smart Process Management** - Automatic process tracking and lifecycle management
- ✅ **Environment Auto-Detection** - Intelligent detection of Python venv, Conda, Node.js environments
- ✅ **Port Conflict Detection** - Warns when ports are already in use by other applications
- ✅ **Project Categorization** - Organize apps by categories with custom tags

### 🖥️ Advanced Terminal System
- ✅ **Real-time Output Streaming** - Live terminal output via WebSocket connections
- ✅ **Multi-Tab Terminal Interface** - Switch between outputs of running applications seamlessly
- ✅ **ANSI Color Support** - Full terminal color parsing and display
- ✅ **Auto-minimizing Terminal** - Smart terminal that auto-minimizes when apps are running
- ✅ **Auto-close with Countdown** - Terminal automatically closes after apps stop with visual countdown
- ✅ **Terminal Persistence** - Output history preserved during app lifecycle
- ✅ **Connection Status Indicators** - Real-time WebSocket connection monitoring

### 🎨 Beautiful UI/UX Design
- ✅ **Vinyl Record-Inspired Cards** - Unique animated vinyl record design for app cards
- ✅ **Dark/Light Theme Support** - Seamless theme switching with system preference detection
- ✅ **Advanced Color Controls** - Sepia filter and hue rotation sliders for personalization
- ✅ **Comprehensive Color Palette** - 10+ carefully selected color shades throughout the interface
- ✅ **Auto-Generated App Icons** - Randomly colored vinyl SVG icons for apps without custom logos
- ✅ **Smooth Animations** - Framer Motion powered transitions and micro-interactions
- ✅ **Responsive Design** - Perfect adaptation to desktop, tablet, and mobile screens
- ✅ **Interactive Hover Effects** - Dynamic cursor-following gradients and scaling animations

### 🔍 Smart Search & Discovery
- ✅ **Multi-field Search** - Search by app name, path, tags, or categories
- ✅ **Real-time Filtering** - Instant results with debounced search input
- ✅ **Tag-based Organization** - Auto-complete suggestions for tags and categories
- ✅ **Visual Search Feedback** - Animated search bar with focus states

### 📊 System Monitoring
- ✅ **Real-time CPU Monitoring** - Live CPU usage graphs in the footer
- ✅ **Memory Usage Tracking** - Real-time RAM consumption visualization
- ✅ **WebSocket-based Updates** - Efficient system stats streaming
- ✅ **Color-coded Performance** - Green/Yellow/Red indicators based on usage thresholds

### 🔧 Configuration & Management
- ✅ **Environment Command Auto-fill** - Smart detection and suggestion of activation commands
- ✅ **Custom Port Configuration** - Set and validate port numbers for web applications
- ✅ **Path Validation** - Real-time path verification and directory browsing
- ✅ **Image Upload Support** - Custom logo upload with preview functionality
- ✅ **Bulk Operations** - Add, edit, and delete multiple applications efficiently

### 🌐 Networking & Connectivity
- ✅ **Smart Port Links** - Clickable port links that only work when apps are running
- ✅ **WebSocket Auto-reconnection** - Robust connection handling with retry logic
- ✅ **Cross-platform Support** - Works on macOS, Windows, and Linux
- ✅ **Multi-host Deployment** - Configurable host and port settings

### 🎯 Attention to Detail Features

#### Visual Polish
- ✅ **Smoke Effect Animation** - Beautiful smoke particles when terminal closes
- ✅ **Loading State Animations** - Elegant loading dots with staggered animations
- ✅ **Gooey Visual Effects** - SVG filters for modern visual appeal
- ✅ **Custom Typography** - Inconsolata monospace font for technical aesthetic
- ✅ **Gradient Overlays** - Subtle gradients and textures throughout the interface

#### Smart Interactions
- ✅ **Auto-save Functionality** - Changes persist without manual save actions
- ✅ **Confirmation Dialogs** - Prevent accidental data loss with smart confirmations
- ✅ **Keyboard Shortcuts** - Intuitive keyboard navigation support
- ✅ **Touch-friendly Controls** - Optimized for touch devices and mobile usage

#### Developer Experience
- ✅ **Hot Module Replacement** - Fast development with Vite HMR
- ✅ **TypeScript Support** - Full type checking and IntelliSense
- ✅ **ESLint Integration** - Code quality enforcement
- ✅ **Modular Architecture** - Clean separation of concerns and reusable components

#### Data Management
- ✅ **Local Storage Fallback** - Graceful degradation when server is unavailable
- ✅ **JSON Data Persistence** - Reliable data storage with backup mechanisms
- ✅ **Error Boundary Protection** - Graceful error handling and recovery
- ✅ **Session State Management** - Preserves user preferences across sessions

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or pnpm

### Installation & Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LAP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Development Mode** (Frontend + API)
   ```bash
   npm run dev:api
   # or
   npm start
   ```

4. **Frontend Only** (No persistence)
   ```bash
   npm run dev
   ```

### Production Deployment

1. **Build and Run**
   ```bash
   npm run prod
   ```

2. **Build Only**
   ```bash
   npm run build
   npm run preview
   ```

3. **Using the Start Script**
   ```bash
   # Development
   ./start.sh

   # Production
   ./start.sh prod

   # Clean build
   ./start.sh prod clean
   ```

## 📖 API Reference

### REST Endpoints
- `GET /api/tools` - Retrieve all applications
- `POST /api/tools` - Update applications data
- `POST /api/tools/run` - Execute an application
- `POST /api/tools/stop` - Stop a running application
- `POST /api/detect-environment` - Auto-detect project environment
- `GET /api/system-stats` - Get current system statistics

### WebSocket Events
- `subscribe` - Subscribe to application output
- `process-output` - Receive real-time terminal output
- `system-stats` - Real-time system monitoring data
- `ping/pong` - Connection keep-alive mechanism

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks and context
- **Vite** - Ultra-fast development and building
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Advanced animations and transitions
- **Headless UI** - Accessible UI components
- **React Hot Toast** - Beautiful notification system

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **WebSocket (ws)** - Real-time communication
- **Child Process** - System command execution
- **File System** - Data persistence and file operations

### Development Tools
- **ESLint** - Code linting and quality
- **PostCSS** - CSS processing and optimization
- **Concurrently** - Run multiple processes simultaneously

## 🎨 Customization

### Theme Configuration
- Modify `src/context/ThemeContext.jsx` for theme options
- Adjust color palette in `tailwind.config.js`
- Customize animations in individual components

### Adding New Features
- Follow the modular component structure
- Use the established context patterns for state management
- Maintain TypeScript compatibility for new features

## 📝 Configuration Files

- `tools.json` - Application definitions and metadata
- `tailwind.config.js` - Design system configuration
- `vite.config.js` - Build tool configuration
- `package.json` - Dependencies and scripts

## 🔒 Security Features

- ✅ **CORS Protection** - Configurable cross-origin resource sharing
- ✅ **Input Validation** - Sanitized user inputs and path validation
- ✅ **Process Isolation** - Secure process execution with limited privileges
- ✅ **WebSocket Authentication** - Client verification and connection management

## 🎯 Performance Optimizations

- ✅ **Memoized Components** - React.memo for expensive re-renders
- ✅ **Debounced Search** - Optimized search input handling
- ✅ **Lazy Loading** - Component and resource lazy loading
- ✅ **Efficient WebSocket** - Minimal data transfer and smart reconnection

## 📄 License

This project is proprietary software. All rights reserved.

## 👥 Contributing

Please follow the established code style and component patterns. Ensure all new features include proper error handling and responsive design considerations.

---

**LAP Development Team** - Crafting beautiful developer tools with attention to every detail. 