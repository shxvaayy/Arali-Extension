// Google Meet Specific Integration
// Control bar mein mic ke side extension button add karta hai

let extensionButton = null;
let isRecording = false;
let recordingStartTime = null;
let recordingTimerInterval = null;

// Check if user is in active meeting
function isInActiveMeeting() {
  if (window.location.pathname.includes('/landing') || window.location.pathname === '/') {
    return false;
  }
  const hasMic = document.querySelector('[data-is-muted]') || 
                 document.querySelector('button[aria-label*="microphone"]');
  return !!hasMic;
}

// ULTRA SIMPLE BUTTON INJECTION
function injectExtensionButton() {
  if (!isInActiveMeeting()) {
    return;
  }
  
  const existing = document.getElementById('meeting-recorder-extension-btn');
  if (existing) {
    const rect = existing.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return;
    }
    existing.remove();
  }
  
  console.log('🚀 INJECTING BUTTON...');
  
  // Find mic button - try multiple selectors
  let micButton = document.querySelector('[data-is-muted]');
  if (!micButton) {
    micButton = document.querySelector('button[aria-label*="microphone"]');
  }
  if (!micButton) {
    micButton = document.querySelector('button[aria-label*="Microphone"]');
  }
  if (!micButton) {
    // Try finding by icon
    const micIcons = document.querySelectorAll('svg, [data-icon*="mic"], [class*="mic"]');
    for (const icon of micIcons) {
      const btn = icon.closest('button');
      if (btn && (btn.getAttribute('aria-label')?.toLowerCase().includes('mic') || 
                  btn.getAttribute('aria-label')?.toLowerCase().includes('microphone'))) {
        micButton = btn;
        break;
      }
    }
  }
  
  if (!micButton) {
    console.error('❌ Mic button NOT found!');
    return;
  }
  
  console.log('✅ Mic found:', micButton);
  console.log('📍 Mic position:', micButton.getBoundingClientRect());
  
  // Create button
  extensionButton = document.createElement('button');
  extensionButton.id = 'meeting-recorder-extension-btn';
  extensionButton.setAttribute('aria-label', 'Record Meeting');
  
  // Force ALL styles with !important - SAME SIZE as mic button
  const micRect = micButton.getBoundingClientRect();
  const buttonSize = micRect.height > 0 ? micRect.height : 40;
  
  extensionButton.style.cssText = `
    width: ${buttonSize}px !important;
    height: ${buttonSize}px !important;
    border-radius: 50% !important;
    border: none !important;
    background: white !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    margin-right: 8px !important;
    margin-left: 0 !important;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    position: relative !important;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
    z-index: 999999 !important;
    visibility: visible !important;
    opacity: 1 !important;
    flex-shrink: 0 !important;
    align-self: center !important;
  `;
  
  extensionButton.innerHTML = `
    <img src="${chrome.runtime.getURL('icons/icon.png')}" 
         alt="Record" 
         style="width: ${buttonSize - 8}px; height: ${buttonSize - 8}px; border-radius: 50%; object-fit: cover; display: block !important;">
  `;
  
  extensionButton.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    showRecordingPopup();
  });
  
  // INSERT - Find the HORIZONTAL flex container that holds mic button
  let inserted = false;
  
  // Find the horizontal flex container (control bar row)
  let container = micButton.parentElement;
  let foundHorizontalContainer = false;
  
  // Walk up the DOM to find a flex container with horizontal layout
  for (let i = 0; i < 10 && container; i++) {
    const style = window.getComputedStyle(container);
    const isFlex = style.display === 'flex' || style.display === 'inline-flex';
    const isHorizontal = style.flexDirection === 'row' || style.flexDirection === '' || 
                         style.flexDirection === 'row-reverse';
    
    if (isFlex && isHorizontal) {
      // Check if mic button is a direct child or nested
      const children = Array.from(container.children);
      let micElement = micButton;
      let micIdx = -1;
      
      // Find mic button or its parent in this container
      for (let j = 0; j < children.length; j++) {
        if (children[j] === micButton || children[j].contains(micButton)) {
          micElement = children[j] === micButton ? micButton : children[j];
          micIdx = j;
          break;
        }
      }
      
      if (micIdx >= 0) {
        // Insert BEFORE the element containing mic button
        container.insertBefore(extensionButton, children[micIdx]);
        inserted = true;
        foundHorizontalContainer = true;
        console.log('✅✅✅ INSERTED in horizontal flex container LEFT of mic!');
        console.log('📍 Container:', container, 'Flex direction:', style.flexDirection);
        break;
      }
    }
    container = container.parentElement;
  }
  
  // Method 2: If no flex container found, try direct parent
  if (!inserted) {
    const micParent = micButton.parentElement;
    if (micParent) {
      micParent.insertBefore(extensionButton, micButton);
      inserted = true;
      console.log('✅✅✅ INSERTED in direct parent LEFT of mic!');
    }
  }
  
  // Force parent to be flex if not already
  if (inserted && extensionButton.parentElement) {
    const parentStyle = window.getComputedStyle(extensionButton.parentElement);
    if (parentStyle.display !== 'flex' && parentStyle.display !== 'inline-flex') {
      extensionButton.parentElement.style.display = 'flex';
      extensionButton.parentElement.style.alignItems = 'center';
      extensionButton.parentElement.style.gap = '8px';
      console.log('✅ Forced parent to flex container');
    }
  }
  
  // Verify - Check if icon is in same row as mic and fix if needed
  setTimeout(() => {
    const btn = document.getElementById('meeting-recorder-extension-btn');
    if (btn && micButton) {
      const btnRect = btn.getBoundingClientRect();
      const micRect = micButton.getBoundingClientRect();
      const verticalDiff = Math.abs(btnRect.top - micRect.top);
      const horizontalDiff = btnRect.left - micRect.left;
      
      console.log('🔍 VERIFICATION:', {
        inDOM: document.body.contains(btn),
        visible: btnRect.width > 0 && btnRect.height > 0,
        btnPos: { x: Math.round(btnRect.x), y: Math.round(btnRect.y) },
        micPos: { x: Math.round(micRect.x), y: Math.round(micRect.y) },
        verticalDiff: Math.round(verticalDiff),
        horizontalDiff: Math.round(horizontalDiff),
        sameRow: verticalDiff < 10,
        leftOfMic: btnRect.right <= micRect.left + 20
      });
      
      // If not in same row (vertical misalignment), fix it
      if (verticalDiff > 10) {
        console.warn('⚠️ Icon not in same row! Vertical diff:', verticalDiff);
        // Try to align vertically
        const topDiff = micRect.top - btnRect.top;
        btn.style.marginTop = `${topDiff}px`;
        console.log('🔧 Fixed vertical alignment with marginTop:', topDiff);
      }
      
      // If icon is to the right of mic or too far, re-insert
      if (btnRect.left > micRect.left - 50) {
        console.warn('⚠️ Icon not to the left of mic! Re-inserting...');
        btn.remove();
        // Find mic's parent and insert before mic
        const micParent = micButton.parentElement;
        if (micParent) {
          micParent.insertBefore(btn, micButton);
          console.log('✅ Re-inserted before mic');
        }
      }
      
      // Ensure visibility
      if (btnRect.width === 0 || btnRect.height === 0) {
        btn.style.cssText += `display: flex !important; width: ${buttonSize}px !important; height: ${buttonSize}px !important; visibility: visible !important;`;
      }
      
      // Final check - if still misaligned, log warning
      setTimeout(() => {
        const finalBtnRect = btn.getBoundingClientRect();
        const finalMicRect = micButton.getBoundingClientRect();
        const finalVerticalDiff = Math.abs(finalBtnRect.top - finalMicRect.top);
        
        if (finalVerticalDiff < 10 && finalBtnRect.right <= finalMicRect.left + 20) {
          console.log('✅✅✅ SUCCESS! Icon is LEFT of mic in same row!');
        } else {
          console.warn('⚠️ Still misaligned. Vertical diff:', finalVerticalDiff);
        }
      }, 100);
    }
  }, 300);
}

// Format time as MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Update popup timer
function updatePopupTimer() {
  const popup = document.getElementById('meeting-recorder-popup');
  if (!popup) return;
  
  const timeSpan = popup.querySelector('#recording-time');
  if (timeSpan && recordingStartTime) {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    timeSpan.textContent = formatTime(elapsed);
  }
}

// Popup
function showRecordingPopup() {
  const existing = document.getElementById('meeting-recorder-popup');
  if (existing) {
    existing.remove();
    return;
  }

  const popup = document.createElement('div');
  popup.id = 'meeting-recorder-popup';
  popup.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
  `;

  // Get current time if recording
  const currentTime = isRecording && recordingStartTime 
    ? formatTime(Math.floor((Date.now() - recordingStartTime) / 1000))
    : '00:00';

  popup.innerHTML = `
    <div style="background: white; border-radius: 24px; padding: 2px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
      <div style="background: #000000; border-radius: 22px; padding: 12px 20px; display: flex; align-items: center; justify-content: center; gap: 10px; color: white; font-size: 15px; font-weight: 500; min-width: 200px; position: relative;">
        <div style="width: 10px; height: 10px; background: #ea4335; border-radius: 50%; ${isRecording ? 'animation: pulse 2s infinite;' : 'opacity: 0.6;'}"></div>
        <span>Record Meeting</span>
        ${isRecording ? `<span id="recording-time" style="font-variant-numeric: tabular-nums;">${currentTime}</span>` : ''}
        <button id="popup-control-btn" style="background: transparent; border: none; cursor: pointer; padding: 4px; margin-left: 8px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">
          ${isRecording ? `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="4" width="4" height="16" rx="1" fill="white"/>
              <rect x="14" y="4" width="4" height="16" rx="1" fill="white"/>
            </svg>
          ` : `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5v14l11-7z" fill="white"/>
            </svg>
          `}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Start timer if recording
  if (isRecording && recordingStartTime) {
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    recordingTimerInterval = setInterval(updatePopupTimer, 1000);
  }

  // Add click handler to control button
  const controlBtn = popup.querySelector('#popup-control-btn');
  if (controlBtn) {
    controlBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!isRecording) {
        await startRecording();
      } else {
        await stopRecording();
      }
    });
  }
  
  // Also allow clicking anywhere on popup (except control button)
  popup.addEventListener('click', async (e) => {
    if (e.target.closest('#popup-control-btn')) return; // Let control button handle it
    e.stopPropagation();
    popup.remove();
    if (recordingTimerInterval) {
      clearInterval(recordingTimerInterval);
      recordingTimerInterval = null;
    }
    if (!isRecording) {
      await startRecording();
    } else {
      await stopRecording();
    }
  });

  setTimeout(() => {
    const closeHandler = (e) => {
      if (!popup.contains(e.target) && e.target !== extensionButton) {
        popup.remove();
        if (recordingTimerInterval) {
          clearInterval(recordingTimerInterval);
          recordingTimerInterval = null;
        }
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 100);
}

// Start recording
async function startRecording() {
  // Check local state first
  if (isRecording || (meetMediaRecorder && meetMediaRecorder.state === 'recording')) {
    showNotification('Recording already in progress!', 'error');
    return;
  }
  
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      showNotification('Extension context invalidated. Please reload the page.', 'error');
      return;
    }
    
    // Check background state BEFORE starting
    const stateResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getRecordingState' }, (resp) => {
        resolve(resp || { isRecording: false });
      });
    });
    
    if (stateResponse && stateResponse.isRecording) {
      showNotification('Recording already in progress!', 'error');
      isRecording = true;
      updateButtonState(true);
      return;
    }
    
    // DON'T set isRecording yet - wait for actual recording to start
    // This prevents "already in progress" error if user cancels screen share
    
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'startRecording' }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp || { success: false, error: 'No response' });
        }
      });
    });
    
    // Only set state if recording actually started
    if (response && response.success) {
      // State will be set by startRecordingWithStreamId when MediaRecorder actually starts
      showNotification('Recording started!', 'success');
    } else {
      // User cancelled or error occurred
      isRecording = false;
      updateButtonState(false);
      showNotification(response?.error || 'Failed to start recording', 'error');
    }
  } catch (error) {
    console.error('Error in startRecording:', error);
    isRecording = false;
    updateButtonState(false);
    showNotification('Error: ' + (error.message || error.toString()), 'error');
  }
}

// Stop recording
async function stopRecording() {
  try {
    // Stop local MediaRecorder first
    if (meetMediaRecorder && meetMediaRecorder.state === 'recording') {
      meetMediaRecorder.stop();
      isRecording = false;
      recordingStartTime = null;
      updateButtonState(false);
      
      // Stop timer
      if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
      }
      
      // Remove timer from popup and update control button
      const popup = document.getElementById('meeting-recorder-popup');
      if (popup) {
        const timeSpan = popup.querySelector('#recording-time');
        if (timeSpan) timeSpan.remove();
        
        // Update control button to show play icon
        const controlBtn = popup.querySelector('#popup-control-btn');
        if (controlBtn) {
          controlBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5v14l11-7z" fill="white"/>
            </svg>
          `;
        }
      }
      
      showNotification('Recording stopped!', 'success');
      return;
    }
    
    // Also notify background
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'stopRecording' }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(resp);
        }
      });
    });
    
    isRecording = false;
    recordingStartTime = null;
    updateButtonState(false);
    
    // Stop timer
    if (recordingTimerInterval) {
      clearInterval(recordingTimerInterval);
      recordingTimerInterval = null;
    }
    
    // Remove timer from popup and update control button
    const popup = document.getElementById('meeting-recorder-popup');
    if (popup) {
      const timeSpan = popup.querySelector('#recording-time');
      if (timeSpan) timeSpan.remove();
      
      // Update control button to show play icon
      const controlBtn = popup.querySelector('#popup-control-btn');
      if (controlBtn) {
        controlBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5v14l11-7z" fill="white"/>
          </svg>
        `;
      }
    }
    
    if (response && response.success) {
      showNotification('Recording stopped!', 'success');
    } else {
      // Even if background says failed, we stopped locally
      showNotification('Recording stopped!', 'success');
    }
  } catch (error) {
    console.error('Error in stopRecording:', error);
    isRecording = false;
    recordingStartTime = null;
    updateButtonState(false);
    
    // Stop timer
    if (recordingTimerInterval) {
      clearInterval(recordingTimerInterval);
      recordingTimerInterval = null;
    }
    
    showNotification('Recording stopped!', 'success');
  }
}

// Button state update
function updateButtonState(recording) {
  if (!extensionButton) return;
  isRecording = recording;
  const redDot = extensionButton.querySelector('div[style*="background: #ea4335"]');
  if (redDot) {
    if (recording) {
      redDot.style.animation = 'pulse 2s infinite';
      redDot.style.display = 'block';
    } else {
      redDot.style.animation = 'none';
      redDot.style.display = 'none';
    }
  }
}

// Notification
function showNotification(message, type = 'info') {
  const existing = document.getElementById('meeting-recorder-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'meeting-recorder-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#34a853' : type === 'error' ? '#ea4335' : '#1a73e8'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 10000;
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// CSS
function addStyles() {
  if (document.getElementById('meeting-recorder-styles')) return;

  const style = document.createElement('style');
  style.id = 'meeting-recorder-styles';
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.1); }
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    #meeting-recorder-extension-btn {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 999999 !important;
    }
  `;
  document.head.appendChild(style);
}

// Recording state
let meetMediaRecorder = null;
let meetRecordedChunks = [];
let meetRecordingStream = null;

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      return false;
    }
  } catch (e) {
    return false;
  }
  
  if (request.action === 'startRecordingWithStreamId') {
    if (isRecording) {
      sendResponse({ success: false, error: 'Recording already in progress' });
      return true;
    }
    startRecordingWithStreamId(request.streamId, sendResponse);
    return true;
  } else if (request.action === 'stopRecording') {
    stopRecordingLocal(sendResponse);
    return true;
  } else if (request.action === 'recordingStarted') {
    isRecording = true;
    updateButtonState(true);
  } else if (request.action === 'recordingStopped') {
    isRecording = false;
    updateButtonState(false);
    if (request.blobUrl) {
      showDownloadPrompt(request.blobUrl);
    }
  }
  return false;
});

// Start recording with streamId
async function startRecordingWithStreamId(streamId, sendResponse) {
  try {
    // Get desktop stream (screen + system audio)
    const desktopStream = await navigator.mediaDevices.getUserMedia({
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
    
    // Get microphone audio stream
    let micStream = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      console.log('✅ Microphone audio captured');
    } catch (micError) {
      console.warn('⚠️ Could not access microphone:', micError);
      // Continue without mic audio
    }
    
    // Combine audio tracks if mic is available
    let finalStream = desktopStream;
    if (micStream && micStream.getAudioTracks().length > 0) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const desktopAudio = audioContext.createMediaStreamSource(desktopStream);
        const micAudio = audioContext.createMediaStreamSource(micStream);
        const destination = audioContext.createMediaStreamDestination();
        
        // Mix both audio sources
        desktopAudio.connect(destination);
        micAudio.connect(destination);
        
        // Get video track from desktop stream
        const videoTrack = desktopStream.getVideoTracks()[0];
        if (videoTrack) {
          destination.stream.addTrack(videoTrack);
        }
        
        finalStream = destination.stream;
        console.log('✅ Combined desktop audio + microphone audio');
        
        // Store audio context for cleanup
        finalStream._audioContext = audioContext;
      } catch (audioError) {
        console.warn('⚠️ Error combining audio, using desktop stream only:', audioError);
        // Fallback to desktop stream only
        finalStream = desktopStream;
      }
    }

    meetRecordingStream = finalStream;
    
    // Store original streams for cleanup
    meetRecordingStream._desktopStream = desktopStream;
    if (micStream) {
      meetRecordingStream._micStream = micStream;
    }

    const options = {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 2500000
    };

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm';
    }

    meetMediaRecorder = new MediaRecorder(finalStream, options);
    meetRecordedChunks = [];

    meetMediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        meetRecordedChunks.push(event.data);
      }
    };

    meetMediaRecorder.onstop = () => {
      const blob = new Blob(meetRecordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      console.log('✅ Recording stopped, blob size:', blob.size, 'bytes');
      
      chrome.storage.local.set({
        lastRecording: {
          url: url,
          timestamp: Date.now(),
          size: blob.size
        }
      });

      if (meetRecordingStream) {
        // Stop all tracks
        meetRecordingStream.getTracks().forEach(track => track.stop());
        
        // Close audio context if it exists
        if (meetRecordingStream._audioContext) {
          meetRecordingStream._audioContext.close().catch(e => console.warn('Error closing audio context:', e));
        }
        
        // Stop original streams if they exist
        if (meetRecordingStream._desktopStream) {
          meetRecordingStream._desktopStream.getTracks().forEach(track => track.stop());
        }
        if (meetRecordingStream._micStream) {
          meetRecordingStream._micStream.getTracks().forEach(track => track.stop());
        }
        
        meetRecordingStream = null;
      }

      // Update state
      isRecording = false;
      recordingStartTime = null;
      updateButtonState(false);
      
      // Stop timer
      if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
      }
      
      // Remove timer from popup if it exists
      const popup = document.getElementById('meeting-recorder-popup');
      if (popup) {
        const timeSpan = popup.querySelector('#recording-time');
        if (timeSpan) timeSpan.remove();
      }

      // Notify background
      try {
        chrome.runtime.sendMessage({
          action: 'recordingStopped',
          blobUrl: url
        }, () => {
          // Show download prompt after notifying background
          setTimeout(() => {
            showDownloadPrompt(url);
          }, 300);
        });
      } catch (e) {
        console.warn('Error notifying background:', e);
        // Still show download prompt even if background notification fails
        setTimeout(() => {
          showDownloadPrompt(url);
        }, 300);
      }
    };

    meetMediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      sendResponse({ success: false, error: event.error.message });
    };

    meetMediaRecorder.start(1000);
    
    // NOW set recording state - MediaRecorder actually started
    isRecording = true;
    recordingStartTime = Date.now();
    updateButtonState(true);
    
    // Start timer and update popup if it exists
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    recordingTimerInterval = setInterval(() => {
      updatePopupTimer();
    }, 1000);
    
    // Update popup to show timer (create popup if it doesn't exist)
    let popup = document.getElementById('meeting-recorder-popup');
    if (!popup) {
      // Create popup if it doesn't exist
      popup = document.createElement('div');
      popup.id = 'meeting-recorder-popup';
      popup.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        font-family: 'Google Sans', Roboto, Arial, sans-serif;
      `;
      
      popup.innerHTML = `
        <div style="background: white; border-radius: 24px; padding: 2px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
          <div style="background: #000000; border-radius: 22px; padding: 12px 20px; display: flex; align-items: center; justify-content: center; gap: 10px; color: white; font-size: 15px; font-weight: 500; min-width: 200px; position: relative;">
            <div style="width: 10px; height: 10px; background: #ea4335; border-radius: 50%; animation: pulse 2s infinite;"></div>
            <span>Record Meeting</span>
            <span id="recording-time" style="font-variant-numeric: tabular-nums;">00:00</span>
            <button id="popup-control-btn" style="background: transparent; border: none; cursor: pointer; padding: 4px; margin-left: 8px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="4" width="4" height="16" rx="1" fill="white"/>
                <rect x="14" y="4" width="4" height="16" rx="1" fill="white"/>
              </svg>
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(popup);
      
      // Add click handler to control button
      const controlBtn = popup.querySelector('#popup-control-btn');
      if (controlBtn) {
        controlBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          await stopRecording();
        });
      }
    } else {
      // Popup exists, just add timer if not present
      const timeSpan = popup.querySelector('#recording-time');
      if (!timeSpan) {
        const newTimeSpan = document.createElement('span');
        newTimeSpan.id = 'recording-time';
        newTimeSpan.style.cssText = 'font-variant-numeric: tabular-nums;';
        newTimeSpan.textContent = '00:00';
        popup.querySelector('div[style*="background: #000000"]').appendChild(newTimeSpan);
      }
      
      // Update red dot animation
      const redDot = popup.querySelector('div[style*="background: #ea4335"]');
      if (redDot) {
        redDot.style.animation = 'pulse 2s infinite';
        redDot.style.opacity = '1';
      }
      
      // Update control button to show pause icon
      const controlBtn = popup.querySelector('#popup-control-btn');
      if (controlBtn) {
        controlBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="4" width="4" height="16" rx="1" fill="white"/>
            <rect x="14" y="4" width="4" height="16" rx="1" fill="white"/>
          </svg>
        `;
      }
    }
    
    // Notify background that recording actually started
    try {
      chrome.runtime.sendMessage({ action: 'recordingStarted' });
    } catch (e) {
      console.warn('Error notifying background:', e);
    }
    
    sendResponse({ success: true });

  } catch (error) {
    console.error('Error starting recording:', error);
    
    // Clean up on error
    if (meetRecordingStream) {
      meetRecordingStream.getTracks().forEach(track => track.stop());
      if (meetRecordingStream._audioContext) {
        meetRecordingStream._audioContext.close().catch(e => console.warn('Error closing audio context:', e));
      }
      if (meetRecordingStream._desktopStream) {
        meetRecordingStream._desktopStream.getTracks().forEach(track => track.stop());
      }
      if (meetRecordingStream._micStream) {
        meetRecordingStream._micStream.getTracks().forEach(track => track.stop());
      }
      meetRecordingStream = null;
    }
    
    isRecording = false;
    recordingStartTime = null;
    updateButtonState(false);
    
    const errorMessage = error.message || error.toString() || 'Unknown error';
    sendResponse({ success: false, error: errorMessage });
  }
}

// Stop recording locally
function stopRecordingLocal(sendResponse) {
  if (!meetMediaRecorder || meetMediaRecorder.state === 'inactive') {
    sendResponse({ success: false, error: 'No recording in progress' });
    return;
  }

  try {
    if (meetMediaRecorder.state === 'recording') {
      meetMediaRecorder.stop();
      isRecording = false;
      updateButtonState(false);
      try {
        chrome.runtime.sendMessage({ action: 'recordingStopped' });
      } catch (e) {
        console.warn('Error notifying background:', e);
      }
      sendResponse({ success: true });
    } else {
      isRecording = false;
      updateButtonState(false);
      sendResponse({ success: false, error: 'Recording not active' });
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
    isRecording = false;
    updateButtonState(false);
    sendResponse({ success: false, error: error.message });
  }
}

// Download prompt
function showDownloadPrompt(blobUrl) {
  const prompt = document.createElement('div');
  prompt.id = 'meeting-recorder-download';
  prompt.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10001;
    background: white;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
    max-width: 400px;
  `;
  
  prompt.innerHTML = `
    <h3 style="margin: 0 0 12px 0; color: #202124; font-size: 18px;">Recording Complete!</h3>
    <p style="margin: 0 0 20px 0; color: #5f6368; font-size: 14px;">Your meeting recording is ready to download.</p>
    <div style="display: flex; gap: 12px;">
      <button id="download-btn" style="flex: 1; background: #1a73e8; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">Download</button>
      <button id="close-btn" style="background: #f1f3f4; color: #202124; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px;">Close</button>
    </div>
  `;
  
  document.body.appendChild(prompt);
  
  document.getElementById('download-btn').addEventListener('click', () => {
    try {
      chrome.runtime.sendMessage({ action: 'downloadRecording', blobUrl });
    } catch (e) {
      console.error('Error downloading:', e);
    }
    prompt.remove();
  });
  
  document.getElementById('close-btn').addEventListener('click', () => {
    prompt.remove();
  });
}

// Initialize
function init() {
  if (window.meetingRecorderInitialized) {
    return;
  }
  
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.warn('⚠️ Extension context invalidated');
      return;
    }
  } catch (e) {
    console.warn('⚠️ Extension context invalidated:', e);
    return;
  }
  
  window.meetingRecorderInitialized = true;
  
  addStyles();
  
  console.log('🎬 Meeting Recorder: Initializing...');
  
  // Inject immediately
  injectExtensionButton();
  
  // Aggressive retry
  let attempts = 0;
  const maxAttempts = 150;
  
  const checkInterval = setInterval(() => {
    attempts++;
    
    if (!isInActiveMeeting()) {
      const existing = document.getElementById('meeting-recorder-extension-btn');
      if (existing) existing.remove();
      return;
    }
    
    const existingButton = document.getElementById('meeting-recorder-extension-btn');
    if (!existingButton) {
      console.log(`🔄 Attempt ${attempts}: Injecting...`);
      injectExtensionButton();
    } else {
      const rect = existingButton.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.log(`🔄 Attempt ${attempts}: Re-injecting...`);
        existingButton.remove();
        injectExtensionButton();
      } else if (attempts % 30 === 0) {
        console.log(`✅ Button visible! (attempt ${attempts})`);
      }
    }
    
    const button = document.getElementById('meeting-recorder-extension-btn');
    if (button) {
      const rect = button.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        console.log('✅✅✅ SUCCESS! Button visible!');
        clearInterval(checkInterval);
        
        const observer = new MutationObserver(() => {
          const btn = document.getElementById('meeting-recorder-extension-btn');
          if (!btn || btn.getBoundingClientRect().width === 0) {
            setTimeout(injectExtensionButton, 300);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
    
    if (attempts % 20 === 0) {
      const micBtn = document.querySelector('[data-is-muted]');
      const btn = document.getElementById('meeting-recorder-extension-btn');
      console.log(`📊 Attempt ${attempts}:`, {
        micFound: !!micBtn,
        buttonFound: !!btn,
        buttonVisible: btn ? btn.getBoundingClientRect().width > 0 : false
      });
    }
    
    if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.warn('⚠️ Max attempts reached');
    }
  }, 200); // Every 200ms
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
