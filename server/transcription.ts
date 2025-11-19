/**
 * Speaker-wise Transcription Service
 * 
 * Handles audio transcription with speaker diarization and identification
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const USE_ASSEMBLYAI = !DEEPGRAM_API_KEY || ASSEMBLYAI_API_KEY;

export interface SpeakerSegment {
  speaker: string; // Speaker label (e.g., "A", "B", "Speaker 0")
  speakerName?: string; // Actual name (e.g., "Akshat", "Shivay")
  text: string;
  start: number; // Start time in milliseconds
  end: number; // End time in milliseconds
  confidence: number;
}

export interface TranscriptionResult {
  segments: SpeakerSegment[];
  fullText: string;
  language?: string;
  duration?: number;
}

/**
 * Upload audio file to AssemblyAI
 */
async function uploadAudioToAssemblyAI(audioBuffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append('file', audioBuffer, {
    filename: filename,
    contentType: 'audio/mpeg'
  });

  const response = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'authorization': ASSEMBLYAI_API_KEY,
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AssemblyAI upload failed: ${error}`);
  }

  const data = await response.json();
  return data.upload_url;
}

/**
 * Transcribe with AssemblyAI (better speaker diarization)
 */
async function transcribeWithAssemblyAI(audioUrl: string): Promise<TranscriptionResult> {
  // Submit transcription job
  const submitResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'authorization': ASSEMBLYAI_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true, // Enable speaker diarization
      language_detection: true,
    }),
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`AssemblyAI transcription submission failed: ${error}`);
  }

  const { id } = await submitResponse.json();

  // Poll for results
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    const transcriptResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
      },
    });

    if (!transcriptResponse.ok) {
      throw new Error(`Failed to get transcript status`);
    }

    const transcript = await transcriptResponse.json();

    if (transcript.status === 'completed') {
      const segments: SpeakerSegment[] = transcript.utterances?.map((utterance: any) => ({
        speaker: utterance.speaker,
        text: utterance.text,
        start: Math.round(utterance.start),
        end: Math.round(utterance.end),
        confidence: utterance.confidence || 0.9,
      })) || [];

      return {
        segments,
        fullText: transcript.text || '',
        language: transcript.language_code,
        duration: transcript.audio_duration ? Math.round(transcript.audio_duration * 1000) : undefined,
      };
    } else if (transcript.status === 'error') {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }

    attempts++;
  }

  throw new Error('Transcription timeout - took too long to complete');
}

/**
 * Transcribe with Deepgram
 */
async function transcribeWithDeepgram(audioBuffer: Buffer, filename: string): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append('file', audioBuffer, {
    filename: filename,
    contentType: 'audio/mpeg'
  });

  const response = await fetch('https://api.deepgram.com/v1/listen?diarize=true&punctuate=true&language=auto', {
    method: 'POST',
    headers: {
      'authorization': `Token ${DEEPGRAM_API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Deepgram transcription failed: ${error}`);
  }

  const data = await response.json();
  const results = data.results;

  if (!results || !results.channels || !results.channels[0]) {
    throw new Error('No transcription results from Deepgram');
  }

  const channel = results.channels[0];
  const segments: SpeakerSegment[] = [];

  if (channel.alternatives && channel.alternatives[0]) {
    const words = channel.alternatives[0].words || [];
    
    // Group words by speaker
    let currentSpeaker: string | null = null;
    let currentSegment: { speaker: string; text: string[]; start: number; end: number } | null = null;

    for (const word of words) {
      const speaker = word.speaker?.toString() || '0';
      
      if (speaker !== currentSpeaker) {
        if (currentSegment) {
          segments.push({
            speaker: currentSegment.speaker,
            text: currentSegment.text.join(' '),
            start: Math.round(currentSegment.start * 1000),
            end: Math.round(currentSegment.end * 1000),
            confidence: 0.9,
          });
        }

        currentSpeaker = speaker;
        currentSegment = {
          speaker: `Speaker ${speaker}`,
          text: [word.word],
          start: word.start,
          end: word.end,
        };
      } else {
        if (currentSegment) {
          currentSegment.text.push(word.word);
          currentSegment.end = word.end;
        }
      }
    }

    if (currentSegment) {
      segments.push({
        speaker: currentSegment.speaker,
        text: currentSegment.text.join(' '),
        start: Math.round(currentSegment.start * 1000),
        end: Math.round(currentSegment.end * 1000),
        confidence: 0.9,
      });
    }
  }

  return {
    segments,
    fullText: channel.alternatives?.[0]?.transcript || '',
    language: results.metadata?.language,
    duration: results.metadata?.duration ? Math.round(results.metadata.duration * 1000) : undefined,
  };
}

/**
 * Main transcription function
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  options?: {
    useService?: 'assemblyai' | 'deepgram';
  }
): Promise<TranscriptionResult> {
  if (options?.useService === 'deepgram' || (!USE_ASSEMBLYAI && DEEPGRAM_API_KEY)) {
    if (!DEEPGRAM_API_KEY) {
      throw new Error('Deepgram API key not configured');
    }
    return transcribeWithDeepgram(audioBuffer, filename);
  } else {
    if (!ASSEMBLYAI_API_KEY) {
      throw new Error('AssemblyAI API key not configured. Add ASSEMBLYAI_API_KEY to your .env file');
    }
    
    const audioUrl = await uploadAudioToAssemblyAI(audioBuffer, filename);
    return transcribeWithAssemblyAI(audioUrl);
  }
}

/**
 * Identify speakers by mapping labels to names
 */
export function identifySpeakers(
  segments: SpeakerSegment[],
  speakerNames?: string[] | { [speakerLabel: string]: string }
): SpeakerSegment[] {
  if (!speakerNames || segments.length === 0) {
    return segments;
  }

  // If speakerNames is an array, map sequentially
  if (Array.isArray(speakerNames)) {
    const speakerMap: { [key: string]: string } = {};
    const uniqueSpeakers = [...new Set(segments.map(s => s.speaker))].sort();
    
    uniqueSpeakers.forEach((speakerLabel, index) => {
      if (index < speakerNames.length) {
        speakerMap[speakerLabel] = speakerNames[index];
      }
    });

    return segments.map(segment => ({
      ...segment,
      speakerName: speakerMap[segment.speaker] || segment.speaker,
    }));
  } else {
    // If speakerNames is an object mapping speaker labels to names
    return segments.map(segment => ({
      ...segment,
      speakerName: speakerNames[segment.speaker] || segment.speaker,
    }));
  }
}

/**
 * Auto-detect speaker names from transcript context
 */
export function detectNamesFromTranscript(segments: SpeakerSegment[]): string[] {
  const detectedNames: string[] = [];
  const namePatterns = [
    /(?:hi|hello|hey)[,\s]+(?:i'?m|i am|this is)\s+([A-Z][a-z]+)/i,
    /(?:i'?m|i am|this is)\s+([A-Z][a-z]+)/i,
    /(?:speaking|here)[,\s]+(?:i'?m|i am)\s+([A-Z][a-z]+)/i,
  ];

  const introSegments = segments.slice(0, Math.min(5, segments.length));
  
  for (const segment of introSegments) {
    for (const pattern of namePatterns) {
      const match = segment.text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 2 && !detectedNames.includes(name)) {
          detectedNames.push(name);
        }
      }
    }
  }

  return detectedNames;
}

/**
 * Format transcript as turn-by-turn text with speaker names
 */
export function formatTranscript(segments: SpeakerSegment[]): string {
  return segments
    .map(segment => {
      const speakerName = segment.speakerName || segment.speaker;
      return `${speakerName}: ${segment.text}`;
    })
    .join('\n\n');
}

/**
 * Get speaker statistics
 */
export function getSpeakerStats(segments: SpeakerSegment[]): {
  [speakerName: string]: {
    segments: number;
    totalWords: number;
    totalTime: number; // milliseconds
  }
} {
  const stats: { [key: string]: { segments: number; totalWords: number; totalTime: number } } = {};

  segments.forEach(segment => {
    const speakerName = segment.speakerName || segment.speaker;
    if (!stats[speakerName]) {
      stats[speakerName] = { segments: 0, totalWords: 0, totalTime: 0 };
    }

    stats[speakerName].segments += 1;
    stats[speakerName].totalWords += segment.text.split(/\s+/).length;
    stats[speakerName].totalTime += (segment.end - segment.start);
  });

  return stats;
}

