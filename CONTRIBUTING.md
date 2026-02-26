# Contributing to LP Player

Thanks for your interest in contributing! LP Player is open source and welcomes contributions of all kinds — bug fixes, features, docs, and ideas.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/lp-player.git
   cd lp-player
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Start development servers:**
   ```bash
   npm run dev:api
   # or
   ./start.sh
   ```
   This runs the Vite dev server (`:4242`) and the API server (`:4243`) concurrently.

## Making Changes

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Ensure linting passes:
   ```bash
   npm run lint
   ```
4. Commit with a clear message:
   ```bash
   git commit -m "Add: short description of what you did"
   ```
5. Push and open a Pull Request

## Code Style

- **React**: Functional components only, hooks for state, `React.memo()` for expensive components
- **Files**: PascalCase `.jsx` for components, camelCase `.js` for utilities and hooks
- **Styling**: Tailwind CSS with project design tokens (`tool-dark`, `tool-accent`, `tool-border`)
- **Modules**: ESM throughout (except `server.cjs` for production)
- **Keep it simple**: Don't over-abstract. Three similar lines are better than a premature utility function.

## Project Structure

```
src/
├── components/       # React components by feature domain
├── context/          # State providers (Theme, Tools, Terminal, etc.)
├── hooks/            # Context hooks (useTools, useTheme, etc.)
├── utils/            # Utilities (API calls, parsers)
└── data/             # Default data files
server.js             # Dev API server (ESM)
server.cjs            # Production server (CJS)
server/services/      # Backend services (AI, settings, installer)
```

## Reporting Issues

- Use [GitHub Issues](https://github.com/maverick-tr/lp-player/issues)
- Include your OS, Node.js version, and steps to reproduce
- Screenshots or terminal output are very helpful

## Code of Conduct

Be respectful, constructive, and inclusive. We're all here to build something useful.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
