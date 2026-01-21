# ExpenseTracker PWA

A comprehensive mobile expense management app with camera capture, local storage, and P2P sync capabilities.

## 🚀 Quick Start

### Option 1: Local Testing (Limited - No Camera)
```bash
cd expensTrack
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

**Note:** Camera won't work with HTTP - deploy to HTTPS for full functionality.

### Option 2: Deploy to Netlify (Recommended)
1. **Create GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # Push to GitHub
   ```

2. **Deploy to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Connect your GitHub repo
   - Deploy (takes ~1 minute)

3. **Share the URL**
   - Netlify gives you a `https://random-name.netlify.app` URL
   - Share this URL with others

### Option 3: Other Free Hosting
- **Vercel**: Similar to Netlify, drag & drop files or connect Git
- **GitHub Pages**: Free static hosting from GitHub repos
- **Surge**: `npm install -g surge` then `surge .`

## 📱 How Users Install & Use

### Installation
1. **Open in Mobile Browser**
   - Chrome, Safari, or Edge on mobile
   - Navigate to your deployed URL

2. **Add to Home Screen**
   - Tap the share/menu button
   - Select "Add to Home Screen"
   - Name it "ExpenseTracker"
   - Tap "Add"

3. **Launch Like a Native App**
   - Find the icon on home screen
   - Tap to open (works offline!)

### Basic Usage
1. **Add People**
   - Open app → Tap "People"
   - Tap "Add Person" → Enter names
   - Default "Me" is already there

2. **Track Expenses**
   - Tap the "+" button
   - Fill details + optional receipt photo
   - Select who paid from dropdown

3. **Sync with Family/Friends**
   - Tap "Sync" tab
   - Copy your Device ID
   - Share ID with others (text/email)
   - They enter your ID to connect
   - Data syncs automatically!

### Camera Features (HTTPS Required)
- **Take Photo**: Tap camera button when adding expense
- **Choose from Gallery**: Select existing photos
- **View Receipts**: Tap thumbnails to see full size
- **Storage**: Photos saved locally (no cloud!)

## 🔄 P2P Sync Setup

### For 2+ People
1. **Person A**: Opens sync tab, copies Device ID
2. **Person B**: Opens same app, goes to sync tab
3. **Person B**: Pastes Person A's ID and clicks "Connect"
4. **Done**: Green badge shows connected devices

### What Syncs
- ✅ New expenses (with photos!)
- ✅ People added/removed
- ✅ Deleted expenses
- ✅ All data stays on devices (no server)

## 📋 Sharing Checklist

- [ ] Deploy to HTTPS hosting (Netlify/Vercel)
- [ ] Test camera works on mobile
- [ ] Share the HTTPS URL with group
- [ ] Have everyone install to home screen
- [ ] Start adding people and expenses
- [ ] Connect devices via sync feature

## 🛠️ Troubleshooting

### Camera Not Working
- Must be HTTPS (not HTTP)
- Grant camera permission when prompted
- Try refreshing the page

### Sync Not Connecting
- Both devices need internet initially
- Check Device IDs are entered correctly
- Try refreshing both apps

### App Won't Install
- Use Chrome/Safari/Edge on mobile
- Make sure it's HTTPS
- Check PWA manifest is loading

## 🎯 Key Benefits

- **No App Store**: Install directly from browser
- **Works Offline**: Add expenses without internet
- **Private**: All data stays on devices
- **Cross-Platform**: iOS, Android, any modern browser
- **Free**: No hosting costs for basic use
- **Real-time Sync**: Share expenses instantly with family

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Try refreshing the page
3. Clear browser cache
4. Reinstall PWA if needed

The app is completely self-contained - no backend server required!
