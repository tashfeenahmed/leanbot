#!/bin/bash
# Setup script for local voice models (faster-whisper + Kokoro)
# Run this on the server to install dependencies

set -e

echo "=== Setting up local voice models ==="

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1-2)
echo "Python version: $PYTHON_VERSION"

if [[ "$PYTHON_VERSION" < "3.9" ]]; then
    echo "Error: Python 3.9+ required"
    exit 1
fi

# Create virtual environment if it doesn't exist
VENV_DIR="$HOME/.scallopbot/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

echo "Installing faster-whisper (STT)..."
pip install --upgrade pip
pip install faster-whisper

echo "Installing kokoro-onnx (TTS)..."
pip install kokoro-onnx

# Check for ffmpeg (needed for Opus conversion)
if ! command -v ffmpeg &> /dev/null; then
    echo "Installing ffmpeg..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y ffmpeg
    elif command -v brew &> /dev/null; then
        brew install ffmpeg
    else
        echo "Warning: ffmpeg not found. Please install it manually for Opus support."
    fi
fi

# Download Kokoro model files (if not already present)
echo "Checking for Kokoro model files..."
KOKORO_DIR="$HOME/.cache/kokoro"
mkdir -p "$KOKORO_DIR"

if [ ! -f "$KOKORO_DIR/kokoro-v1.0.onnx" ]; then
    echo "Downloading Kokoro ONNX model..."
    curl -L -o "$KOKORO_DIR/kokoro-v1.0.onnx" \
        "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
fi

if [ ! -f "$KOKORO_DIR/voices-v1.0.bin" ]; then
    echo "Downloading Kokoro voices..."
    curl -L -o "$KOKORO_DIR/voices-v1.0.bin" \
        "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
fi

# Test the installations
echo ""
echo "=== Testing installations ==="

echo "Testing faster-whisper..."
python3 -c "from faster_whisper import WhisperModel; print('faster-whisper: OK')" || echo "faster-whisper: FAILED"

echo "Testing kokoro-onnx..."
python3 -c "import kokoro_onnx; print('kokoro-onnx: OK')" || echo "kokoro-onnx: FAILED"

echo "Testing ffmpeg..."
ffmpeg -version | head -1 || echo "ffmpeg: NOT FOUND"

echo ""
echo "=== Setup complete ==="
echo ""
echo "To use the virtual environment, run:"
echo "  source $VENV_DIR/bin/activate"
echo ""
echo "Environment variables for .env:"
echo "  VOICE_LOCAL_STT=true"
echo "  VOICE_LOCAL_TTS=true"
echo "  VOICE_STT_MODEL=small"
echo "  VOICE_TTS_VOICE=af_heart"
echo ""
