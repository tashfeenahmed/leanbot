#!/usr/bin/env python3
"""
faster-whisper STT wrapper script
Reads audio from stdin or file, outputs JSON transcription to stdout
"""

import sys
import json
import argparse
import tempfile
import os

def main():
    parser = argparse.ArgumentParser(description='Transcribe audio using faster-whisper')
    parser.add_argument('--model', default='small', help='Model size: tiny, base, small, medium, large-v3')
    parser.add_argument('--language', default=None, help='Language code (e.g., en, es, fr)')
    parser.add_argument('--device', default='cpu', help='Device: cpu or cuda')
    parser.add_argument('--compute-type', default='int8', help='Compute type: int8, float16, float32')
    parser.add_argument('--file', default=None, help='Audio file path (if not using stdin)')
    parser.add_argument('--beam-size', type=int, default=5, help='Beam size for decoding')
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({
            'error': 'faster-whisper not installed. Run: pip install faster-whisper',
            'success': False
        }))
        sys.exit(1)

    # Load model
    try:
        model = WhisperModel(
            args.model,
            device=args.device,
            compute_type=args.compute_type
        )
    except Exception as e:
        print(json.dumps({
            'error': f'Failed to load model: {str(e)}',
            'success': False
        }))
        sys.exit(1)

    # Get audio file
    audio_file = args.file
    temp_file = None

    if not audio_file:
        # Read from stdin
        temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_file.write(sys.stdin.buffer.read())
        temp_file.close()
        audio_file = temp_file.name

    try:
        # Transcribe
        segments, info = model.transcribe(
            audio_file,
            language=args.language,
            beam_size=args.beam_size,
            vad_filter=True,  # Filter out silence
        )

        # Collect text from segments
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text)

        result = {
            'success': True,
            'text': ' '.join(text_parts).strip(),
            'language': info.language,
            'language_probability': info.language_probability,
            'duration': info.duration,
        }

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({
            'error': f'Transcription failed: {str(e)}',
            'success': False
        }))
        sys.exit(1)

    finally:
        # Clean up temp file
        if temp_file and os.path.exists(temp_file.name):
            os.unlink(temp_file.name)

if __name__ == '__main__':
    main()
