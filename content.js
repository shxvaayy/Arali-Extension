// Content Script - Runs on web pages to add recording functionality

// Inject recording button on person/contact elements
function injectRecordingButtons() {
  // Find common selectors for person/contact elements
  const personSelectors = [
    '[data-person]',
    '[data-contact]',
    '[data-user]',
    '.person',
    '.contact',
    '.user',
    '.participant',
    '.attendee',
    'img[alt*="person"]',
    'img[alt*="user"]',
    'img[alt*="contact"]'
  ];

  personSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      if (!element.dataset.recordingButtonAdded) {
        addRecordingButton(element);
        element.dataset.recordingButtonAdded = 'true';
      }
    });
  });
}

// Add recording button to an element
function addRecordingButton(element) {
  const button = document.createElement('button');
  button.className = 'meeting-recorder-btn';
  button.innerHTML = '🎥 Record';
  button.title = 'Click to record meeting';
  
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    startRecording();
  });

  // Position button relative to element
  const rect = element.getBoundingClientRect();
  button.style.position = 'absolute';
  button.style.top = `${rect.top + window.scrollY}px`;
  button.style.left = `${rect.right + window.scrollX + 10}px`;
  button.style.zIndex = '10000';
  
  document.body.appendChild(button);
}

// Start recording (sends message to background)
function startRecording() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.runtime.sendMessage({ 
        action: 'startRecording',
        tabId: tabs[0].id 
      }, (response) => {
        if (response && response.success) {
          showNotification('Recording started!', 'success');
          updateRecordingUI(true);
        } else {
          showNotification(response?.error || 'Failed to start recording', 'error');
        }
      });
    }
  });
}

// Stop recording
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

// Update UI based on recording state
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

// Show notification
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

// Recording state (only for non-Google Meet sites)
// Check if we're on Google Meet - if yes, don't initialize
if (!window.location.hostname.includes('meet.google.com')) {
  // Use unique variable names to avoid conflicts
  let genericMediaRecorder = null;
  let genericRecordedChunks = [];
  let genericRecordingStream = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startRecordingWithStreamId') {
    // Start recording with streamId from background
    startRecordingWithStreamId(request.streamId, sendResponse);
    return true; // Keep channel open
  } else if (request.action === 'stopRecording') {
    // Stop recording
    stopRecordingLocal(sendResponse);
    return true;
  } else if (request.action === 'recordingStarted') {
    updateRecordingUI(true);
  } else if (request.action === 'recordingStopped') {
    updateRecordingUI(false);
    if (request.blobUrl) {
      showDownloadPrompt(request.blobUrl);
    }
  }
});

// Start recording with streamId
async function startRecordingWithStreamId(streamId, sendResponse) {
  try {
    // Get the stream using getUserMedia (content script can do this)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      }
    });

    genericRecordingStream = stream;

    // Setup MediaRecorder
    const options = {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 2500000
    };

    // Fallback to other codecs if vp9 not supported
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm';
    }

    genericMediaRecorder = new MediaRecorder(stream, options);
    genericRecordedChunks = [];

    genericMediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        genericRecordedChunks.push(event.data);
      }
    };

    genericMediaRecorder.onstop = () => {
      const blob = new Blob(genericRecordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      // Save recording info
      chrome.storage.local.set({
        lastRecording: {
          url: url,
          timestamp: Date.now(),
          size: blob.size
        }
      });

      // Clean up
      if (genericRecordingStream) {
        genericRecordingStream.getTracks().forEach(track => track.stop());
        genericRecordingStream = null;
      }

      // Notify background
      chrome.runtime.sendMessage({
        action: 'recordingStopped',
        blobUrl: url
      });

      // Update UI
      updateRecordingUI(false);
      showDownloadPrompt(url);
    };

    genericMediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      sendResponse({ success: false, error: event.error.message });
    };

    // Start recording
    genericMediaRecorder.start(1000); // Collect data every second
    updateRecordingUI(true);
    showNotification('Recording started!', 'success');
    
    sendResponse({ success: true, message: 'Recording started' });

  } catch (error) {
    console.error('Error starting recording:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Stop recording locally
function stopRecordingLocal(sendResponse) {
  if (!genericMediaRecorder || genericMediaRecorder.state === 'inactive') {
    sendResponse({ success: false, error: 'No recording in progress' });
    return;
  }

  try {
    if (genericMediaRecorder.state === 'recording') {
      genericMediaRecorder.stop();
      sendResponse({ success: true, message: 'Recording stopped' });
    } else {
      sendResponse({ success: false, error: 'Recording not active' });
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Show download prompt
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

} // Close the if block for non-Google Meet sites

// Initialize on page load (only for non-Google Meet sites)
if (!window.location.hostname.includes('meet.google.com')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(injectRecordingButtons, 1000);
    });
  } else {
    setTimeout(injectRecordingButtons, 1000);
  }

  // Re-inject on dynamic content changes
  const observer = new MutationObserver(() => {
    injectRecordingButtons();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

