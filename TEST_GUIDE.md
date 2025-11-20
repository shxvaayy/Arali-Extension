# Testing Guide - Combined Assistant

## 🧪 How to Test

### Prerequisites
1. ✅ Node.js installed
2. ✅ Python 3.12+ installed
3. ✅ Dependencies installed

### Step 1: Install Dependencies

```bash
cd "/Volumes/SHIVAY DATA/combined-assistant"

# Install Node.js dependencies
npm install

# Install Python dependencies (if not done)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 2: Set Environment Variables

Create `.env` file in project root:

```env
OPENAI_API_KEY=your_openai_api_key_here
HUGGINGFACE_TOKEN=your_huggingface_token_here
```

### Step 3: Start the App

```bash
npm start
```

### Step 4: Test Recording Flow

1. **Start Session:**
   - Enter Gemini API key
   - Select profile (Interview, Sales, etc.)
   - Click "Start Session"
   - ✅ Check console: Should see "🎙️ Recording started"

2. **During Session:**
   - Use real-time AI assistance
   - Recording is happening in background
   - ✅ Check console: Should see recording activity

3. **Stop Session:**
   - Click "Stop Session" or close window
   - ✅ Check console: Should see "✅ Recording stopped"
   - ✅ Check console: Should see "🔄 Starting transcription"

4. **Check Files:**
   ```bash
   # Check recordings directory
   ls -la ~/Library/Application\ Support/cheating-daddy/recordings/
   
   # Check metadata
   ls -la ~/Library/Application\ Support/cheating-daddy/metadata/
   
   # Check transcripts (after transcription completes)
   ls -la ~/Library/Application\ Support/cheating-daddy/transcripts/
   ```

### Step 5: Verify Recording Service

Check if recording service is working:

```bash
# Check if directories are created
ls -la ~/Library/Application\ Support/cheating-daddy/
```

Should see:
- `recordings/` - Audio files
- `metadata/` - Session metadata (JSON)
- `transcripts/` - Transcript files (JSON)

### Step 6: Test Transcription (Manual)

If automatic transcription doesn't work, test manually:

```bash
# Start transcription server
cd server
npm install
npm run dev

# In another terminal, test transcription API
curl -X POST http://localhost:3001/api/transcribe \
  -F "audio=@/path/to/recording.wav" \
  -F "useOpenSource=true"
```

## 🔍 What to Check

### ✅ Recording Service
- [ ] Recording starts when session starts
- [ ] Recording stops when session ends
- [ ] Files saved to correct directory
- [ ] Metadata saved correctly

### ✅ Integration
- [ ] No errors in console
- [ ] Session ID matches recording session ID
- [ ] Profile saved in metadata

### ✅ File Structure
- [ ] Recordings directory created
- [ ] Metadata directory created
- [ ] Transcripts directory created (after transcription)

## 🐛 Common Issues

### Issue: "Cannot find module 'electron'"
**Fix:** Run `npm install` in project root

### Issue: Recording not starting
**Check:**
- Console for errors
- `recordingService.isRecording()` returns true
- Session ID is generated

### Issue: Files not saving
**Check:**
- Permissions on userData directory
- Disk space available
- Console for file write errors

### Issue: Transcription not working
**Check:**
- Python environment activated
- PyAnnote models downloaded
- OpenAI API key set
- Transcription server running

## 📝 Expected Console Output

When you start a session:
```
New conversation session started: 1234567890
🎙️  Recording started for session: 1234567890
Recording started: /path/to/recording.wav
```

When you stop a session:
```
✅ Recording stopped: /path/to/recording.wav
✅ Metadata saved: /path/to/metadata.json
🔄 Starting transcription for session: 1234567890
```

## 🎯 Next Steps After Testing

1. If recording works → Add transcription API integration
2. If transcription works → Add UI for viewing recordings
3. If everything works → Add audio stream capture




