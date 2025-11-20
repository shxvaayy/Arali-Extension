// Popup Script

let recordingInterval = null;
let startTime = null;

// Get elements
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusText = document.getElementById('status-text');
const statusDot = document.querySelector('.status-dot');
const durationEl = document.getElementById('duration');
const recordingStatusEl = document.getElementById('recording-status');
const downloadBtn = document.getElementById('download-btn');
const lastRecordingDiv = document.getElementById('last-recording');
// Duration is now in status indicator
const statusDurationEl = document.querySelector('#status-indicator #duration') || durationEl;

// Check recording state on load and periodically
checkRecordingState();
setInterval(checkRecordingState, 2000); // Check every 2 seconds

// Start recording button
startBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.runtime.sendMessage({ 
        action: 'startRecording',
        tabId: tabs[0].id 
      }, (response) => {
        if (response && response.success) {
          updateUI(true);
          startDurationTimer();
        } else {
          alert(response?.error || 'Failed to start recording');
        }
      });
    } else {
      alert('No active tab found');
    }
  });
});

// Stop recording button
stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
    if (response && response.success) {
      updateUI(false);
      stopDurationTimer();
    } else {
      alert(response?.error || 'Failed to stop recording');
    }
  });
});

// Download button
downloadBtn.addEventListener('click', () => {
  chrome.storage.local.get(['lastRecording'], (result) => {
    if (result.lastRecording && result.lastRecording.url) {
      chrome.runtime.sendMessage({
        action: 'downloadRecording',
        blobUrl: result.lastRecording.url
      });
    }
  });
});

// Update UI based on recording state
function updateUI(isRecording) {
  if (isRecording) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusText.textContent = 'Recording...';
    statusDot.classList.add('recording');
    recordingStatusEl.textContent = 'Recording';
    recordingStatusEl.style.color = '#ea4335';
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusText.textContent = 'Ready';
    statusDot.classList.remove('recording');
    recordingStatusEl.textContent = 'Not Recording';
    recordingStatusEl.style.color = '#34a853';
    if (statusDurationEl) statusDurationEl.textContent = '00:00';
    if (durationEl && durationEl !== statusDurationEl) durationEl.textContent = '00:00';
  }
}

// Check current recording state
function checkRecordingState() {
  chrome.runtime.sendMessage({ action: 'getRecordingState' }, (response) => {
    if (response && response.isRecording) {
      updateUI(true);
      startDurationTimer();
    } else {
      updateUI(false);
      // Check for last recording
      chrome.storage.local.get(['lastRecording'], (result) => {
        if (result.lastRecording) {
          lastRecordingDiv.style.display = 'block';
        }
      });
    }
  });
}

// Start duration timer
function startDurationTimer() {
  startTime = Date.now();
  recordingInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (statusDurationEl) statusDurationEl.textContent = timeStr;
    if (durationEl && durationEl !== statusDurationEl) durationEl.textContent = timeStr;
  }, 1000);
}

// Stop duration timer
function stopDurationTimer() {
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
  startTime = null;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'recordingStarted') {
    updateUI(true);
    startDurationTimer();
  } else if (request.action === 'recordingStopped') {
    updateUI(false);
    stopDurationTimer();
    lastRecordingDiv.style.display = 'block';
  }
});

