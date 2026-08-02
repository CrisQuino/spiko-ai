import { TextToSpeechClient } from '@google-cloud/text-to-speech';

// Voice configuration by CEFR level
export const VOICE_CONFIG = {
  A1: {
    voices: [
      { name: 'en-US-Standard-C', accent: 'American (Standard)' },
      { name: 'en-GB-Standard-A', accent: 'British (Standard)' },
    ],
    speed: 0.9,
    pitch: 0,
  },
  A2: {
    voices: [
      { name: 'en-US-Standard-C', accent: 'American (Standard)' },
      { name: 'en-GB-Standard-A', accent: 'British (Standard)' },
      { name: 'en-AU-Standard-A', accent: 'Australian (Standard)' },
    ],
    speed: 0.95,
    pitch: 0,
  },
  B1: {
    voices: [
      { name: 'en-US-Wavenet-C', accent: 'American (Natural)' },
      { name: 'en-GB-Wavenet-A', accent: 'British (Natural)' },
    ],
    speed: 1.0,
    pitch: 0,
  },
  B2: {
    voices: [
      { name: 'en-US-Neural2-C', accent: 'American (Neural)' },
      { name: 'en-GB-Neural2-A', accent: 'British (Neural)' },
      { name: 'en-IN-Neural2-A', accent: 'Indian (Neural)' },
    ],
    speed: 1.0,
    pitch: 0,
  },
  C1: {
    voices: [
      { name: 'en-GB-Neural2-A', accent: 'British (Neural)' },
      { name: 'en-IN-Neural2-A', accent: 'Indian (Neural)' },
      { name: 'en-GB-News-G', accent: 'British (News)' },
    ],
    speed: 1.05,
    pitch: 0,
  },
  C2: {
    voices: [
      { name: 'en-IN-Neural2-A', accent: 'Indian (Neural)' },
      { name: 'en-GB-News-G', accent: 'British (News)' },
      { name: 'en-AU-Neural2-A', accent: 'Australian (Neural)' },
    ],
    speed: 1.1,
    pitch: 0,
  },
  CALIBRATING: {
    // First lesson - use C1 level
    voices: [
      { name: 'en-GB-Neural2-A', accent: 'British (Neural)' },
    ],
    speed: 1.0,
    pitch: 0,
  },
};

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'CALIBRATING';

interface GoogleTTSOptions {
  text: string;
  cefrLevel: CEFRLevel;
  lastAccents?: string[]; // For rotation
}

export async function generateSpeech(options: GoogleTTSOptions): Promise<{
  audioContent: string;
  voiceUsed: string;
  accent: string;
}> {
  const { text, cefrLevel, lastAccents = [] } = options;

  // Check if credentials exist
  if (!process.env.GOOGLE_CLOUD_PROJECT_ID || !process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
    throw new Error('Google Cloud credentials not configured');
  }

  // Initialize client
  const client = new TextToSpeechClient({
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  });

  // Get voice configuration for this level
  const levelConfig = VOICE_CONFIG[cefrLevel];
  
  // Select voice with rotation (avoid last 3 accents)
  let selectedVoice = levelConfig.voices[0];
  
  for (const voice of levelConfig.voices) {
    if (!lastAccents.includes(voice.name)) {
      selectedVoice = voice;
      break;
    }
  }

  console.log(`🎤 [GOOGLE TTS] Level: ${cefrLevel}, Voice: ${selectedVoice.name}, Accent: ${selectedVoice.accent}`);

  // Construct the request
  const request = {
    input: { text },
    voice: {
      languageCode: 'en-US',
      name: selectedVoice.name,
    },
    audioConfig: {
      audioEncoding: 'MP3' as const,
      speakingRate: levelConfig.speed,
      pitch: levelConfig.pitch,
    },
  };

  try {
    const [response] = await client.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('No audio content returned');
    }

    // Convert to base64
    const audioBase64 = Buffer.from(response.audioContent as Uint8Array).toString('base64');

    return {
      audioContent: audioBase64,
      voiceUsed: selectedVoice.name,
      accent: selectedVoice.accent,
    };
  } catch (error) {
    console.error('❌ [GOOGLE TTS] Error:', error);
    throw error;
  }
}

// Helper to get available voices for a level
export function getVoicesForLevel(level: CEFRLevel): Array<{ name: string; accent: string }> {
  return VOICE_CONFIG[level].voices;
}

// Helper to get voice details
export function getVoiceConfig(level: CEFRLevel) {
  return VOICE_CONFIG[level];
}
