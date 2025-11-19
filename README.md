# Speaker-wise Transcription Tool

Ek standalone tool jo audio recordings ko speaker-wise transcribe karta hai with automatic speaker identification.

## Features

- 🎤 **Speaker Diarization**: Automatically identifies different speakers in audio
- 👤 **Speaker Identification**: Maps speakers to actual names (Akshat, Shivay, etc.)
- 📝 **Turn-by-turn Transcription**: Clean format with speaker names
- 🔍 **Multiple Strategies**: Uses participant names, hints, or auto-detection

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API keys:**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Get API Keys:**
   - **AssemblyAI** (Recommended): https://www.assemblyai.com/
   - **Deepgram** (Alternative): https://deepgram.com/

4. **Run the server:**
   ```bash
   npm run dev
   ```

## Usage

### API Endpoint

**POST** `/api/transcribe`

Upload an audio file and get speaker-wise transcription.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `audio`: Audio file (mp3, wav, m4a, ogg, webm, flac)
  - `speakerNames` (optional): Comma-separated list of speaker names
  - `firstSpeakerName` (optional): Name of first speaker

**Response:**
```json
{
  "success": true,
  "transcript": {
    "formatted": "Akshat: Hello, how are you?\n\nShivay: I'm good, thanks!",
    "segments": [...],
    "stats": {...},
    "fullText": "...",
    "language": "en",
    "duration": 120000
  }
}
```

### Example

```bash
curl -X POST http://localhost:3001/api/transcribe \
  -F "audio=@recording.mp3" \
  -F "speakerNames=Akshat,Shivay"
```

## How It Works

1. **Audio Upload**: User uploads audio file
2. **Transcription**: Audio is sent to AssemblyAI/Deepgram for transcription with speaker diarization
3. **Speaker Identification**: System maps speakers to names using:
   - User-provided speaker names
   - First speaker name
   - Auto-detection from transcript context
4. **Formatting**: Transcript is formatted as turn-by-turn conversation

## Tech Stack

- **Backend**: Express.js, TypeScript
- **Transcription**: AssemblyAI / Deepgram
- **File Upload**: Multer

