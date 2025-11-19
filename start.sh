#!/bin/bash

echo "🚀 Starting Speaker Transcription Server..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating .env file from template..."
    cat > .env << EOF
# AssemblyAI API Key (Recommended - better speaker diarization)
# Get your key from: https://www.assemblyai.com/
ASSEMBLYAI_API_KEY=

# Deepgram API Key (Alternative)
# Get your key from: https://deepgram.com/
DEEPGRAM_API_KEY=

# Server Configuration
PORT=3001
NODE_ENV=development
EOF
    echo "✅ .env file created!"
    echo ""
    echo "⚠️  IMPORTANT: Please add your API key to .env file before running!"
    echo "   Edit .env and add either ASSEMBLYAI_API_KEY or DEEPGRAM_API_KEY"
    echo ""
    read -p "Press Enter to continue anyway, or Ctrl+C to exit and add API key..."
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🎯 Starting server..."
echo "📝 Open http://localhost:3001 in your browser"
echo ""

npm run dev

