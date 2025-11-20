# Meeting Recorder Chrome Extension

Ek Chrome extension jo meeting recording ke liye banaya gaya hai. Is extension se aap kisi bhi website par person/contact par click karke meeting record kar sakte hain.

## 📁 File Structure

```
chrome-extension/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker (recording logic)
├── content.js            # Content script (page par inject hota hai)
├── content.css           # Content script styles
├── popup.html            # Extension popup UI
├── popup.css             # Popup styles
├── popup.js              # Popup functionality
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # Documentation
```

## 🚀 Installation (Development)

1. **Chrome Extension Load Karne Ke Liye:**
   - Chrome browser kholo
   - `chrome://extensions/` par jao
   - Top right corner par "Developer mode" enable karo
   - "Load unpacked" button click karo
   - `chrome-extension` folder select karo

2. **Extension Use Karne Ke Liye:**
   - Kisi bhi website par jao
   - Extension icon par click karo (toolbar mein)
   - "Start Recording" button click karo
   - Screen share dialog aayega - screen/window select karo
   - Recording start ho jayegi!

## 📦 Google Chrome Web Store Par Publish Karne Ke Liye

### Step 1: Extension Prepare Karo

1. **Icons Create Karo:**
   - 16x16px (icon16.png)
   - 48x48px (icon48.png)
   - 128x128px (icon128.png)
   - Icons `icons/` folder mein rakhna hai

2. **Screenshots:**
   - Extension ki screenshots ready karo (1280x800 ya 640x400)
   - Minimum 1 screenshot required

3. **Promotional Images (Optional):**
   - Small tile: 440x280px
   - Large tile: 920x680px
   - Marquee: 1400x560px

### Step 2: ZIP File Banao

```bash
cd chrome-extension
zip -r meeting-recorder-extension.zip . -x "*.git*" -x "README.md"
```

Ya manually:
- `chrome-extension` folder ko ZIP karo
- `.git`, `README.md` exclude karo

### Step 3: Chrome Web Store Developer Account

1. **Chrome Web Store Developer Account Banao:**
   - https://chrome.google.com/webstore/devconsole/ par jao
   - Google account se login karo
   - One-time payment: $5 USD (lifetime)
   - Payment complete karo

2. **New Item Create Karo:**
   - "New Item" button click karo
   - ZIP file upload karo
   - Fill karo:
     - **Name:** Meeting Recorder
     - **Summary:** Record meetings with one click
     - **Description:** 
       ```
       Meeting Recorder is a powerful Chrome extension that allows you to record meetings instantly with just one click. 
       
       Features:
       - One-click recording
       - Screen and audio capture
       - Easy download of recordings
       - Works on all websites
       
       How to use:
       1. Click the extension icon
       2. Click "Start Recording"
       3. Select screen/window to record
       4. Click "Stop Recording" when done
       5. Download your recording
       ```
     - **Category:** Productivity
     - **Language:** English (or Hindi)
     - **Privacy Policy URL:** (apni website ka privacy policy URL)

3. **Store Listing:**
   - Screenshots upload karo
   - Promotional images (optional)
   - Detailed description
   - Support website (agar hai)

4. **Pricing & Distribution:**
   - Free select karo
   - Countries select karo (sab countries)
   - Visibility: Public

5. **Privacy Practices:**
   - Data collection details fill karo
   - Single purpose use case: "Recording meetings"

### Step 4: Submit for Review

1. "Submit for Review" button click karo
2. Review process: 1-3 business days
3. Approval ke baad extension live ho jayega!

## 🔧 Permissions Explained

- `tabs`: Current tab access
- `activeTab`: Active tab permissions
- `storage`: Save recording data
- `desktopCapture`: Screen recording
- `tabCapture`: Tab audio capture
- `<all_urls>`: All websites par kaam kare

## 📝 Important Notes

1. **Privacy Policy Required:**
   - Chrome Web Store par privacy policy URL mandatory hai
   - Agar nahi hai, to ek simple privacy policy page banao

2. **Permissions:**
   - Users ko permissions allow karni padegi
   - Desktop capture permission sensitive hai

3. **Testing:**
   - Submit karne se pehle properly test karo
   - Different websites par test karo
   - Screen recording test karo

4. **Updates:**
   - Version number update karo `manifest.json` mein
   - New ZIP upload karo
   - "Submit for Update" click karo

## 🐛 Troubleshooting

**Recording start nahi ho rahi:**
- Check karo ki permissions allow ki hain
- Browser refresh karo
- Extension reload karo

**Download nahi ho raha:**
- Check Chrome downloads folder
- Browser settings mein download location check karo

## 📞 Support

Agar koi issue ho to:
1. Extension reload karo
2. Browser restart karo
3. Permissions check karo

---

**Note:** Extension publish karne se pehle properly test karna zaroori hai. Google review process strict hai, isliye sab kuch sahi se fill karo.




