# Chrome Extension Setup Guide (Hindi)

## 📋 Complete File Structure

```
chrome-extension/
├── manifest.json          # Extension ka configuration file (MOST IMPORTANT)
├── background.js          # Background service worker - recording logic yahan hai
├── content.js            # Content script - web pages par inject hota hai
├── content.css           # Content script ki styling
├── popup.html            # Extension popup ka HTML
├── popup.css             # Popup ki styling
├── popup.js              # Popup ki functionality
├── icons/                # Extension icons
│   ├── icon16.png        # 16x16px (toolbar)
│   ├── icon48.png        # 48x48px (management page)
│   └── icon128.png       # 128x128px (Chrome Store)
├── README.md             # Documentation
├── SETUP_GUIDE.md        # Ye file
└── .gitignore            # Git ignore file
```

## 🎯 Kya Kya Files Hain Aur Unka Kaam:

### 1. **manifest.json** (Sabse Important!)
- Extension ka configuration file
- Permissions define karta hai
- Extension ka naam, version, description yahan hai
- Chrome ko batata hai ki kaunse files use karni hain

### 2. **background.js**
- Background service worker
- Recording logic yahan hai
- Screen capture handle karta hai
- MediaRecorder API use karta hai
- Recording start/stop handle karta hai

### 3. **content.js**
- Web pages par inject hota hai
- Person/contact elements par recording button add karta hai
- User interactions handle karta hai
- Notifications show karta hai

### 4. **content.css**
- Content script ki styling
- Recording button ki design
- Notifications ki styling

### 5. **popup.html**
- Extension icon click karne par jo popup dikhta hai
- UI ka structure yahan hai

### 6. **popup.css**
- Popup ki styling
- Buttons, status indicators ki design

### 7. **popup.js**
- Popup ki functionality
- Start/Stop recording buttons
- Status updates
- Duration timer

## 🚀 Kaise Use Karein (Development):

### Step 1: Icons Add Karo
1. `icons/` folder mein 3 icons add karo:
   - icon16.png (16x16px)
   - icon48.png (48x48px)
   - icon128.png (128x128px)

2. Agar icons nahi hain, to:
   - Koi bhi simple PNG images use kar sakte hain temporarily
   - Baad mein proper icons replace kar dena

### Step 2: Chrome Extension Load Karo
1. Chrome browser kholo
2. Address bar mein type karo: `chrome://extensions/`
3. Top right corner par **"Developer mode"** toggle ON karo
4. **"Load unpacked"** button click karo
5. `chrome-extension` folder select karo
6. Extension load ho jayega!

### Step 3: Test Karo
1. Kisi bhi website par jao (e.g., Google Meet, Zoom, etc.)
2. Extension icon par click karo (toolbar mein)
3. "Start Recording" button click karo
4. Screen share dialog aayega
5. Screen/window select karo
6. Recording start ho jayegi!

## 📦 Chrome Web Store Par Publish Karne Ke Steps:

### Step 1: Extension Prepare Karo

1. **Icons Ready Karo:**
   - 16x16, 48x48, 128x128 pixels
   - PNG format
   - High quality

2. **Screenshots Banao:**
   - Extension ki screenshots (1280x800 ya 640x400)
   - Minimum 1 screenshot required
   - Extension use karte hue dikhao

3. **ZIP File Banao:**
   ```bash
   cd chrome-extension
   zip -r meeting-recorder.zip . -x "*.git*" -x "README.md" -x "SETUP_GUIDE.md"
   ```

### Step 2: Chrome Web Store Developer Account

1. **Account Banao:**
   - https://chrome.google.com/webstore/devconsole/ par jao
   - Google account se login karo
   - One-time payment: **$5 USD** (lifetime)
   - Payment complete karo

2. **New Item Create Karo:**
   - "New Item" button click karo
   - ZIP file upload karo
   - Form fill karo:
     - **Name:** Meeting Recorder
     - **Summary:** Record meetings with one click
     - **Description:** Detailed description
     - **Category:** Productivity
     - **Language:** English
     - **Privacy Policy URL:** (apni website ka URL)

3. **Store Listing:**
   - Screenshots upload karo
   - Detailed description
   - Support website (agar hai)

4. **Pricing:**
   - Free select karo
   - All countries select karo

5. **Submit for Review:**
   - "Submit for Review" click karo
   - Review: 1-3 business days
   - Approval ke baad live!

## ⚠️ Important Points:

1. **Privacy Policy:**
   - Chrome Web Store par privacy policy URL **mandatory** hai
   - Agar nahi hai, to ek simple page banao

2. **Permissions:**
   - Desktop capture permission sensitive hai
   - Users ko explain karna padega kyun chahiye

3. **Testing:**
   - Submit karne se pehle properly test karo
   - Different websites par try karo

4. **Version Updates:**
   - `manifest.json` mein version number update karo
   - New ZIP upload karo
   - "Submit for Update" click karo

## 🔧 Common Issues:

**Extension load nahi ho raha:**
- Check karo ki `manifest.json` sahi hai
- Icons files exist karti hain
- Console mein errors check karo

**Recording start nahi ho rahi:**
- Permissions allow ki hain?
- Browser refresh karo
- Extension reload karo

**Download nahi ho raha:**
- Chrome downloads folder check karo
- Browser settings check karo

## 📝 Next Steps:

1. Icons add karo
2. Extension test karo
3. Screenshots banao
4. ZIP file banao
5. Chrome Web Store par submit karo

---

**Note:** Sab kuch properly test karna zaroori hai before publishing!

