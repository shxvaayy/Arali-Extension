#!/usr/bin/env python3
"""
Whisper Transcription Script
Transcribes audio segment using OpenAI Whisper
"""

import sys
import json
import whisper

def transcribe_segment(audio_path, start_time, end_time):
    """Transcribe a specific segment of audio"""
    try:
        # Load Whisper model (medium model for better accuracy)
        # Options: tiny, base, small, medium, large
        model = whisper.load_model("medium")
        
        # Load audio
        audio = whisper.load_audio(audio_path)
        
        # Extract segment (Whisper works on full audio, we'll filter results)
        # For now, transcribe full audio and filter by timestamps
        # Auto-detect language (supports Hindi, English, and 90+ languages)
        result = model.transcribe(audio_path, language=None, task="transcribe")
        
        # Find text in the specified time range
        segment_text = ""
        for segment in result["segments"]:
            if segment["start"] >= start_time and segment["end"] <= end_time:
                segment_text += segment["text"] + " "
        
        # If no segments found, use full transcription
        if not segment_text.strip():
            segment_text = result["text"]
        
        # Output transcription
        print(json.dumps({"text": segment_text.strip()}))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python transcribe.py <audio_path> [start_time] [end_time]"}), file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    start_time = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    end_time = float(sys.argv[3]) if len(sys.argv) > 3 else -1.0
    
    # If end_time is -1, transcribe full audio with timestamps
    if end_time < 0:
        try:
            # Use medium model for better accuracy (base is faster but less accurate)
            # Options: tiny, base, small, medium, large
            # medium = good balance of speed and accuracy
            model = whisper.load_model("medium")
            # Auto-detect language (supports Hindi, English, and 90+ languages)
            # Use initial_prompt for better accuracy with mixed languages
            # Try to detect if it's Hindi/English mix and use appropriate prompt
            result = model.transcribe(
                audio_path, 
                language=None,  # Auto-detect (supports Hindi, English, and 90+ languages)
                task="transcribe",
                initial_prompt="This is a conversation. Transcribe accurately in the spoken language."
            )
            # Output both full text and segments with timestamps (Whisper provides timestamps by default)
            output = {
                "text": result["text"].strip(),
                "segments": [
                    {
                        "text": seg["text"].strip(),
                        "start": seg["start"],
                        "end": seg["end"]
                    }
                    for seg in result.get("segments", [])
                ]
            }
            print(json.dumps(output))
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.exit(1)
    else:
        transcribe_segment(audio_path, start_time, end_time)

