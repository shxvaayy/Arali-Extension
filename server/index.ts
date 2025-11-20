/**
 * Speaker Transcription Server
 * 
 * Standalone server for speaker-wise audio transcription
 */

import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { transcribeAudio, identifySpeakers, formatTranscript, getSpeakerStats, detectNamesFromTranscript } from './transcription.js';
import { transcribeAudioOpenSource, identifySpeakers as identifySpeakersOS, formatTranscript as formatTranscriptOS, getSpeakerStats as getSpeakerStatsOS, detectNamesFromTranscript as detectNamesFromTranscriptOS } from './open-source-transcription.js';

dotenv.config();

// Load HuggingFace token from .env
if (process.env.HUGGINGFACE_TOKEN) {
  process.env.HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
  process.env.HF_TOKEN = process.env.HUGGINGFACE_TOKEN; // Also set as HF_TOKEN for compatibility
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(mp3|wav|m4a|ogg|webm|flac)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Speaker Transcription API is running' });
});

// Main transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    console.log('🎤 Speaker transcription request received');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided. Please upload an audio file (mp3, wav, m4a, etc.)'
      });
    }

    console.log('📁 Audio file received:', {
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });

    // Get optional parameters
    const speakerNamesParam = req.body.speakerNames;
    const firstSpeakerName = req.body.firstSpeakerName;
    const autoDetect = req.body.autoDetect === 'true' || req.body.autoDetect === true;
    const useOpenSource = req.body.useOpenSource === 'true' || req.body.useOpenSource === true || process.env.USE_OPEN_SOURCE === 'true';

    // Parse speaker names
    let speakerNames: string[] | undefined;
    if (speakerNamesParam) {
      speakerNames = typeof speakerNamesParam === 'string' 
        ? speakerNamesParam.split(',').map((n: string) => n.trim()).filter(Boolean)
        : speakerNamesParam;
    }

    // Transcribe audio
    console.log('🔄 Starting transcription...');
    let transcriptionResult;
    
    if (useOpenSource) {
      console.log('📦 Using open source models (PyAnnote + Whisper)...');
      transcriptionResult = await transcribeAudioOpenSource(req.file.buffer, req.file.originalname);
    } else {
      console.log('☁️  Using API (AssemblyAI/Deepgram)...');
      transcriptionResult = await transcribeAudio(req.file.buffer, req.file.originalname);
    }

    console.log(`✅ Transcription completed: ${transcriptionResult.segments.length} segments`);

    // Auto-detect names from transcript (always try for open-source, optional for API)
    let detectedNameMap: { [speakerLabel: string]: string } = {};
    if (useOpenSource) {
      // For open-source, always try auto-detection
      detectedNameMap = detectNamesFromTranscriptOS(transcriptionResult.segments);
      if (Object.keys(detectedNameMap).length > 0) {
        console.log('🔍 Auto-detected speaker names:', detectedNameMap);
      }
    } else if (autoDetect && !speakerNames) {
      // For API, only if autoDetect flag is set
      const detectedNames = detectNamesFromTranscript(transcriptionResult.segments);
      if (detectedNames.length > 0) {
        speakerNames = detectedNames;
        console.log('🔍 Auto-detected speaker names:', detectedNames);
      }
    }

    // Identify speakers - use auto-detected names if available
    let identifiedSegments = transcriptionResult.segments;
    
    if (useOpenSource && Object.keys(detectedNameMap).length > 0) {
      // Use auto-detected names for open-source
      identifiedSegments = identifySpeakersOS(transcriptionResult.segments, detectedNameMap);
    } else if (speakerNames && speakerNames.length > 0) {
      // Map speakers sequentially: first speaker name -> first detected speaker, etc.
      const uniqueSpeakers = [...new Set(transcriptionResult.segments.map(s => s.speaker))].sort();
      const speakerMap: { [key: string]: string } = {};
      
      uniqueSpeakers.forEach((speakerLabel, index) => {
        if (index < speakerNames.length) {
          speakerMap[speakerLabel] = speakerNames[index];
        }
      });
      
      identifiedSegments = transcriptionResult.segments.map(segment => ({
        ...segment,
        speakerName: speakerMap[segment.speaker] || segment.speaker
      }));
    } else if (firstSpeakerName && transcriptionResult.segments.length > 0) {
      // Map first speaker only
      const firstSpeaker = transcriptionResult.segments[0].speaker;
      identifiedSegments = transcriptionResult.segments.map(segment => ({
        ...segment,
        speakerName: segment.speaker === firstSpeaker ? firstSpeakerName : segment.speaker
      }));
    } else {
      // Auto-detect if no names provided (for open-source)
      if (useOpenSource) {
        identifiedSegments = identifySpeakersOS(transcriptionResult.segments);
      } else {
        identifiedSegments = transcriptionResult.segments;
      }
    }

    // Format transcript (use appropriate function based on source)
    const formattedTranscript = useOpenSource 
      ? formatTranscriptOS(identifiedSegments)
      : formatTranscript(identifiedSegments);
    const speakerStats = useOpenSource
      ? getSpeakerStatsOS(identifiedSegments)
      : getSpeakerStats(identifiedSegments);

    res.json({
      success: true,
      transcript: {
        formatted: formattedTranscript,
        segments: identifiedSegments,
        stats: speakerStats,
        fullText: transcriptionResult.fullText,
        language: transcriptionResult.language,
        duration: transcriptionResult.duration,
      },
      message: 'Transcription completed successfully'
    });

  } catch (error: any) {
    console.error('❌ Transcription error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe audio',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Speaker Transcription Server running on http://localhost:${PORT}`);
  console.log(`📝 API endpoint: POST http://localhost:${PORT}/api/transcribe`);
  
  if (!process.env.ASSEMBLYAI_API_KEY && !process.env.DEEPGRAM_API_KEY) {
    console.warn('⚠️  WARNING: No API key configured. Please set ASSEMBLYAI_API_KEY or DEEPGRAM_API_KEY in .env file');
  }
});

