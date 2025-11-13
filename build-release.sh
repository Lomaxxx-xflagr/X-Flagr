#!/bin/bash

# Build script to create a clean release ZIP without screenshots

VERSION="1.0.1"
RELEASE_DIR="X-Flagr-v${VERSION}"
ZIP_FILE="X-Flagr-v${VERSION}.zip"

# Create release directory
mkdir -p "$RELEASE_DIR"

# Copy all files except screenshots and other excluded files
cp -r content.css content.js icons images manifest.json popup.css popup.html popup.js PRIVACY_POLICY.md privacy-policy.html README.md LICENSE .gitignore "$RELEASE_DIR/" 2>/dev/null

# Remove screenshots directory if it was copied
rm -rf "$RELEASE_DIR/screenshots"

# Create ZIP file
zip -r "$ZIP_FILE" "$RELEASE_DIR" -x "*.DS_Store" "*.git*"

# Clean up
rm -rf "$RELEASE_DIR"

echo "✅ Release ZIP created: $ZIP_FILE"
echo "📦 Size: $(du -h "$ZIP_FILE" | cut -f1)"
echo ""
echo "You can now upload this ZIP file to GitHub Releases as an asset."

