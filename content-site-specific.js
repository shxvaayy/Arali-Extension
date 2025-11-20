// Site-Specific Content Script Example
// Yeh file dikhata hai ki kaise different sites ke saath integrate karein

// ============================================
// SITE CONFIGURATIONS
// ============================================

const SITE_CONFIGS = {
  // Google Meet
  'meet.google.com': {
    selectors: {
      person: '[data-participant-id]',
      container: '[jsname="BOHaEe"]',
      name: '[data-self-name]'
    },
    buttonPosition: 'top-right',
    customClass: 'meet-recorder-btn'
  },

  // Zoom
  'zoom.us': {
    selectors: {
      person: '.participant-item, .video-container',
      container: '.participants-wrap',
      name: '.participant-name'
    },
    buttonPosition: 'bottom-left',
    customClass: 'zoom-recorder-btn'
  },

  // Microsoft Teams
  'teams.microsoft.com': {
    selectors: {
      person: '[data-tid="roster-participant"]',
      container: '[data-tid="roster-list"]',
      name: '[data-tid="participant-name"]'
    },
    buttonPosition: 'top-right',
    customClass: 'teams-recorder-btn'
  },

  // Custom Site Example
  'example.com': {
    selectors: {
      person: '.user-card, .contact-item, [data-user-id]',
      container: '.user-list, .contacts-list',
      name: '.user-name, .contact-name'
    },
    buttonPosition: 'top-right',
    customClass: 'custom-recorder-btn'
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Current site detect karo
function getCurrentSiteConfig() {
  const hostname = window.location.hostname;
  
  // Check karo ki koi site match karta hai
  for (const [site, config] of Object.entries(SITE_CONFIGS)) {
    if (hostname.includes(site)) {
      return { site, ...config };
    }
  }
  
  return null;
}

// Recording button create karo (site-specific)
function createSiteSpecificButton(element, config, personData = {}) {
  const button = document.createElement('button');
  button.className = `meeting-recorder-btn ${config.customClass || ''}`;
  button.innerHTML = '🎥 Record';
  button.title = `Record meeting with ${personData.name || 'this person'}`;
  
  // Site-specific styling
  if (config.buttonPosition === 'top-right') {
    button.style.position = 'absolute';
    button.style.top = '5px';
    button.style.right = '5px';
  } else if (config.buttonPosition === 'bottom-left') {
    button.style.position = 'absolute';
    button.style.bottom = '5px';
    button.style.left = '5px';
  }
  
  // Click handler
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Site-specific action (agar chahiye)
    if (config.onPersonClick) {
      config.onPersonClick(element, personData);
    }
    
    // Recording start karo
    startRecording();
  });
  
  return button;
}

// Person data extract karo (name, ID, etc.)
function extractPersonData(element, config) {
  const data = {};
  
  if (config.selectors.name) {
    const nameEl = element.querySelector(config.selectors.name);
    if (nameEl) {
      data.name = nameEl.textContent.trim();
    }
  }
  
  // Data attributes se info le lo
  data.id = element.dataset.userId || 
            element.dataset.participantId || 
            element.dataset.contactId ||
            element.id;
  
  return data;
}

// ============================================
// SITE-SPECIFIC INTEGRATION
// ============================================

function integrateWithSite(config) {
  const { selectors } = config;
  
  // Person elements find karo
  const personElements = document.querySelectorAll(selectors.person);
  
  personElements.forEach(element => {
    // Check karo ki button already added hai ya nahi
    if (element.dataset.recordingButtonAdded === 'true') {
      return;
    }
    
    // Person data extract karo
    const personData = extractPersonData(element, config);
    
    // Button create karo
    const button = createSiteSpecificButton(element, config, personData);
    
    // Element ko relative position do (agar nahi hai)
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.position === 'static') {
      element.style.position = 'relative';
    }
    
    // Button add karo
    element.appendChild(button);
    
    // Mark karo ki button added hai
    element.dataset.recordingButtonAdded = 'true';
  });
}

// ============================================
// INITIALIZATION
// ============================================

function initializeSiteIntegration() {
  const siteConfig = getCurrentSiteConfig();
  
  if (siteConfig) {
    console.log(`🎯 Integrating with ${siteConfig.site}`);
    
    // Initial integration
    integrateWithSite(siteConfig);
    
    // Dynamic content ke liye observer
    const observer = new MutationObserver(() => {
      integrateWithSite(siteConfig);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Specific container observe karo (agar hai)
    if (siteConfig.selectors.container) {
      const container = document.querySelector(siteConfig.selectors.container);
      if (container) {
        observer.observe(container, {
          childList: true,
          subtree: true
        });
      }
    }
    
  } else {
    console.log('📌 No specific site config found, using default behavior');
    // Default behavior (original injectRecordingButtons function)
    injectRecordingButtons();
  }
}

// ============================================
// RECORDING FUNCTIONS (Same as before)
// ============================================

function startRecording() {
  chrome.runtime.sendMessage({ action: 'startRecording' }, (response) => {
    if (response && response.success) {
      showNotification('Recording started!', 'success');
      updateRecordingUI(true);
    } else {
      showNotification(response?.error || 'Failed to start recording', 'error');
    }
  });
}

function stopRecording() {
  chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
    if (response && response.success) {
      showNotification('Recording stopped!', 'success');
      updateRecordingUI(false);
    } else {
      showNotification(response?.error || 'Failed to stop recording', 'error');
    }
  });
}

function updateRecordingUI(isRecording) {
  const buttons = document.querySelectorAll('.meeting-recorder-btn');
  buttons.forEach(btn => {
    if (isRecording) {
      btn.innerHTML = '⏹️ Stop';
      btn.classList.add('recording');
      btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        stopRecording();
      };
    } else {
      btn.innerHTML = '🎥 Record';
      btn.classList.remove('recording');
      btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        startRecording();
      };
    }
  });
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `meeting-recorder-notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    padding: 15px 20px;
    border-radius: 5px;
    z-index: 10001;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    font-family: Arial, sans-serif;
    font-size: 14px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Default behavior (agar site-specific config nahi mila)
function injectRecordingButtons() {
  const personSelectors = [
    '[data-person]',
    '[data-contact]',
    '[data-user]',
    '.person',
    '.contact',
    '.user',
    '.participant',
    '.attendee'
  ];

  personSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      if (!element.dataset.recordingButtonAdded) {
        const button = document.createElement('button');
        button.className = 'meeting-recorder-btn';
        button.innerHTML = '🎥 Record';
        button.title = 'Click to record meeting';
        
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          startRecording();
        });

        const rect = element.getBoundingClientRect();
        button.style.position = 'absolute';
        button.style.top = `${rect.top + window.scrollY}px`;
        button.style.left = `${rect.right + window.scrollX + 10}px`;
        button.style.zIndex = '10000';
        
        document.body.appendChild(button);
        element.dataset.recordingButtonAdded = 'true';
      }
    });
  });
}

// ============================================
// MESSAGE LISTENERS
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'recordingStarted') {
    updateRecordingUI(true);
  } else if (request.action === 'recordingStopped') {
    updateRecordingUI(false);
    if (request.blobUrl) {
      showDownloadPrompt(request.blobUrl);
    }
  }
});

function showDownloadPrompt(blobUrl) {
  const prompt = document.createElement('div');
  prompt.className = 'meeting-recorder-download';
  prompt.innerHTML = `
    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 400px;">
      <h3 style="margin: 0 0 10px 0; color: #333;">Recording Complete!</h3>
      <p style="margin: 0 0 15px 0; color: #666;">Your meeting recording is ready to download.</p>
      <button id="download-btn" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">Download</button>
      <button id="close-btn" style="background: #ccc; color: #333; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Close</button>
    </div>
  `;
  prompt.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10002;
  `;
  
  document.body.appendChild(prompt);
  
  document.getElementById('download-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'downloadRecording', blobUrl });
    prompt.remove();
  });
  
  document.getElementById('close-btn').addEventListener('click', () => {
    prompt.remove();
  });
}

// ============================================
// START
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeSiteIntegration, 1000);
  });
} else {
  setTimeout(initializeSiteIntegration, 1000);
}




