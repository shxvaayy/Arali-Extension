# Site-Specific Integration Guide

Agar aap extension ko kisi specific website ke saath integrate karna chahte hain, to yeh guide follow karein.

## 🎯 Approach 1: Content Script Mein Site Detection

### Step 1: Site Detect Karo

`content.js` mein site detection add karo:

```javascript
// Site detection
const currentSite = window.location.hostname;

if (currentSite.includes('example.com')) {
  // Site-specific logic
  integrateWithExampleSite();
} else if (currentSite.includes('meet.google.com')) {
  // Google Meet integration
  integrateWithGoogleMeet();
} else {
  // Default behavior
  injectRecordingButtons();
}
```

---

## 🎯 Approach 2: Site-Specific Selectors

### Example: Google Meet Integration

```javascript
// Google Meet ke liye specific selectors
function integrateWithGoogleMeet() {
  // Google Meet participants detect karo
  const participants = document.querySelectorAll('[data-participant-id]');
  
  participants.forEach(participant => {
    if (!participant.dataset.recordingButtonAdded) {
      addRecordingButtonToParticipant(participant);
      participant.dataset.recordingButtonAdded = 'true';
    }
  });
}
```

### Example: Zoom Integration

```javascript
// Zoom ke liye specific selectors
function integrateWithZoom() {
  // Zoom participants detect karo
  const participants = document.querySelectorAll('.participant-item, .video-container');
  
  participants.forEach(participant => {
    if (!participant.dataset.recordingButtonAdded) {
      addRecordingButtonToParticipant(participant);
      participant.dataset.recordingButtonAdded = 'true';
    }
  });
}
```

---

## 🎯 Approach 3: Custom Site Configuration

### Step 1: Site Config File Banao

`site-config.js` file banao:

```javascript
// site-config.js
export const SITE_CONFIGS = {
  'example.com': {
    selectors: {
      person: '[data-user-id]',
      container: '.user-list',
      name: '.user-name'
    },
    buttonPosition: 'top-right',
    customStyle: {
      backgroundColor: '#4CAF50',
      color: 'white'
    }
  },
  'meet.google.com': {
    selectors: {
      person: '[data-participant-id]',
      container: '[jsname]',
      name: '[data-self-name]'
    },
    buttonPosition: 'bottom-left',
    customStyle: {
      backgroundColor: '#1a73e8',
      color: 'white'
    }
  }
};
```

### Step 2: Content.js Mein Use Karo

```javascript
import { SITE_CONFIGS } from './site-config.js';

const currentSite = window.location.hostname;
const config = SITE_CONFIGS[currentSite];

if (config) {
  // Site-specific integration
  integrateWithSite(config);
} else {
  // Default behavior
  injectRecordingButtons();
}
```

---

## 🎯 Approach 4: API Integration (Agar Site Ka API Ho)

### Example: Site Ke API Se Data Le Kar

```javascript
async function integrateWithCustomSite() {
  // Site ka API call karo
  const response = await fetch('https://example.com/api/users');
  const users = await response.json();
  
  // Users par recording buttons add karo
  users.forEach(user => {
    const element = document.querySelector(`[data-user-id="${user.id}"]`);
    if (element) {
      addRecordingButton(element, user);
    }
  });
}
```

---

## 📝 Complete Example: Custom Site Integration

### content.js (Updated Version)

```javascript
// Site-specific integration
const SITE_INTEGRATIONS = {
  // Google Meet
  'meet.google.com': {
    selectors: {
      person: '[data-participant-id]',
      name: '[data-self-name]'
    },
    onPersonClick: (element) => {
      // Google Meet specific logic
      console.log('Recording Google Meet participant');
    }
  },
  
  // Zoom
  'zoom.us': {
    selectors: {
      person: '.participant-item',
      name: '.participant-name'
    },
    onPersonClick: (element) => {
      // Zoom specific logic
      console.log('Recording Zoom participant');
    }
  },
  
  // Custom Site (Example)
  'example.com': {
    selectors: {
      person: '.user-card, .contact-item',
      name: '.user-name, .contact-name'
    },
    onPersonClick: (element) => {
      // Custom site logic
      console.log('Recording custom site user');
    }
  }
};

// Current site detect karo
function getCurrentSiteConfig() {
  const hostname = window.location.hostname;
  
  // Exact match check karo
  for (const [site, config] of Object.entries(SITE_INTEGRATIONS)) {
    if (hostname.includes(site)) {
      return config;
    }
  }
  
  return null; // Default behavior
}

// Site-specific integration
function integrateWithSite(config) {
  const { selectors, onPersonClick } = config;
  
  // Site ke specific selectors use karo
  const personElements = document.querySelectorAll(selectors.person);
  
  personElements.forEach(element => {
    if (!element.dataset.recordingButtonAdded) {
      const button = createRecordingButton(element, onPersonClick);
      element.appendChild(button);
      element.dataset.recordingButtonAdded = 'true';
    }
  });
}

// Recording button create karo
function createRecordingButton(element, onClickHandler) {
  const button = document.createElement('button');
  button.className = 'meeting-recorder-btn';
  button.innerHTML = '🎥 Record';
  
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    onClickHandler(element);
    startRecording();
  });
  
  return button;
}

// Initialize
const siteConfig = getCurrentSiteConfig();
if (siteConfig) {
  integrateWithSite(siteConfig);
  
  // Dynamic content ke liye observer
  const observer = new MutationObserver(() => {
    integrateWithSite(siteConfig);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
} else {
  // Default behavior
  injectRecordingButtons();
}
```

---

## 🔧 Manifest.json Mein Site-Specific Permissions

Agar specific site ke liye permissions chahiye:

```json
{
  "host_permissions": [
    "https://example.com/*",
    "https://*.example.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://example.com/*",
        "https://*.example.com/*"
      ],
      "js": ["content.js"],
      "css": ["content.css"]
    }
  ]
}
```

---

## 🎨 Site-Specific Styling

### content.css (Updated)

```css
/* Default styles */
.meeting-recorder-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* ... */
}

/* Google Meet specific */
meet.google.com .meeting-recorder-btn {
  background: #1a73e8;
}

/* Zoom specific */
zoom.us .meeting-recorder-btn {
  background: #2d8cff;
}

/* Custom site specific */
example.com .meeting-recorder-btn {
  background: #4CAF50;
}
```

---

## 📋 Step-by-Step: Kisi Site Ke Saath Integrate Karne Ke Liye

### Step 1: Site Inspect Karo
1. Browser DevTools kholo (F12)
2. Elements tab mein jao
3. Person/contact elements ka selector find karo
4. Classes, IDs, data attributes note karo

### Step 2: Selectors Define Karo
```javascript
const selectors = {
  person: '.user-card',        // Person element
  container: '.user-list',     // Container
  name: '.user-name'           // Name element
};
```

### Step 3: Integration Function Banao
```javascript
function integrateWithYourSite() {
  const persons = document.querySelectorAll(selectors.person);
  
  persons.forEach(person => {
    addRecordingButton(person);
  });
}
```

### Step 4: Content.js Mein Add Karo
```javascript
if (window.location.hostname.includes('yoursite.com')) {
  integrateWithYourSite();
}
```

### Step 5: Test Karo
- Site par jao
- Extension load karo
- Buttons dikhne chahiye

---

## 💡 Tips

1. **Dynamic Content:** MutationObserver use karo agar content dynamically load hota hai
2. **Multiple Sites:** Object mein multiple sites handle karo
3. **Fallback:** Default behavior hamesha rakho
4. **Testing:** Har site par properly test karo

---

## 🚀 Quick Integration Template

```javascript
// content.js mein yeh add karo
const YOUR_SITE_CONFIG = {
  hostname: 'yoursite.com',
  selectors: {
    person: '.your-person-selector',
    name: '.your-name-selector'
  }
};

if (window.location.hostname.includes(YOUR_SITE_CONFIG.hostname)) {
  // Integration logic
  const persons = document.querySelectorAll(YOUR_SITE_CONFIG.selectors.person);
  persons.forEach(person => {
    addRecordingButton(person);
  });
}
```

---

Yeh sab kuch site-specific integration ke liye hai. Kisi specific site ke liye code chahiye ho to batao!




