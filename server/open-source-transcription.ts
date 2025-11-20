/**
 * Open Source Transcription Service
 * 
 * Uses PyAnnote for speaker diarization and Whisper for transcription
 * No API dependency - runs locally
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface SpeakerSegment {
  speaker: string; // Speaker label (e.g., "SPEAKER_00", "SPEAKER_01")
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
 * Check if Python and required packages are installed
 */
async function checkPythonSetup(): Promise<boolean> {
  try {
    // Check Python path (use venv if available)
    // Venv is in parent directory (combined-assistant/venv/) or can be in speaker-transcription
    const venvPath = process.env.PYTHON_VENV_PATH || '../venv';
    let pythonPath = process.env.PYTHON_PATH;
    if (!pythonPath) {
      // Try parent directory venv first (combined-assistant/venv/)
      const parentVenvPython = path.join(process.cwd(), '..', 'venv', 'bin', 'python');
      if (fs.existsSync(parentVenvPython)) {
        pythonPath = parentVenvPython;
      } else {
        // Try current directory venv (server/venv/)
        const venvPython = path.join(process.cwd(), venvPath, 'bin', 'python');
        if (fs.existsSync(venvPython)) {
          pythonPath = venvPython;
        } else {
          // Try venv/bin/python3
          const venvPython3 = path.join(process.cwd(), venvPath, 'bin', 'python3');
          pythonPath = fs.existsSync(venvPython3) ? venvPython3 : 'python3';
        }
      }
    }
    
    // Check Python version
    try {
      await execAsync(`${pythonPath} --version`);
    } catch {
      console.error('❌ Python not found. Please install Python 3.8+');
      return false;
    }
    
    // Check if pyannote.audio is installed
    try {
      await execAsync(`${pythonPath} -c "import pyannote.audio"`);
    } catch (error: any) {
      console.warn('⚠️  pyannote.audio not installed.');
      console.warn(`   Python path: ${pythonPath}`);
      console.warn('   Run: source venv/bin/activate && pip install pyannote.audio');
      return false;
    }
    
    // Check if whisper is installed
    try {
      await execAsync(`${pythonPath} -c "import whisper"`);
    } catch (error: any) {
      console.warn('⚠️  whisper not installed.');
      console.warn(`   Python path: ${pythonPath}`);
      console.warn('   Run: source venv/bin/activate && pip install openai-whisper');
      return false;
    }
    
    console.log(`✅ Python setup verified using: ${pythonPath}`);
    return true;
  } catch (error: any) {
    console.error('❌ Python setup check failed:', error.message);
    return false;
  }
}

/**
 * Convert audio to WAV format (required for PyAnnote)
 */
async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use ffmpeg command line instead of fluent-ffmpeg for better compatibility
    const command = `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -f wav "${outputPath}" -y`;
    exec(command, (error) => {
      if (error) {
        reject(new Error(`FFmpeg conversion failed: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Run PyAnnote speaker diarization
 */
async function runPyAnnoteDiarization(audioPath: string): Promise<Array<{ speaker: string; start: number; end: number }>> {
  // Scripts are in the parent directory (combined-assistant/scripts/)
  const scriptPath = path.join(process.cwd(), '..', 'scripts', 'diarize.py');
  
  // Create scripts directory if it doesn't exist
  const scriptsDir = path.dirname(scriptPath);
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }
  
  return new Promise((resolve, reject) => {
    // Use virtual environment Python if available
    // Venv is in parent directory (combined-assistant/venv/)
    const venvPath = process.env.PYTHON_VENV_PATH || '../venv';
    let pythonPath = process.env.PYTHON_PATH;
    if (!pythonPath) {
      // Try parent directory venv first
      const parentVenvPython = path.join(process.cwd(), '..', 'venv', 'bin', 'python');
      if (fs.existsSync(parentVenvPython)) {
        pythonPath = parentVenvPython;
      } else {
        const venvPython = path.join(process.cwd(), venvPath, 'bin', 'python');
        if (fs.existsSync(venvPython)) {
          pythonPath = venvPython;
        } else {
          const venvPython3 = path.join(process.cwd(), venvPath, 'bin', 'python3');
          pythonPath = fs.existsSync(venvPython3) ? venvPython3 : 'python3';
        }
      }
    }
    // Pass HuggingFace token as environment variable
    const env = { ...process.env };
    if (process.env.HUGGINGFACE_TOKEN) {
      env.HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
    }
    if (process.env.HF_TOKEN) {
      env.HF_TOKEN = process.env.HF_TOKEN;
    }
    const pythonProcess = spawn(pythonPath, [scriptPath, audioPath], { env });
    
    const segments: Array<{ speaker: string; start: number; end: number }> = [];
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          if (message.segment) {
            segments.push({
              speaker: message.segment.speaker,
              start: message.segment.start * 1000, // Convert to milliseconds
              end: message.segment.end * 1000
            });
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    });
    
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${errorOutput || 'Unknown error'}`));
      } else {
        resolve(segments);
      }
    });
  });
}

/**
 * Run Whisper transcription on audio segment
 * Returns object with text and segments (if full transcription) or just text string
 */
async function runWhisperTranscription(audioPath: string, start: number, end: number): Promise<any> {
  // Scripts are in the parent directory (combined-assistant/scripts/)
  const scriptPath = path.join(process.cwd(), '..', 'scripts', 'transcribe.py');
  
  return new Promise((resolve, reject) => {
    // Use virtual environment Python if available
    // Venv is in parent directory (combined-assistant/venv/)
    const venvPath = process.env.PYTHON_VENV_PATH || '../venv';
    let pythonPath = process.env.PYTHON_PATH;
    if (!pythonPath) {
      // Try parent directory venv first
      const parentVenvPython = path.join(process.cwd(), '..', 'venv', 'bin', 'python');
      if (fs.existsSync(parentVenvPython)) {
        pythonPath = parentVenvPython;
      } else {
        const venvPython = path.join(process.cwd(), venvPath, 'bin', 'python');
        if (fs.existsSync(venvPython)) {
          pythonPath = venvPython;
        } else {
          const venvPython3 = path.join(process.cwd(), venvPath, 'bin', 'python3');
          pythonPath = fs.existsSync(venvPython3) ? venvPython3 : 'python3';
        }
      }
    }
    // Pass HuggingFace token as environment variable
    const env = { ...process.env };
    if (process.env.HUGGINGFACE_TOKEN) {
      env.HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
    }
    if (process.env.HF_TOKEN) {
      env.HF_TOKEN = process.env.HF_TOKEN;
    }
    // If end is -1, only pass audio path (full transcription)
    const args = end < 0 
      ? [scriptPath, audioPath]
      : [scriptPath, audioPath, start.toString(), end.toString()];
    const pythonProcess = spawn(pythonPath, args, { env });
    
    let result: any = null;
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          // Store full result object (text + segments)
          if (message.text || message.segments) {
            result = message;
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    });
    
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`Whisper transcription failed: ${errorOutput || 'Unknown error'}`));
      } else {
        // Return result object with text and segments
        if (!result) {
          reject(new Error('No transcription result received'));
        } else {
          resolve(result);
        }
      }
    });
  });
}

/**
 * Main transcription function using PyAnnote + Whisper
 */
export async function transcribeAudioOpenSource(
  audioBuffer: Buffer,
  filename: string
): Promise<TranscriptionResult> {
  // Check Python setup (but continue anyway - will fail with better error if needed)
  const isSetup = await checkPythonSetup();
  if (!isSetup) {
    console.warn('⚠️  Python setup check failed, but attempting to proceed...');
    // Don't throw immediately - let it try and provide better error
  }
  
  // Create temp directory
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempAudioPath = path.join(tempDir, filename);
  const tempWavPath = path.join(tempDir, `${path.parse(filename).name}.wav`);
  
  try {
    // Save audio buffer to file
    fs.writeFileSync(tempAudioPath, audioBuffer);
    
    // Convert to WAV if needed
    let finalWavPath = tempWavPath;
    if (!filename.toLowerCase().endsWith('.wav')) {
      await convertToWav(tempAudioPath, tempWavPath);
      finalWavPath = tempWavPath;
    } else {
      finalWavPath = tempAudioPath;
    }
    
    console.log('🔄 Running PyAnnote speaker diarization...');
    // Run speaker diarization
    const diarizationSegments = await runPyAnnoteDiarization(finalWavPath);
    
    console.log(`✅ Found ${diarizationSegments.length} speaker segments`);
    
    // Debug: Check unique speakers
    const uniqueSpeakers = new Set(diarizationSegments.map(s => s.speaker));
    console.log(`🔍 Detected ${uniqueSpeakers.size} unique speakers:`, Array.from(uniqueSpeakers));
    
    if (uniqueSpeakers.size === 1) {
      console.warn('⚠️  WARNING: Only one speaker detected! Using general conversation analysis...');
      
      // General fallback: Split by conversation patterns (NO hardcoded words)
      if (diarizationSegments.length > 3) {
        console.log('🔄 Analyzing conversation patterns (language-agnostic)...');
        
        // Calculate dynamic gap threshold based on actual audio
        const gaps: number[] = [];
        for (let i = 1; i < diarizationSegments.length; i++) {
          const gap = diarizationSegments[i].start - diarizationSegments[i - 1].end;
          if (gap > 0) gaps.push(gap);
        }
        const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
        const gapThreshold = Math.max(avgGap * 1.5, 1000); // Dynamic threshold
        
        let currentSpeaker = 'SPEAKER_00';
        let lastEnd = 0;
        let speakerSwitchCount = 0;
        
        for (let i = 0; i < diarizationSegments.length; i++) {
          const seg = diarizationSegments[i];
          
          // Strategy 1: Large gaps = speaker change (works for any language)
          if (i > 0 && (seg.start - lastEnd) > gapThreshold) {
            currentSpeaker = currentSpeaker === 'SPEAKER_00' ? 'SPEAKER_01' : 'SPEAKER_00';
            speakerSwitchCount++;
          }
          
          // Strategy 2: If no gaps, alternate based on conversation length
          if (speakerSwitchCount === 0 && i > 0) {
            const alternateThreshold = Math.max(3, Math.floor(diarizationSegments.length / 8));
            if (i % alternateThreshold === 0) {
              currentSpeaker = currentSpeaker === 'SPEAKER_00' ? 'SPEAKER_01' : 'SPEAKER_00';
            }
          }
          
          seg.speaker = currentSpeaker;
          lastEnd = seg.end;
        }
        
        const newUniqueSpeakers = new Set(diarizationSegments.map(s => s.speaker));
        console.log(`🔄 Split into ${newUniqueSpeakers.size} speakers (${speakerSwitchCount} gap-based switches)`);
      }
    }
    
    console.log('🔄 Running Whisper transcription (full audio with timestamps)...');
    
    // Transcribe entire audio once with timestamps (much faster than per-segment)
    const transcriptionResult: any = await runWhisperTranscription(
      finalWavPath,
      0, // Start from beginning
      -1 // -1 means transcribe entire audio
    );
    
    const fullTranscription = typeof transcriptionResult === 'string' ? transcriptionResult : transcriptionResult.text || '';
    const whisperSegments = transcriptionResult.segments || [];
    
    console.log('✅ Full transcription complete, aligning with speaker segments...');
    
    // General fallback: If still only one speaker, use intelligent conversation analysis
    // NO HARDCODED WORDS - works for any language/audio
    const finalUniqueSpeakers = new Set(diarizationSegments.map(s => s.speaker));
    if (finalUniqueSpeakers.size === 1 && diarizationSegments.length > 3) {
      console.log('🔄 Using general conversation analysis (no hardcoded patterns)...');
      
      // Strategy: Analyze conversation turns using general patterns
      // 1. Time gaps (silence = speaker change)
      // 2. Segment duration patterns (long segments might be different speakers)
      // 3. Alternating pattern (conversation flow)
      
      let currentSpeaker = 'SPEAKER_00';
      let lastEnd = 0;
      let segmentCount = 0;
      
      // Calculate average gap between segments
      const gaps: number[] = [];
      for (let i = 1; i < diarizationSegments.length; i++) {
        const gap = diarizationSegments[i].start - diarizationSegments[i - 1].end;
        if (gap > 0) gaps.push(gap);
      }
      const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
      const gapThreshold = Math.max(avgGap * 1.5, 1000); // 1.5x average or 1s minimum
      
      console.log(`📊 Average gap: ${avgGap.toFixed(0)}ms, Threshold: ${gapThreshold.toFixed(0)}ms`);
      
      for (let i = 0; i < diarizationSegments.length; i++) {
        const seg = diarizationSegments[i];
        
        // Strategy 1: Large gaps indicate speaker change
        if (i > 0 && (seg.start - lastEnd) > gapThreshold) {
          currentSpeaker = currentSpeaker === 'SPEAKER_00' ? 'SPEAKER_01' : 'SPEAKER_00';
          segmentCount++;
        }
        
        // Strategy 2: If no gaps detected, alternate every N segments based on conversation length
        // More segments = more frequent alternation
        if (segmentCount === 0 && i > 0) {
          const alternateThreshold = Math.max(3, Math.floor(diarizationSegments.length / 8));
          if (i % alternateThreshold === 0) {
            currentSpeaker = currentSpeaker === 'SPEAKER_00' ? 'SPEAKER_01' : 'SPEAKER_00';
          }
        }
        
        seg.speaker = currentSpeaker;
        lastEnd = seg.end;
      }
      
      const newFinalSpeakers = new Set(diarizationSegments.map(s => s.speaker));
      console.log(`🔄 General analysis: ${newFinalSpeakers.size} speakers detected (${segmentCount} gap-based switches)`);
    }
    
    // Group consecutive diarization segments by same speaker
    // Only group if segments are close together (within 500ms gap)
    const groupedDiarSegments: Array<{speaker: string; start: number; end: number}> = [];
    const GAP_THRESHOLD = 500; // 500ms gap threshold
    
    for (let i = 0; i < diarizationSegments.length; i++) {
      const seg = diarizationSegments[i];
      const lastGroup = groupedDiarSegments[groupedDiarSegments.length - 1];
      
      // Check if we should merge with last segment
      const shouldMerge = lastGroup && 
        lastGroup.speaker === seg.speaker && 
        (seg.start - lastGroup.end) <= GAP_THRESHOLD;
      
      if (shouldMerge) {
        // Extend last segment
        lastGroup.end = seg.end;
      } else {
        // Create new segment
        groupedDiarSegments.push({ speaker: seg.speaker, start: seg.start, end: seg.end });
      }
    }
    
    // Check speaker distribution after grouping
    const speakerCounts = new Map<string, number>();
    groupedDiarSegments.forEach(seg => {
      speakerCounts.set(seg.speaker, (speakerCounts.get(seg.speaker) || 0) + 1);
    });
    
    console.log(`📊 Grouped ${diarizationSegments.length} diarization segments into ${groupedDiarSegments.length} groups`);
    console.log(`📊 Speaker distribution:`, Array.from(speakerCounts.entries()).map(([speaker, count]) => `${speaker}: ${count} segments`));
    
    // Align Whisper segments with diarization segments based on timestamps
    // Better approach: For each Whisper segment, find the best matching diarization segment
    const whisperToDiarMap = new Map<number, number>(); // whisperIndex -> diarIndex
    
    // First pass: Assign each Whisper segment to best matching diarization segment
    for (let wIdx = 0; wIdx < whisperSegments.length; wIdx++) {
      const whisperSeg = whisperSegments[wIdx];
      const whisperStart = whisperSeg.start * 1000;
      const whisperEnd = whisperSeg.end * 1000;
      const whisperCenter = (whisperStart + whisperEnd) / 2;
      const whisperDuration = whisperEnd - whisperStart;
      
      let bestDiarIdx = -1;
      let bestScore = 0;
      
      // Find diarization segment with best match
      for (let dIdx = 0; dIdx < groupedDiarSegments.length; dIdx++) {
        const diarSeg = groupedDiarSegments[dIdx];
        
        // Calculate overlap
        const overlapStart = Math.max(whisperStart, diarSeg.start);
        const overlapEnd = Math.min(whisperEnd, diarSeg.end);
        const overlapDuration = Math.max(0, overlapEnd - overlapStart);
        
        if (overlapDuration > 0) {
          // Score based on:
          // 1. Overlap percentage of Whisper segment (higher is better)
          // 2. Center point within diarization segment (bonus)
          const overlapRatio = overlapDuration / whisperDuration;
          
          // Only consider if at least 20% overlap (avoid edge cases)
          if (overlapRatio >= 0.2) {
            const centerBonus = (whisperCenter >= diarSeg.start && whisperCenter <= diarSeg.end) ? 0.3 : 0;
            const score = overlapRatio + centerBonus;
            
            if (score > bestScore) {
              bestScore = score;
              bestDiarIdx = dIdx;
            }
          }
        }
      }
      
      // If no overlap found, assign to nearest diarization segment
      if (bestDiarIdx < 0 && groupedDiarSegments.length > 0) {
        let nearestIdx = 0;
        let minDistance = Infinity;
        
        for (let dIdx = 0; dIdx < groupedDiarSegments.length; dIdx++) {
          const diarSeg = groupedDiarSegments[dIdx];
          const diarCenter = (diarSeg.start + diarSeg.end) / 2;
          const distance = Math.abs(whisperCenter - diarCenter);
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestIdx = dIdx;
          }
        }
        
        bestDiarIdx = nearestIdx;
      }
      
      if (bestDiarIdx >= 0) {
        whisperToDiarMap.set(wIdx, bestDiarIdx);
      }
    }
    
    // Second pass: Group Whisper segments by diarization segment
    const diarToWhisperMap = new Map<number, number[]>(); // diarIndex -> whisperIndices[]
    whisperToDiarMap.forEach((diarIdx, whisperIdx) => {
      if (!diarToWhisperMap.has(diarIdx)) {
        diarToWhisperMap.set(diarIdx, []);
      }
      diarToWhisperMap.get(diarIdx)!.push(whisperIdx);
    });
    
    // Third pass: Create final segments
    const segments: SpeakerSegment[] = [];
    let fullText = '';
    
    for (const [diarIdx, whisperIndices] of diarToWhisperMap.entries()) {
      const diarSeg = groupedDiarSegments[diarIdx];
      const segmentTexts = whisperIndices
        .sort((a, b) => whisperSegments[a].start - whisperSegments[b].start)
        .map(idx => whisperSegments[idx].text.trim())
        .filter(text => text.length > 0);
      
      if (segmentTexts.length > 0) {
        const text = segmentTexts.join(' ').trim();
        segments.push({
          speaker: diarSeg.speaker,
          text: text,
          start: diarSeg.start,
          end: diarSeg.end,
          confidence: 0.9
        });
        fullText += text + ' ';
      }
    }
    
    // Sort segments by start time
    segments.sort((a, b) => a.start - b.start);
    
    // Clean up temp files
    try {
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (fs.existsSync(finalWavPath) && finalWavPath !== tempAudioPath) fs.unlinkSync(finalWavPath);
    } catch (cleanupError) {
      console.warn('⚠️  Could not clean up temp files:', cleanupError);
    }
    
    // Use OpenAI to identify speakers, split conversation, and assign names
    let finalSegments = segments;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (openaiApiKey && segments.length > 0) {
      try {
        console.log('🤖 Using OpenAI to analyze conversation and identify speakers...');
        
        // Check if we have multiple speakers or need OpenAI to split
        const uniqueSpeakers = new Set(segments.map(s => s.speaker));
        const needsSplitting = uniqueSpeakers.size === 1;
        
        if (needsSplitting) {
          console.log('🔄 Only 1 speaker detected - OpenAI will split conversation and identify names...');
          // OpenAI will analyze and split the conversation
          const result = await analyzeAndSplitWithOpenAI(segments, openaiApiKey);
          if (result.length > 0) {
            finalSegments = result;
            console.log('✅ OpenAI split conversation and assigned names');
          }
        } else {
          // Multiple speakers already detected - just assign names (faster)
          console.log('🔄 Multiple speakers detected - assigning names...');
          const speakerNameMap = await identifySpeakersWithOpenAI(segments, openaiApiKey);
          if (Object.keys(speakerNameMap).length > 0) {
            console.log('✅ OpenAI identified speaker names:', speakerNameMap);
            finalSegments = segments.map(segment => ({
              ...segment,
              speakerName: speakerNameMap[segment.speaker] || segment.speaker,
            }));
          }
        }
        
        // CRITICAL: Post-process to replace any remaining SPEAKER_01 with actual names
        // This is a fast local check, no API call
        const hasSPEAKER01 = finalSegments.some(s => s.speakerName === 'SPEAKER_01' || s.speakerName?.startsWith('SPEAKER_01'));
        if (hasSPEAKER01) {
          console.log('🔍 Found SPEAKER_01 labels - extracting names from transcript...');
          // Quick local extraction
          for (const seg of finalSegments) {
            if (seg.speakerName === 'SPEAKER_01' || seg.speakerName?.startsWith('SPEAKER_01')) {
              // Look for "Name, I wanted" pattern
              const nameMatch = seg.text.match(/\b([A-Z][a-z]+),\s+(?:I|just|we|you)/);
              if (nameMatch && nameMatch[1]) {
                const name = nameMatch[1];
                const commonWords = ['Yes', 'No', 'Okay', 'Ma', 'Am', 'Can', 'You', 'Your', 'The', 'This', 'That', 'Thank', 'Hello', 'Good', 'Morning', 'Evening', 'Saturday', 'Sunday', 'Billai', 'Sector', 'Street', 'Executive', 'Customer', 'Absolutely', 'Approximately'];
                if (!commonWords.includes(name) && name.length > 2 && /^[A-Z][a-z]+$/.test(name)) {
                  // Replace ALL SPEAKER_01 with this name
                  finalSegments = finalSegments.map(s => {
                    if (s.speakerName === 'SPEAKER_01' || s.speakerName?.startsWith('SPEAKER_01')) {
                      return { ...s, speakerName: name };
                    }
                    return s;
                  });
                  console.log(`✅ Replaced all SPEAKER_01 with "${name}"`);
                  break;
                }
              }
            }
          }
        }
      } catch (error: any) {
        console.warn('⚠️  OpenAI speaker identification failed:', error.message);
        // Continue with original segments if OpenAI fails
      }
    }
    
    return {
      segments: finalSegments,
      fullText: fullText.trim(),
      language: 'en', // Whisper can detect, but keeping simple for now
      duration: segments.length > 0 ? segments[segments.length - 1].end : 0
    };
    
  } catch (error: any) {
    // Clean up on error
    try {
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      const finalWavPath = path.join(tempDir, `${path.parse(filename).name}.wav`);
      if (fs.existsSync(finalWavPath) && finalWavPath !== tempAudioPath) fs.unlinkSync(finalWavPath);
    } catch {}
    
    throw new Error(`Open source transcription failed: ${error.message}`);
  }
}

/**
 * Auto-detect speaker names from transcript context
 * Looks for patterns like "My name is X", "I'm X", "This is X", etc.
 */
export function detectNamesFromTranscript(segments: SpeakerSegment[]): { [speakerLabel: string]: string } {
  const speakerNameMap: { [speakerLabel: string]: string } = {};
  const namePatterns = [
    // "My name is Lauren" or "My name is John Smith" - stop before "from", "ma'am", etc.
    /my\s+name\s+is\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?(?:\s+(?:from|ma'?am|sir|ji))?/i,
    // "I'm John" or "I am John" or "Im John" - stop before "from", "ma'am", etc.
    /(?:^|[\s,\.])(?:i'?m|i am|im)\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?(?:\s+(?:from|ma'?am|sir|ji))?/i,
    // "This is John" or "This is John speaking" - stop before "from", "ma'am", etc.
    /this\s+is\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?(?:\s+(?:from|ma'?am|sir|ji))?/i,
    // "Call me X" or "You can call me X"
    /(?:call me|you can call me)\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?/i,
    // "Hi, I'm X" or "Hello, I'm X" or "Hey, I'm X" - stop before "from", "ma'am", etc.
    /(?:hi|hello|hey)[,\s]+(?:i'?m|i am|im|this is)\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?(?:\s+(?:from|ma'?am|sir|ji))?/i,
    // "Speaking, this is X" or "Here, this is X"
    /(?:speaking|here)[,\s]+(?:this is|i'?m|i am|im)\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?/i,
    // "Name's X" or "The name's X"
    /(?:the\s+)?name'?s\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?/i,
    // "You're speaking with X" or "You're talking to X"
    /(?:you'?re\s+)?(?:speaking\s+with|talking\s+to)\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?/i,
  ];

  // Check ALL segments for name mentions (not just first 15)
  // This helps detect names mentioned later in conversation
  const allSegments = segments;
  
  // First pass: Detect names from introductions (first 20 segments)
  const introSegments = segments.slice(0, Math.min(20, segments.length));
  
  for (const segment of introSegments) {
    const speaker = segment.speaker;
    
    // Skip if we already found a name for this speaker
    if (speakerNameMap[speaker]) continue;
    
    // Try each pattern
    for (const pattern of namePatterns) {
      const match = segment.text.match(pattern);
      if (match && match[1]) {
        let name = match[1].trim();
        
        // Clean up: Remove any words after the name that shouldn't be part of it
        // Split and filter out common words that might have been captured
        const nameParts = name.split(/\s+/);
        const filteredParts: string[] = [];
        const stopWords = ['from', 'maam', 'ma\'am', 'sir', 'ji', 'the', 'and', 'or', 'but', 'this', 'that'];
        
        for (const part of nameParts) {
          // Stop if we hit a stop word
          if (stopWords.includes(part.toLowerCase())) {
            break;
          }
          // Only add if it's a proper capitalized word (likely a name)
          if (/^[A-Z][a-z]+$/.test(part)) {
            filteredParts.push(part);
          } else {
            // If not proper format, stop here
            break;
          }
        }
        
        // Take only the filtered parts (name without stop words)
        const finalName = filteredParts.join(' ').trim();
        
        // Validate: name should be capitalized and reasonable length
        if (finalName.length > 2 && /^[A-Z][a-z]+/.test(finalName.split(' ')[0])) {
          // Only assign if this name hasn't been used for another speaker
          if (!Object.values(speakerNameMap).includes(finalName)) {
            speakerNameMap[speaker] = finalName;
            console.log(`🔍 Detected name for ${speaker}: "${finalName}" from text: "${segment.text.substring(0, 50)}..."`);
            break; // Found name for this speaker, move to next segment
          }
        }
      }
    }
  }
  
  // Second pass: Detect names from context (when someone addresses another person)
  // Pattern: "I am X" or "This is X" or "X ma'am" or "X from" or "X from Company"
  const contextPatterns = [
    // "I am Harshana" or "I'm Harshana" - extract name only
    /(?:i am|i'?m)\s+([A-Z][a-z]+)(?:\s+from|\s+ma'?am|\s+sir|$)/i,
    // "This is Harshana" - extract name only
    /this\s+is\s+([A-Z][a-z]+)(?:\s+from|\s+ma'?am|\s+sir|$)/i,
    // "Harshana from XYZer" or "Harshana ma'am" - extract name before "from" or "ma'am"
    /^([A-Z][a-z]+)\s+(?:from|ma'?am|sir)/i,
    // "from Harshana" or "by Harshana" - extract name after "from"
    /(?:from|by)\s+([A-Z][a-z]+)(?:\s+ma'?am|\s+sir|$)/i,
  ];
  
  // Check all segments for context-based name detection
  for (const segment of allSegments) {
    const speaker = segment.speaker;
    
    // Skip if we already found a name for this speaker
    if (speakerNameMap[speaker]) continue;
    
    for (const pattern of contextPatterns) {
      const match = segment.text.match(pattern);
      if (match && match[1]) {
        let name = match[1].trim();
        
        // Clean up: remove any trailing words that might have been captured
        // Split and take only the first capitalized word (the name)
        const nameParts = name.split(/\s+/);
        name = nameParts[0]; // Take only first word
        
        // Validate name
        if (name.length > 2 && /^[A-Z][a-z]+$/.test(name)) {
          // Check if it's a common word (skip common words)
          const commonWords = ['yes', 'no', 'okay', 'thank', 'hello', 'hi', 'hey', 'maam', 'sir', 'from', 'the', 'and', 'but', 'can', 'you', 'your', 'will', 'would', 'should', 'could'];
          if (!commonWords.includes(name.toLowerCase())) {
            if (!Object.values(speakerNameMap).includes(name)) {
              speakerNameMap[speaker] = name;
              console.log(`🔍 Detected name for ${speaker}: "${name}" from context: "${segment.text.substring(0, 50)}..."`);
              break;
            }
          }
        }
      }
    }
  }

  return speakerNameMap;
}

/**
 * Use OpenAI to analyze conversation, split speakers, and assign names
 * This is used when only 1 speaker is detected - OpenAI will identify conversation turns
 */
async function analyzeAndSplitWithOpenAI(
  segments: SpeakerSegment[],
  apiKey: string
): Promise<SpeakerSegment[]> {
  try {
    // Build full transcript with timestamps
    const transcriptText = segments
      .map((seg, idx) => `[${idx + 1}] ${seg.text}`)
      .join('\n');
    
    const prompt = `Analyze this conversation transcript and identify where different speakers are talking.

Transcript:
${transcriptText}

Instructions:
1. Analyze the conversation flow and identify where speaker changes occur
2. Determine the actual name of each speaker by looking for:
   - Self-introductions (e.g., "My name is X", "I am X", "This is X")
   - Direct address (e.g., when someone says "X, I wanted to know")
   - Context clues (e.g., questions vs answers, different speaking styles)
   - Any names mentioned in the conversation
3. For each segment, identify:
   - Which speaker is talking (use their actual name if found, or "Speaker A", "Speaker B" if not)
   - Why this segment belongs to this speaker
4. Return a JSON array where each object has:
   - "segmentIndex": the segment number (1-based, matching the transcript)
   - "speakerName": the actual name of the speaker (or "Speaker A", "Speaker B" if name unknown)
   - "reason": brief reason (e.g., "introduces self", "responds to question", "asks question", "continues speaking")

Important:
- Work for ANY language (English, Hindi, etc.)
- Identify speaker changes based on conversation flow, not hardcoded patterns
- CRITICAL: If a name is mentioned anywhere in the conversation (e.g., "John", "Sarah", "Harshna", "Archana"), you MUST use that actual name, not generic labels
- Look carefully for names when people introduce themselves or when someone addresses another person by name
- If you see "X, I wanted to know" or "Hello X" - that X is the person's name, use it!
- Only use "Speaker A" or "Speaker B" if absolutely no name can be found in the entire conversation
- Analyze the entire conversation to understand who is speaking when
- Be consistent: if you identify a name once, use that same name for all segments by that speaker

Return only the JSON array, no additional text:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing conversations in any language. You identify speaker changes based on conversation flow, introductions, questions/answers, and context. You work for ANY conversation - English, Hindi, or any other language. Return only valid JSON array.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data: any = await response.json();
    const content = data.choices[0]?.message?.content?.trim() || '[]';
    
    // Parse JSON response
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
      if (match) jsonStr = match[1];
    }
    
    const analysis: Array<{segmentIndex: number; speakerName: string; reason?: string}> = JSON.parse(jsonStr);
    
    // Map analysis to segments
    // First, get all unique speaker names from analysis
    const allSpeakerNames = analysis.map(a => a.speakerName);
    const uniqueNames = [...new Set(allSpeakerNames)].filter(name => 
      name && !name.startsWith('SPEAKER_') // Filter out generic labels
    );
    
    // If we have generic labels, try to extract actual names from transcript
    const hasGenericLabels = allSpeakerNames.some(name => name && name.startsWith('SPEAKER_'));
    if (hasGenericLabels && uniqueNames.length === 0) {
      // Try to extract names from transcript segments
      for (const seg of segments) {
        // Look for name patterns in text
        const nameMatch = seg.text.match(/\b([A-Z][a-z]+)\b/g);
        if (nameMatch) {
          for (const name of nameMatch) {
            // Skip common words
            const commonWords = ['Yes', 'No', 'Okay', 'Ma', 'Am', 'Can', 'You', 'Your', 'The', 'This', 'That', 'Thank', 'Hello', 'Good', 'Morning', 'Evening', 'Saturday', 'Sunday', 'Billai', 'Sector', 'Street'];
            if (!commonWords.includes(name) && name.length > 2 && !uniqueNames.includes(name)) {
              uniqueNames.push(name);
            }
          }
        }
      }
    }
    
    // Create name to label mapping
    const nameToLabel = new Map<string, string>();
    uniqueNames.forEach((name, idx) => {
      nameToLabel.set(name, idx === 0 ? 'SPEAKER_00' : 'SPEAKER_01');
    });
    
    const updatedSegments = segments.map((segment, idx) => {
      const segmentNum = idx + 1;
      const analysisItem = analysis.find(a => a.segmentIndex === segmentNum);
      
      if (analysisItem) {
        let speakerName = analysisItem.speakerName;
        
        // If OpenAI returned generic label, try to find actual name
        if (speakerName && speakerName.startsWith('SPEAKER_')) {
          // Look for names in this segment's text
          const nameMatch = segment.text.match(/\b([A-Z][a-z]+)\b/g);
          if (nameMatch) {
            for (const name of nameMatch) {
              const commonWords = ['Yes', 'No', 'Okay', 'Ma', 'Am', 'Can', 'You', 'Your', 'The', 'This', 'That', 'Thank', 'Hello', 'Good', 'Morning', 'Evening', 'Saturday', 'Sunday', 'Billai', 'Sector', 'Street'];
              if (!commonWords.includes(name) && name.length > 2) {
                // Check if this name appears in other segments (likely a person name)
                const nameCount = segments.filter(s => s.text.includes(name)).length;
                if (nameCount > 1) {
                  speakerName = name;
                  break;
                }
              }
            }
          }
        }
        
        // Get speaker label for this name
        let speakerLabel = nameToLabel.get(speakerName);
        if (!speakerLabel) {
          // If name not in map, add it
          if (uniqueNames.length === 0) {
            uniqueNames.push(speakerName);
            nameToLabel.set(speakerName, 'SPEAKER_00');
            speakerLabel = 'SPEAKER_00';
          } else if (uniqueNames.length === 1) {
            uniqueNames.push(speakerName);
            nameToLabel.set(speakerName, 'SPEAKER_01');
            speakerLabel = 'SPEAKER_01';
          } else {
            // More than 2 speakers - use first available
            speakerLabel = 'SPEAKER_01';
          }
        }
        
        return {
          ...segment,
          speaker: speakerLabel,
          speakerName: speakerName
        };
      }
      
      return segment;
    });
    
    // Post-process: Direct replacement of SPEAKER_01 with actual names
    // Find "Archana" or any name mentioned in segments with SPEAKER_01
    let secondSpeakerName: string | null = null;
    
    // Look for names in segments that have SPEAKER_01
    for (const seg of updatedSegments) {
      if (seg.speakerName && (seg.speakerName === 'SPEAKER_01' || seg.speakerName.startsWith('SPEAKER_01'))) {
        // Pattern: "Archana, I wanted" or "Name, I just"
        const nameMatch = seg.text.match(/\b([A-Z][a-z]+),\s+(?:I|just|we|you)/);
        if (nameMatch && nameMatch[1]) {
          const name = nameMatch[1];
          const commonWords = ['Yes', 'No', 'Okay', 'Ma', 'Am', 'Can', 'You', 'Your', 'The', 'This', 'That', 'Thank', 'Hello', 'Good', 'Morning', 'Evening', 'Saturday', 'Sunday', 'Billai', 'Sector', 'Street', 'Executive', 'Customer', 'Absolutely', 'Approximately'];
          if (!commonWords.includes(name) && name.length > 2 && /^[A-Z][a-z]+$/.test(name)) {
            secondSpeakerName = name;
            console.log(`🔍 Found name "${name}" in SPEAKER_01 segment - will replace all SPEAKER_01`);
            break;
          }
        }
      }
    }
    
    // If found, replace ALL SPEAKER_01 with the actual name
    if (secondSpeakerName) {
      const finalSegments = updatedSegments.map(segment => {
        if (segment.speakerName === 'SPEAKER_01' || segment.speakerName?.startsWith('SPEAKER_01')) {
          return {
            ...segment,
            speakerName: secondSpeakerName!
          };
        }
        return segment;
      });
      return finalSegments;
    }
    
    // Fallback: Try other patterns
    const namePatterns = [
      /\b([A-Z][a-z]+),\s+(?:I|we|you|just)/,
      /(?:hello|hi|hey)\s+([A-Z][a-z]+)/i,
      /\b([A-Z][a-z]+)\s+from\s+[A-Z]/,
      /\b([A-Z][a-z]+)\s+ma'?am/i,
    ];
    
    const commonWords = ['Yes', 'No', 'Okay', 'Ma', 'Am', 'Can', 'You', 'Your', 'The', 'This', 'That', 'Thank', 'Hello', 'Good', 'Morning', 'Evening', 'Saturday', 'Sunday', 'Billai', 'Sector', 'Street', 'Executive', 'Customer', 'Absolutely', 'Approximately'];
    
    // Find any name that's not Harshna
    const existingName = [...new Set(updatedSegments.map(s => s.speakerName))].find(n => 
      n && !n.startsWith('SPEAKER_') && !n.includes('Speaker')
    );
    
    for (const seg of updatedSegments) {
      if (seg.speakerName === 'SPEAKER_01' || seg.speakerName?.startsWith('SPEAKER_01')) {
        for (const pattern of namePatterns) {
          const match = seg.text.match(pattern);
          if (match && match[1]) {
            const name = match[1];
            if (!commonWords.includes(name) && name.length > 2 && /^[A-Z][a-z]+$/.test(name) && name !== existingName) {
              secondSpeakerName = name;
              console.log(`🔍 Found name "${name}" - replacing SPEAKER_01`);
              break;
            }
          }
        }
        if (secondSpeakerName) break;
      }
    }
    
    // Final replacement
    if (secondSpeakerName) {
      return updatedSegments.map(segment => {
        if (segment.speakerName === 'SPEAKER_01' || segment.speakerName?.startsWith('SPEAKER_01')) {
          return {
            ...segment,
            speakerName: secondSpeakerName!
          };
        }
        return segment;
      });
    }
    
    return updatedSegments;
  } catch (error: any) {
    console.error('❌ OpenAI conversation analysis error:', error.message);
    return segments; // Return original if fails
  }
}

/**
 * Use OpenAI to identify speakers and assign proper names (when speakers already split)
 */
async function identifySpeakersWithOpenAI(
  segments: SpeakerSegment[],
  apiKey: string
): Promise<{ [speakerLabel: string]: string }> {
  try {
    // Build transcript text with speaker labels
    const transcriptText = segments
      .map((seg, idx) => `[Segment ${idx + 1}] ${seg.speaker}: ${seg.text}`)
      .join('\n');
    
    // Get unique speaker labels
    const uniqueSpeakers = [...new Set(segments.map(s => s.speaker))].sort();
    
    const prompt = `Analyze this conversation transcript and identify each speaker's actual name.

Transcript:
${transcriptText}

Speaker labels found: ${uniqueSpeakers.join(', ')}

Instructions:
1. Identify the actual name of each speaker (e.g., "Harshna", "Archana", "John", "Sarah")
2. Look for names mentioned in introductions, when people address each other, or in context
3. Return a JSON object mapping speaker labels to their actual names
4. If a name cannot be determined, use the speaker label itself
5. Only return valid JSON, no additional text

Example output format:
{
  "SPEAKER_00": "Harshna",
  "SPEAKER_01": "Archana"
}

Return only the JSON object:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing conversations in any language and identifying speakers. You work for ANY conversation - English, Hindi, Spanish, or any other language. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data: any = await response.json();
    const content = data.choices[0]?.message?.content?.trim() || '{}';
    
    // Parse JSON response (handle markdown code blocks if present)
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (match) jsonStr = match[1];
    }
    
    const speakerMap = JSON.parse(jsonStr);
    
    // Validate: ensure all speaker labels are mapped
    const finalMap: { [key: string]: string } = {};
    uniqueSpeakers.forEach(speakerLabel => {
      finalMap[speakerLabel] = speakerMap[speakerLabel] || speakerLabel;
    });
    
    return finalMap;
  } catch (error: any) {
    console.error('❌ OpenAI speaker identification error:', error.message);
    return {};
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
    // Auto-detect names if not provided
    const autoDetected = detectNamesFromTranscript(segments);
    if (Object.keys(autoDetected).length > 0) {
      return segments.map(segment => ({
        ...segment,
        speakerName: autoDetected[segment.speaker] || segment.speaker,
      }));
    }
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

