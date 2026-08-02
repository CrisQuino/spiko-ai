import crypto from 'crypto';

// For MVP, we'll use in-memory cache
// TODO: Switch to Redis/Vercel KV in production
interface CacheEntry {
  audioContent: string;
  voiceUsed: string;
  accent: string;
  timestamp: number;
  hitCount: number;
}

const audioCache = new Map<string, CacheEntry>();

const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Generate cache key from text and voice
 */
export function generateCacheKey(text: string, voiceName: string): string {
  const normalized = text.trim().toLowerCase();
  const hash = crypto
    .createHash('sha256')
    .update(normalized + voiceName)
    .digest('hex');
  return `audio:${hash}`;
}

/**
 * Get audio from cache
 */
export async function getCachedAudio(
  text: string,
  voiceName: string
): Promise<CacheEntry | null> {
  const key = generateCacheKey(text, voiceName);
  const entry = audioCache.get(key);

  if (!entry) {
    console.log('🔍 [CACHE] Miss:', key.substring(0, 16) + '...');
    return null;
  }

  // Check if expired
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_DURATION_MS) {
    console.log('⏰ [CACHE] Expired:', key.substring(0, 16) + '...');
    audioCache.delete(key);
    return null;
  }

  // Update hit count
  entry.hitCount++;
  console.log(`✅ [CACHE] Hit (${entry.hitCount}x):`, key.substring(0, 16) + '...');

  return entry;
}

/**
 * Store audio in cache
 */
export async function setCachedAudio(
  text: string,
  voiceName: string,
  audioContent: string,
  accent: string
): Promise<void> {
  const key = generateCacheKey(text, voiceName);

  const entry: CacheEntry = {
    audioContent,
    voiceUsed: voiceName,
    accent,
    timestamp: Date.now(),
    hitCount: 0,
  };

  audioCache.set(key, entry);
  console.log('💾 [CACHE] Stored:', key.substring(0, 16) + '...');

  // Log cache stats
  console.log(`📊 [CACHE] Total entries: ${audioCache.size}`);
}

/**
 * Clear expired cache entries
 */
export async function cleanupCache(): Promise<number> {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of audioCache.entries()) {
    const age = now - entry.timestamp;
    if (age > CACHE_DURATION_MS) {
      audioCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 [CACHE] Cleaned ${cleaned} expired entries`);
  }

  return cleaned;
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  const entries = Array.from(audioCache.values());
  const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
  const avgHits = entries.length > 0 ? totalHits / entries.length : 0;

  return {
    totalEntries: audioCache.size,
    totalHits,
    avgHitsPerEntry: avgHits.toFixed(2),
    cacheEfficiency: entries.length > 0 ? ((totalHits / (entries.length + totalHits)) * 100).toFixed(1) + '%' : '0%',
  };
}

/**
 * Clear all cache (for testing)
 */
export function clearCache(): void {
  audioCache.clear();
  console.log('🗑️ [CACHE] Cleared all entries');
}

// Run cleanup every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupCache();
  }, 60 * 60 * 1000);
}
