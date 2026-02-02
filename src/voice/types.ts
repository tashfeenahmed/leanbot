/**
 * Voice module types for STT and TTS
 */

export interface STTProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  transcribe(audio: Buffer, options?: STTOptions): Promise<STTResult>;
}

export interface TTSProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
}

export interface STTOptions {
  language?: string;
  prompt?: string; // Context hint for better transcription
}

export interface STTResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number; // Audio duration in seconds
}

export interface TTSOptions {
  voice?: string;
  speed?: number; // 0.5 to 2.0
  format?: 'mp3' | 'wav' | 'opus' | 'aac';
}

export interface TTSResult {
  audio: Buffer;
  format: string;
  duration?: number;
}

export interface VoiceConfig {
  stt: {
    preferLocal: boolean;
    localProvider?: 'faster-whisper' | 'whisper' | 'macos';
    cloudProvider?: 'openai' | 'groq';
    language?: string;
    model?: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
  };
  tts: {
    preferLocal: boolean;
    localProvider?: 'kokoro' | 'piper' | 'macos';
    cloudProvider?: 'openai' | 'elevenlabs';
    voice?: string;
  };
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  stt: {
    preferLocal: true,
    localProvider: 'faster-whisper', // CTranslate2 optimized, best performance
    cloudProvider: 'groq', // Faster and cheaper than OpenAI
    language: 'en',
    model: 'small', // Good balance of speed and accuracy for 4GB RAM
  },
  tts: {
    preferLocal: true,
    localProvider: 'kokoro', // Lightweight 82M params, high quality
    cloudProvider: 'openai',
    voice: 'am_adam', // Deep, authoritative male voice
  },
};
