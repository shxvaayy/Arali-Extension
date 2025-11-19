# Environment Setup

Create a `.env` file in the root directory with the following:

```env
# AssemblyAI API Key (Recommended - better speaker diarization)
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Deepgram API Key (Alternative)
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=development
```

## Getting API Keys

### AssemblyAI (Recommended)
1. Go to https://www.assemblyai.com/
2. Sign up for free account
3. Get your API key from dashboard
4. Free tier includes 5 hours of transcription per month

### Deepgram (Alternative)
1. Go to https://deepgram.com/
2. Sign up for free account
3. Get your API key from dashboard
4. Free tier includes limited transcription

## Quick Start

1. Copy the example:
   ```bash
   cp ENV_SETUP.md .env
   # Then edit .env and add your API keys
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the server:
   ```bash
   npm run dev
   ```

4. Open browser:
   ```
   http://localhost:3001
   ```

