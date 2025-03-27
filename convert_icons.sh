#!/bin/zsh

# Check if a file path was provided as an argument
if [ "$1" != "" ]; then
  SOURCE_LOGO="$1"
else
  SOURCE_LOGO="local_project_player_logo.png"
fi

echo "📀 Converting LAP (Local App Player) logo from $SOURCE_LOGO..."

# Make sure the public/icons directory exists
mkdir -p public/icons

# Verify the source file exists
if [ ! -f "$SOURCE_LOGO" ]; then
  echo "⚠️ Error: Source logo file $SOURCE_LOGO not found!"
  echo ""
  echo "Usage: ./convert_icons.sh [path_to_logo_file]"
  echo ""
  echo "Examples:"
  echo "  ./convert_icons.sh images/my_logo.png"
  echo "  ./convert_icons.sh /path/to/your/logo.png"
  echo ""
  echo "The logo file should be a PNG or JPG image in a square format."
  exit 1
fi

# Create app icons in various sizes
echo "🖼️ Creating app icons..."
convert "$SOURCE_LOGO" -resize 512x512 public/icons/icon-512x512.png
convert "$SOURCE_LOGO" -resize 384x384 public/icons/icon-384x384.png
convert "$SOURCE_LOGO" -resize 256x256 public/icons/icon-256x256.png
convert "$SOURCE_LOGO" -resize 192x192 public/icons/icon-192x192.png
convert "$SOURCE_LOGO" -resize 152x152 public/icons/icon-152x152.png
convert "$SOURCE_LOGO" -resize 144x144 public/icons/icon-144x144.png
convert "$SOURCE_LOGO" -resize 128x128 public/icons/icon-128x128.png

# Create standard logos for the app
echo "🖼️ Creating standard logos..."
convert "$SOURCE_LOGO" -resize 512x512 public/logo.png
cp public/logo.png public/logo-light.png

# Create dark mode logo (invert colors for dark mode)
echo "🌙 Creating dark mode logos..."
convert "$SOURCE_LOGO" -negate -resize 512x512 public/logo-dark.png
convert "$SOURCE_LOGO" -negate -resize 512x512 public/icons/icon-dark-512x512.png
convert "$SOURCE_LOGO" -negate -resize 384x384 public/icons/icon-dark-384x384.png
convert "$SOURCE_LOGO" -negate -resize 256x256 public/icons/icon-dark-256x256.png
convert "$SOURCE_LOGO" -negate -resize 192x192 public/icons/icon-dark-192x192.png
convert "$SOURCE_LOGO" -negate -resize 152x152 public/icons/icon-dark-152x152.png
convert "$SOURCE_LOGO" -negate -resize 144x144 public/icons/icon-dark-144x144.png
convert "$SOURCE_LOGO" -negate -resize 128x128 public/icons/icon-dark-128x128.png

# Create splash screens
echo "💦 Creating splash screens..."
convert "$SOURCE_LOGO" -resize 200x200 public/splash-screen.png
convert "$SOURCE_LOGO" -negate -resize 200x200 public/splash-screen-dark.png

# Create favicon.ico (with multiple sizes)
echo "🔖 Creating favicon.ico..."
convert "$SOURCE_LOGO" -resize 64x64 public/favicon.png
convert "$SOURCE_LOGO" -define icon:auto-resize=16,32,48,64 public/favicon.ico

# Create an app icon file (standard on many platforms)
echo "📱 Creating app icon..."
convert "$SOURCE_LOGO" -resize 512x512 public/app-icon.png

echo "✅ Conversion complete! All logo formats have been created in the public folder."
echo "   The logo has been prepared for header, favicon, and web app usage." 