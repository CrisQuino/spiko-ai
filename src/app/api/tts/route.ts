import { NextResponse } from 'next/server';
import { generateSpeech, type CEFRLevel } from '@/lib/google-tts';
import { getCachedAudio, setCachedAudio } from '@/lib/audio-cache';
import { getCachedAudio as getCachedAudioFS, setCachedAudio as setCachedAudioFS } from '@/lib/fs-cache';

// Configuration
const USE_GOOGLE_TTS_FOR_FREE_TIER = process.env.NEXT_PUBLIC_FREE_TIER_GOOGLE_TTS === 'true';
const GOOGLE_TTS_ENABLED = process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PRIVATE_KEY;
const USE_FILESYSTEM_CACHE = process.env.CACHE_STRATEGY === 'filesystem';

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const { text, cefrLevel = 'B2', lastAccents = [], isFreeUser = false } = await request.json();
    console.log(`🔊 [TTS] Request: "${text.substring(0, 50)}...", Level: ${cefrLevel}, Free: ${isFreeUser}`);
    console.log(`📦 [TTS] Cache strategy: ${USE_FILESYSTEM_CACHE ? 'filesystem' : 'browser (default)'}`);

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Decide which TTS to use
    const shouldUseGoogleTTS = GOOGLE_TTS_ENABLED && (!isFreeUser || USE_GOOGLE_TTS_FOR_FREE_TIER);
    
    if (!shouldUseGoogleTTS) {
      console.log('⚠️ [TTS] Using browser TTS fallback (free user or Google TTS disabled)');
      return NextResponse.json({ 
        fallback: true,
        reason: isFreeUser ? 'Free tier uses browser TTS' : 'Google TTS not configured'
      }, { status: 200 });
    }

    // Get voice config
    const voiceConfig = await import('@/lib/google-tts').then(m => m.getVoiceConfig(cefrLevel as CEFRLevel));
    const primaryVoice = voiceConfig.voices[0].name;
    
    // Check cache based on strategy
    let cached = null;
    
    if (USE_FILESYSTEM_CACHE) {
      // Server-side filesystem cache
      console.log('🗄️ [TTS] Checking filesystem cache...');
      cached = await getCachedAudioFS(text, primaryVoice);
    } else {
      // In-memory cache (will be replaced by browser cache on client)
      console.log('💾 [TTS] Checking in-memory cache (browser cache recommended)...');
      cached = await getCachedAudio(text, primaryVoice);
    }
    
    if (cached) {
      const totalTime = Date.now() - startTime;
      console.log(`✅ [TTS] Cache hit! Total time: ${totalTime}ms`);
      return NextResponse.json({
        audio: cached.audioContent,
        contentType: 'audio/mpeg',
        voiceUsed: cached.voiceUsed,
        accent: cached.accent,
        cached: true,
        cacheStrategy: USE_FILESYSTEM_CACHE ? 'filesystem' : 'memory',
        timing: { total: totalTime }
      });
    }

    // Generate with Google Cloud TTS
    console.log('🎤 [TTS] Generating with Google Cloud TTS...');
    const googleStart = Date.now();
    
    const result = await generateSpeech({
      text,
      cefrLevel: cefrLevel as CEFRLevel,
      lastAccents
    });
    
    const googleTime = Date.now() - googleStart;
    console.log(`✅ [TTS] Google TTS completed in ${googleTime}ms`);

    // Store in cache based on strategy
    if (USE_FILESYSTEM_CACHE) {
      await setCachedAudioFS(text, result.voiceUsed, result.audioContent, result.accent);
    } else {
      await setCachedAudio(text, result.voiceUsed, result.audioContent, result.accent);
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ [TTS] Success! Total time: ${totalTime}ms`);

    return NextResponse.json({
      audio: result.audioContent,
      contentType: 'audio/mpeg',
      voiceUsed: result.voiceUsed,
      accent: result.accent,
      cached: false,
      cacheStrategy: USE_FILESYSTEM_CACHE ? 'filesystem' : 'memory',
      timing: {
        google: googleTime,
        total: totalTime
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [TTS] Error after ${totalTime}ms:`, error);
    
    // Return fallback indicator
    return NextResponse.json(
      { 
        error: 'Failed to generate speech',
        fallback: true,
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 200 }
    );
  }
}
