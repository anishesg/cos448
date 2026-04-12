#!/bin/bash
# Launch dashboard and check for errors

echo "=== Testing Dashboard Launch ==="
echo ""

cd "/Users/anish/Desktop/Lattice Research/fb_outreach/dashboard"

echo "1. Checking files..."
if [ ! -f "main.js" ]; then
  echo "✗ main.js not found"
  exit 1
fi
if [ ! -f "preload.js" ]; then
  echo "✗ preload.js not found"
  exit 1
fi
if [ ! -f "renderer/index.html" ]; then
  echo "✗ renderer/index.html not found"
  exit 1
fi
echo "✓ All required files present"
echo ""

echo "2. Checking node_modules..."
if [ ! -d "node_modules/electron" ]; then
  echo "✗ Electron not installed"
  echo "  Run: npm install"
  exit 1
fi
if [ ! -d "node_modules/better-sqlite3" ]; then
  echo "✗ better-sqlite3 not installed"
  echo "  Run: npm install"
  exit 1
fi
echo "✓ Dependencies installed"
echo ""

echo "3. Checking database..."
DB_PATH="../pipeline/pipeline.db"
if [ ! -f "$DB_PATH" ]; then
  echo "✗ Database not found at $DB_PATH"
  echo "  Run: cd ../pipeline && node -e \"import('./db.js').then(m => m.getDb())\""
  exit 1
fi
echo "✓ Database exists"
echo ""

echo "4. Testing syntax..."
node -c main.js 2>&1 | grep -v "Warning" || echo "✓ main.js syntax OK"
node -c preload.js 2>&1 | grep -v "Warning" || echo "✓ preload.js syntax OK"
echo ""

echo "5. Launching app..."
echo "   (App will open in a window)"
echo "   Check the window for any errors"
echo "   Close the window when done testing"
echo ""

# Launch with console output
ELECTRON_ENABLE_LOGGING=1 npm start 2>&1 | head -50
