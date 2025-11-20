#!/usr/bin/env python3
"""
PyAnnote Speaker Diarization Script
Extracts speaker segments from audio file
"""

import sys
import json
import os
from pyannote.audio import Pipeline

# Try to login to HuggingFace if token is available
try:
    hf_token = os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HF_TOKEN")
    if hf_token:
        try:
            from huggingface_hub import login
            login(token=hf_token)
        except:
            pass  # Login might fail if already logged in or token invalid
except:
    pass

def diarize_audio(audio_path):
    """Run speaker diarization on audio file"""
    try:
        # Load pre-trained speaker diarization pipeline
        # Use only 3.1 model (user has access to this one)
        models_to_try = [
            "pyannote/speaker-diarization-3.1",
        ]
        
        # Get HuggingFace token if available
        hf_token = os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HF_TOKEN")
        
        pipeline = None
        last_error = None
        
        for model_name in models_to_try:
            try:
                # Use token if available (newer API uses 'token' parameter)
                if hf_token:
                    try:
                        # Try with 'token' parameter (newer API)
                        pipeline = Pipeline.from_pretrained(model_name, token=hf_token)
                    except TypeError:
                        # Fallback to older API
                        try:
                            pipeline = Pipeline.from_pretrained(model_name, use_auth_token=hf_token)
                        except TypeError:
                            # Try without token parameter - might work if terms accepted
                            pipeline = Pipeline.from_pretrained(model_name)
                else:
                    pipeline = Pipeline.from_pretrained(model_name)
                
                # If we got here, model loaded successfully
                break
                
            except Exception as e:
                error_str = str(e)
                last_error = error_str
                
                if "401" in error_str or "Unauthorized" in error_str or "403" in error_str or "GatedRepoError" in error_str:
                    # Model requires HuggingFace token or terms acceptance
                    error_msg = "HuggingFace authentication required.\n\n"
                    error_msg += "⚠️  IMPORTANT: Diarization model ke sub-models ko bhi access chahiye!\n\n"
                    error_msg += "QUICK FIX - Ye sab models par terms accept karo:\n"
                    error_msg += "1. https://huggingface.co/pyannote/speaker-diarization-3.1\n"
                    error_msg += "2. https://huggingface.co/pyannote/segmentation-3.0\n"
                    error_msg += "3. https://huggingface.co/pyannote/embedding\n"
                    error_msg += "4. https://huggingface.co/pyannote/speaker-diarization-community-1\n"
                    error_msg += "\nHar ek par 'Agree and access repository' click karo!\n"
                    error_msg += "\nCheck your access: https://huggingface.co/settings/gated-repos\n\n"
                    error_msg += f"Current error: {error_str[:200]}"
                    raise Exception(error_msg)
                
                # For other errors, try next model
                continue
        
        if pipeline is None:
            error_msg = "Could not load any speaker diarization model.\n\n"
            error_msg += f"Last error: {last_error[:300] if last_error else 'Unknown error'}\n\n"
            error_msg += "Please ensure:\n"
            error_msg += "1. Terms accepted at: https://huggingface.co/pyannote/speaker-diarization-3.1\n"
            error_msg += "2. HUGGINGFACE_TOKEN is set correctly"
            raise Exception(error_msg)
        
        # Run diarization
        # Note: Some PyAnnote versions support min_speakers/max_speakers, but we'll use default for compatibility
        try:
            # Try with parameters (newer versions)
            diarization_output = pipeline(
                audio_path,
                min_speakers=1,
                max_speakers=4
            )
        except TypeError:
            # Fallback: Use without parameters (older versions)
            diarization_output = pipeline(audio_path)
        
        # Handle new API: DiarizeOutput has speaker_diarization attribute
        # Handle old API: direct Annotation object
        if hasattr(diarization_output, 'speaker_diarization'):
            # New API: DiarizeOutput object
            diarization = diarization_output.speaker_diarization
        else:
            # Old API: direct Annotation object
            diarization = diarization_output
        
        # Extract segments
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "speaker": speaker,
                "start": turn.start,
                "end": turn.end
            })
        
        # Output segments as JSON
        for segment in segments:
            print(json.dumps({"segment": segment}))
            
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python diarize.py <audio_path>"}), file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    diarize_audio(audio_path)

