#!/bin/bash

# ExpenseTracker PWA - One-Click Deployment Script
# This script helps deploy your PWA to various hosting services

echo "🚀 ExpenseTracker PWA Deployment"
echo "================================"

# Check if files exist
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found. Run this script from the expensTrack directory."
    exit 1
fi

echo "✅ Found ExpenseTracker files"

# Create a simple package.json for deployment
cat > package.json << 'EOF'
{
  "name": "expense-tracker-pwa",
  "version": "1.0.0",
  "description": "Mobile expense tracker with P2P sync",
  "main": "index.html",
  "scripts": {
    "start": "python3 -m http.server 8000",
    "deploy:netlify": "echo 'Deploy to Netlify: https://app.netlify.com/drop'",
    "deploy:vercel": "echo 'Deploy to Vercel: https://vercel.com/new'"
  },
  "keywords": ["pwa", "expenses", "mobile", "sync"],
  "author": "ExpenseTracker",
  "license": "MIT"
}
EOF

echo "✅ Created package.json"

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*

# Build outputs
dist/
build/

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
*.log

# Temporary files
*.tmp
*.temp
EOF

echo "✅ Created .gitignore"

# Initialize git if not already done
if [ ! -d ".git" ]; then
    git init
    git add .
    git commit -m "Initial ExpenseTracker PWA"
    echo "✅ Initialized git repository"
fi

echo ""
echo "🎯 Deployment Options:"
echo "======================"
echo ""
echo "1. 🌐 Netlify (Recommended - Free, HTTPS included):"
echo "   - Go to https://app.netlify.com/drop"
echo "   - Drag & drop the entire 'expensTrack' folder"
echo "   - Get your HTTPS URL instantly!"
echo ""
echo "2. ⚡ Vercel (Free, Fast):"
echo "   - Go to https://vercel.com/new"
echo "   - Upload this folder or connect GitHub"
echo ""
echo "3. 📄 GitHub Pages (Free):"
echo "   - Push to GitHub repository"
echo "   - Enable GitHub Pages in repo settings"
echo "   - URL: https://username.github.io/repository"
echo ""
echo "4. 🖥️  Local Testing:"
echo "   npm run start"
echo "   Open http://localhost:8000 (camera won't work)"
echo ""

echo "📱 Sharing Instructions:"
echo "======================="
echo "1. Deploy using one of the options above"
echo "2. Get the HTTPS URL (important for camera!)"
echo "3. Share URL with family/friends"
echo "4. Everyone opens URL on mobile browser"
echo "5. Tap 'Add to Home Screen' to install"
echo "6. Use the sync feature to connect devices"
echo ""

echo "🔧 Need Help?"
echo "=============="
echo "- Camera not working? Must be HTTPS"
echo "- Sync not connecting? Check device IDs"
echo "- App won't install? Use mobile Chrome/Safari"
echo ""

echo "🎉 Ready to share your ExpenseTracker PWA!"
