// Background Service Worker for Meeting Recorder Extension

let recordingState = {
  isRecording: false,
  mediaRecorder: null,
  recordedChunks: [],
  stream: null,
  startTime: null
};

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startRecording') {
    const tabId = request.tabId || sender.tab?.id;
    if (tabId) {
      startRecording(tabId, sendResponse);
    } else {
      // Fallback: get active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          startRecording(tabs[0].id, sendResponse);
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
    }
    return true; // Keep channel open for async response
  } else if (request.action === 'stopRecording') {
    stopRecording(sendResponse);
    return true;
  } else if (request.action === 'getRecordingState') {
    sendResponse({ isRecording: recordingState.isRecording });
  } else if (request.action === 'downloadRecording') {
    downloadRecording(request.blobUrl);
    sendResponse({ success: true });
  } else if (request.action === 'recordingStopped') {
    // Recording stopped from content script
    recordingState.isRecording = false;
    if (request.blobUrl) {
      chrome.storage.local.set({
        lastRecording: {
          url: request.blobUrl,
          timestamp: Date.now()
        }
      });
    }
  } else if (request.action === 'setRecordingState') {
    // Update recording state
    recordingState.isRecording = request.isRecording || false;
    sendResponse({ success: true });
  } else if (request.action === 'recordingStarted') {
    // Recording actually started in content script
    recordingState.isRecording = true;
  }
});

// Start recording function
async function startRecording(tabId, sendResponse) {
  try {
    if (recordingState.isRecording) {
      sendResponse({ success: false, error: 'Recording already in progress' });
      return;
    }

    // Request screen capture - get streamId
    // In Manifest V3, we need to pass tab object
    const streamId = await new Promise((resolve, reject) => {
      // Get the target tab first
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          reject(new Error('No active tab found. Please open a tab first.'));
          return;
        }
        
        // Request desktop capture - pass tab object
        try {
          chrome.desktopCapture.chooseDesktopMedia(
            ['screen', 'window', 'tab', 'audio'],
            tab,
            (streamId) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              
              if (streamId) {
                resolve(streamId);
              } else {
                reject(new Error('Please select a screen or window to record.'));
              }
            }
          );
        } catch (error) {
          reject(new Error('Failed to request screen capture: ' + error.message));
        }
      });
    });

    // DON'T mark as recording yet - wait for user to select screen
    // Only mark as true AFTER recording actually starts in content script
    recordingState.startTime = Date.now();
    
    // Send streamId to content script to handle recording
    // Service worker can't use getUserMedia directly
    // First, check if content script is ready
    const sendToContentScript = (retryCount = 0) => {
      const maxRetries = 3;
      
      chrome.tabs.sendMessage(tabId, {
        action: 'startRecordingWithStreamId',
        streamId: streamId
      }, (response) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          console.error('Error sending message to content script:', errorMsg);
          
          // If "Receiving end does not exist", content script might not be ready yet
          if (errorMsg.includes('Receiving end does not exist') || errorMsg.includes('Could not establish connection')) {
            if (retryCount < maxRetries) {
              const delay = (retryCount + 1) * 500; // 500ms, 1000ms, 1500ms
              console.log(`Retrying after ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
              setTimeout(() => {
                sendToContentScript(retryCount + 1);
              }, delay);
              return;
            } else {
              // Max retries reached, inject content script manually
              console.log('Max retries reached. Content script may not be loaded. Please reload the page.');
              recordingState.isRecording = false;
              sendResponse({ 
                success: false, 
                error: 'Content script not ready. Please reload the Google Meet page and try again.' 
              });
              return;
            }
          }
          
          // Reset state on error
          recordingState.isRecording = false;
          sendResponse({ success: false, error: errorMsg });
          return;
        }
        
        if (response && response.success) {
          // NOW mark as recording since MediaRecorder actually started
          recordingState.isRecording = true;
          sendResponse({ success: true, message: 'Recording started' });
        } else {
          // Don't reset state here - it was never set to true
          sendResponse({ success: false, error: response?.error || 'Failed to start recording' });
        }
      });
    };
    
    // Start sending with retry mechanism
    sendToContentScript(0);

  } catch (error) {
    console.error('Error starting recording:', error);
    sendResponse({ success: false, error: error.message });
    recordingState.isRecording = false;
  }
}

// Stop recording function
function stopRecording(sendResponse) {
  if (!recordingState.isRecording) {
    sendResponse({ success: false, error: 'No recording in progress' });
    return;
  }

  // Send stop message to content script with retry
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const sendStopMessage = (retryCount = 0) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'stopRecording'
        }, (response) => {
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            if ((errorMsg.includes('Receiving end does not exist') || errorMsg.includes('Could not establish connection')) && retryCount < 2) {
              setTimeout(() => sendStopMessage(retryCount + 1), 500);
              return;
            }
            // Even if content script not found, mark as stopped
            recordingState.isRecording = false;
            sendResponse({ success: true, message: 'Recording stopped (content script not available)' });
            return;
          }
          
          if (response && response.success) {
            recordingState.isRecording = false;
            const duration = Date.now() - recordingState.startTime;
            sendResponse({ 
              success: true, 
              message: 'Recording stopped',
              duration: duration
            });
          } else {
            // Even if response failed, mark as stopped
            recordingState.isRecording = false;
            sendResponse({ success: true, message: 'Recording stopped' });
          }
        });
      };
      
      sendStopMessage(0);
    } else {
      sendResponse({ success: false, error: 'No active tab found' });
    }
  });
}

// Download recording
function downloadRecording(blobUrl) {
  chrome.storage.local.get(['lastRecording'], (result) => {
    if (result.lastRecording && result.lastRecording.url) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `meeting-recording-${timestamp}.webm`;
      
      chrome.downloads.download({
        url: result.lastRecording.url,
        filename: filename,
        saveAs: true
      });
    }
  });
}

// Clean up on extension unload
chrome.runtime.onSuspend.addListener(() => {
  recordingState.isRecording = false;
  // Content script will handle cleanup
});

