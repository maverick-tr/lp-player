#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────
# LP Player — Local Build & Test Script
# ─────────────────────────────────────────────────────────────
# Usage:
#   ./build.sh                  # interactive menu
#   ./build.sh npm              # build npm package only
#   ./build.sh binary           # build binaries for current OS
#   ./build.sh binary-all       # build binaries for all platforms
#   ./build.sh docker           # build docker image
#   ./build.sh all              # build everything
#   ./build.sh clean            # remove all build artifacts
#   ./build.sh install-npm      # build + install npm package globally
#   ./build.sh install-binary   # build + install binary to /usr/local/bin
# ─────────────────────────────────────────────────────────────

VERSION=$(node -e "console.log(require('./package.json').version)")
BUILD_DIR="./build"
YELLOW='\033[1;33m'
GREEN='\033[1;32m'
RED='\033[1;31m'
CYAN='\033[1;36m'
DIM='\033[2m'
RESET='\033[0m'

banner() {
  echo ""
  echo -e "${YELLOW}  LP Player — Build Script${RESET}"
  echo -e "${DIM}  Version: ${VERSION}${RESET}"
  echo ""
}

info()    { echo -e "  ${CYAN}→${RESET} $1"; }
success() { echo -e "  ${GREEN}✓${RESET} $1"; }
error()   { echo -e "  ${RED}✗${RESET} $1"; }
divider() { echo -e "  ${DIM}─────────────────────────────────────${RESET}"; }

# ── Pre-flight ──────────────────────────────────────────────

ensure_deps() {
  if [ ! -d "node_modules" ]; then
    info "Installing dependencies..."
    npm install
  fi
}

ensure_build() {
  if [ ! -f "dist/index.html" ] || [ "$FORCE_BUILD" = "1" ]; then
    info "Building frontend..."
    npm run build
    success "Frontend built"
  else
    info "Frontend already built (use FORCE_BUILD=1 to rebuild)"
  fi
}

ensure_pkg() {
  if ! npx @yao-pkg/pkg --version &>/dev/null; then
    info "Installing @yao-pkg/pkg..."
    npm install --save-dev @yao-pkg/pkg
    success "@yao-pkg/pkg installed"
  fi
}

detect_platform() {
  local os arch
  case "$(uname -s)" in
    Darwin*) os="macos" ;;
    Linux*)  os="linux" ;;
    MINGW*|MSYS*|CYGWIN*) os="win" ;;
    *) os="unknown" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) arch="x64" ;;
  esac
  echo "${os}-${arch}"
}

# ── Build Functions ─────────────────────────────────────────

build_npm() {
  divider
  info "Building npm package..."
  ensure_deps
  ensure_build
  rm -f lp-player-*.tgz
  npm pack 2>&1 | tail -1
  local tgz=$(ls lp-player-*.tgz 2>/dev/null | head -1)
  if [ -n "$tgz" ]; then
    local size=$(du -h "$tgz" | cut -f1 | xargs)
    success "npm package: ${tgz} (${size})"
  else
    error "npm pack failed"
    return 1
  fi
}

build_binary() {
  local target=$1
  divider
  info "Building binary for ${target}..."
  ensure_deps
  ensure_build
  ensure_pkg
  mkdir -p "$BUILD_DIR"

  local outname="lp-player-${target}"
  if [[ "$target" == *"win"* ]]; then
    outname="${outname}.exe"
  fi

  npx @yao-pkg/pkg server.cjs \
    --target "node20-${target}" \
    --output "${BUILD_DIR}/${outname}" \
    --config package.json 2>&1 | while read -r line; do
      echo -e "    ${DIM}${line}${RESET}"
    done

  if [ -f "${BUILD_DIR}/${outname}" ]; then
    local size=$(du -h "${BUILD_DIR}/${outname}" | cut -f1 | xargs)
    success "Binary: ${BUILD_DIR}/${outname} (${size})"
  else
    error "Binary build failed for ${target}"
    return 1
  fi
}

build_binary_current() {
  local platform=$(detect_platform)
  info "Detected platform: ${platform}"
  build_binary "$platform"
}

build_binary_all() {
  local targets=("macos-arm64" "macos-x64" "linux-x64" "win-x64")
  info "Building binaries for all platforms..."
  for t in "${targets[@]}"; do
    build_binary "$t"
  done
  divider
  echo ""
  info "All binaries:"
  ls -lh "${BUILD_DIR}"/lp-player-* 2>/dev/null | while read -r line; do
    echo -e "    ${line}"
  done
}

build_docker() {
  divider
  info "Building Docker image..."
  if ! docker info &>/dev/null; then
    error "Docker daemon is not running"
    return 1
  fi
  docker build -t lp-player:${VERSION} -t lp-player:latest . 2>&1 | while read -r line; do
    echo -e "    ${DIM}${line}${RESET}"
  done
  success "Docker image: lp-player:${VERSION}"
  docker images lp-player --format "    {{.Repository}}:{{.Tag}}  {{.Size}}"
}

build_all() {
  info "Building everything..."
  build_npm
  build_binary_all
  build_docker
  divider
  echo ""
  success "All builds complete!"
}

# ── Install Functions ───────────────────────────────────────

install_npm() {
  build_npm
  divider
  local tgz=$(ls lp-player-*.tgz 2>/dev/null | head -1)
  info "Installing globally: ${tgz}..."
  npm install -g "./${tgz}" 2>&1 | tail -3
  local installed=$(which lp-player 2>/dev/null)
  if [ -n "$installed" ]; then
    success "Installed: ${installed}"
    lp-player --version
  else
    error "Install failed — lp-player not found in PATH"
    return 1
  fi
}

install_binary() {
  build_binary_current
  divider
  local platform=$(detect_platform)
  local outname="lp-player-${platform}"
  local src="${BUILD_DIR}/${outname}"

  if [ ! -f "$src" ]; then
    error "Binary not found: ${src}"
    return 1
  fi

  local dest="/usr/local/bin/lp-player"
  info "Installing to ${dest}..."
  if [ -w "/usr/local/bin" ]; then
    cp "$src" "$dest"
    chmod +x "$dest"
  else
    sudo cp "$src" "$dest"
    sudo chmod +x "$dest"
  fi
  success "Installed: ${dest}"
  lp-player --version
}

# ── Uninstall Functions ─────────────────────────────────────

uninstall_npm() {
  divider
  info "Uninstalling npm global package..."
  npm uninstall -g lp-player 2>&1 | tail -2
  success "npm package uninstalled"
}

uninstall_binary() {
  divider
  local dest="/usr/local/bin/lp-player"
  if [ -f "$dest" ]; then
    info "Removing ${dest}..."
    if [ -w "$dest" ]; then rm "$dest"; else sudo rm "$dest"; fi
    success "Binary removed"
  else
    info "No binary found at ${dest}"
  fi
}

uninstall_docker() {
  divider
  info "Removing Docker containers and images..."
  docker stop lp-player 2>/dev/null && docker rm lp-player 2>/dev/null
  docker rmi lp-player:${VERSION} lp-player:latest 2>/dev/null
  success "Docker cleanup done"
}

uninstall_data() {
  divider
  local data_dir=""
  case "$(uname -s)" in
    Darwin*) data_dir="$HOME/Library/Application Support/LP Player" ;;
    Linux*)  data_dir="${XDG_DATA_HOME:-$HOME/.local/share}/LP Player" ;;
    *)       data_dir="$HOME/.local/share/LP Player" ;;
  esac
  if [ -d "$data_dir" ]; then
    info "Removing data directory: ${data_dir}"
    rm -rf "$data_dir"
    success "Data directory removed"
  else
    info "No data directory found"
  fi
}

# ── Clean ───────────────────────────────────────────────────

clean() {
  divider
  info "Cleaning build artifacts..."
  rm -rf "$BUILD_DIR"
  rm -f lp-player-*.tgz
  success "Clean complete"
}

# ── Interactive Menu ────────────────────────────────────────

show_menu() {
  banner
  echo -e "  ${CYAN}Build${RESET}"
  echo "    1) npm package          (.tgz)"
  echo "    2) Binary (this OS)     (standalone executable)"
  echo "    3) Binaries (all OS)    (mac-arm64, mac-x64, linux-x64, win-x64)"
  echo "    4) Docker image"
  echo "    5) All of the above"
  echo ""
  echo -e "  ${CYAN}Install (local testing)${RESET}"
  echo "    6) Build + install npm globally"
  echo "    7) Build + install binary to /usr/local/bin"
  echo ""
  echo -e "  ${CYAN}Uninstall${RESET}"
  echo "    8) Uninstall npm global"
  echo "    9) Uninstall binary"
  echo "   10) Uninstall Docker"
  echo "   11) Remove user data directory"
  echo ""
  echo -e "  ${CYAN}Other${RESET}"
  echo "   12) Clean build artifacts"
  echo "    0) Exit"
  echo ""
  echo -n "  Choose (comma-separated for multiple, e.g. 1,2): "
}

run_choice() {
  case $1 in
    1)  build_npm ;;
    2)  build_binary_current ;;
    3)  build_binary_all ;;
    4)  build_docker ;;
    5)  build_all ;;
    6)  install_npm ;;
    7)  install_binary ;;
    8)  uninstall_npm ;;
    9)  uninstall_binary ;;
    10) uninstall_docker ;;
    11) uninstall_data ;;
    12) clean ;;
    0)  exit 0 ;;
    *)  error "Unknown option: $1" ;;
  esac
}

# ── CLI Argument Handling ───────────────────────────────────

if [ $# -gt 0 ]; then
  banner
  case "$1" in
    npm)            build_npm ;;
    binary)         build_binary_current ;;
    binary-all)     build_binary_all ;;
    docker)         build_docker ;;
    all)            build_all ;;
    install-npm)    install_npm ;;
    install-binary) install_binary ;;
    uninstall-npm)    uninstall_npm ;;
    uninstall-binary) uninstall_binary ;;
    uninstall-docker) uninstall_docker ;;
    uninstall-data)   uninstall_data ;;
    clean)          clean ;;
    *)
      echo "  Usage: ./build.sh [command]"
      echo ""
      echo "  Commands:"
      echo "    npm              Build npm .tgz package"
      echo "    binary           Build binary for current OS"
      echo "    binary-all       Build binaries for all platforms"
      echo "    docker           Build Docker image"
      echo "    all              Build everything"
      echo "    install-npm      Build + install npm globally"
      echo "    install-binary   Build + install binary to /usr/local/bin"
      echo "    uninstall-npm    Uninstall npm global package"
      echo "    uninstall-binary Remove binary from /usr/local/bin"
      echo "    uninstall-docker Remove Docker containers/images"
      echo "    uninstall-data   Remove user data directory"
      echo "    clean            Remove build artifacts"
      echo ""
      echo "  Run without arguments for interactive menu."
      ;;
  esac
  echo ""
  exit 0
fi

# ── Interactive Mode ────────────────────────────────────────

banner
show_menu
read -r choices

IFS=',' read -ra SELECTIONS <<< "$choices"
for choice in "${SELECTIONS[@]}"; do
  choice=$(echo "$choice" | xargs)  # trim whitespace
  run_choice "$choice"
done

echo ""
success "Done!"
echo ""
