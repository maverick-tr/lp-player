#!/bin/bash
set -e

# LP Player — Quick Install Script
# Usage: curl -fsSL https://raw.githubusercontent.com/maverick-tr/lp-player/release/install.sh | bash

REPO="maverick-tr/lp-player"
NAME="lp-player"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

info()    { echo -e "  ${YELLOW}→${RESET} $1"; }
success() { echo -e "  ${GREEN}✓${RESET} $1"; }
error()   { echo -e "  ${RED}✗${RESET} $1"; exit 1; }

# Detect OS and architecture
detect_platform() {
  local os arch
  case "$(uname -s)" in
    Darwin*) os="macos" ;;
    Linux*)  os="linux" ;;
    *)       error "Unsupported OS: $(uname -s). Use npm instead: npm install -g lp-player" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64)   arch="x64" ;;
    arm64|aarch64)   arch="arm64" ;;
    *)               error "Unsupported architecture: $(uname -m)" ;;
  esac
  echo "${os}-${arch}"
}

# Determine download URL
get_download_url() {
  local platform="$1"
  local base="https://github.com/${REPO}/releases/latest/download"

  case "$platform" in
    macos-arm64) echo "${base}/lp-player-macos-arm64" ;;
    macos-x64)   echo "${base}/lp-player-macos-x64" ;;
    linux-x64)   echo "${base}/lp-player-linux-x64" ;;
    linux-arm64)  echo "${base}/lp-player-linux-arm64" ;;
    *)            error "No binary available for ${platform}" ;;
  esac
}

# Determine install directory
get_install_dir() {
  if [ -w "/usr/local/bin" ]; then
    echo "/usr/local/bin"
  elif [ -d "$HOME/.local/bin" ]; then
    echo "$HOME/.local/bin"
  else
    mkdir -p "$HOME/.local/bin"
    echo "$HOME/.local/bin"
  fi
}

# Main
echo ""
echo -e "  ${YELLOW}LP Player — Installer${RESET}"
echo ""

PLATFORM=$(detect_platform)
info "Detected platform: ${PLATFORM}"

URL=$(get_download_url "$PLATFORM")
INSTALL_DIR=$(get_install_dir)
DEST="${INSTALL_DIR}/${NAME}"

info "Downloading from GitHub Releases..."
if command -v curl &>/dev/null; then
  curl -fsSL "$URL" -o "$DEST"
elif command -v wget &>/dev/null; then
  wget -qO "$DEST" "$URL"
else
  error "Neither curl nor wget found. Install one and try again."
fi

chmod +x "$DEST"
success "Installed to ${DEST}"

# Check if install dir is in PATH
if ! echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
  echo ""
  echo -e "  ${YELLOW}Note:${RESET} ${INSTALL_DIR} is not in your PATH."
  echo -e "  Add it to your shell profile:"
  echo -e "    ${DIM}export PATH=\"${INSTALL_DIR}:\$PATH\"${RESET}"
  echo ""
fi

echo ""
success "LP Player installed! Run with: ${NAME}"
echo ""
