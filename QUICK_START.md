# 🚀 Quick Start Guide

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Setup API Key

1. **Get AssemblyAI API Key (Recommended):**
   - Go to https://www.assemblyai.com/
   - Sign up (free tier: 5 hours/month)
   - Copy your API key from dashboard

2. **Or Get Deepgram API Key (Alternative):**
   - Go to https://deepgram.com/
   - Sign up (free tier available)
   - Copy your API key

3. **Add to .env file:**
   ```bash
   # Open .env file and add:
   ASSEMBLYAI_API_KEY=your_key_here
   # OR
   DEEPGRAM_API_KEY=your_key_here
   ```

## Step 3: Run Server
```bash
npm run dev
```

## Step 4: Open Browser
```
http://localhost:3001
```

## Step 5: Test It!

1. Upload an audio file (MP3, WAV, etc.)
2. Optionally add speaker names: "Akshat, Shivay"
3. Click "Transcribe Audio"
4. Wait for transcription (may take 1-2 minutes)
5. See the formatted transcript with speaker names!

## Example Usage

### Via Web UI:
- Just drag & drop audio file
- Add speaker names if you know them
- Or enable "Auto-detect" to find names from transcript

### Via API:
```bash
curl -X POST http://localhost:3001/api/transcribe \
  -F "audio=@your-recording.mp3" \
  -F "speakerNames=Akshat,Shivay"
```

## Troubleshooting

**Error: "API key not configured"**
- Make sure you added API key to `.env` file
- Restart the server after adding key

**Error: "Transcription timeout"**
- Large files take longer
- Check your internet connection
- Try with a shorter audio file first

**No speaker names showing?**
- Add speaker names manually in the form
- Or enable "Auto-detect" checkbox
- Or provide "First Speaker Name"

## Features

✅ Speaker Diarization - Automatically identifies different speakers
✅ Speaker Identification - Maps to actual names
✅ Auto-detection - Finds names from transcript
✅ Turn-by-turn Format - Clean output
✅ Statistics - See who spoke how much

Enjoy! 🎉

