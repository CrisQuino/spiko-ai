// Browser-side audio cache using localStorage
import { useState, useCallback } from 'react';

// Simple hash function for cache keys
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

interface CachedAudio {
  audio: string;
  voiceUsed: string;
  accent: string;
  cachedAt: number;
}

export function useAudioCache() {
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0 });

  // Get cached audio from localStorage
  const getCached = useCallback((text: string, voice: string): CachedAudio | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const key = `speeck-tts-${hashString(text + voice)}`;
      const cached = localStorage.getItem(key);
      
      if (cached) {
        const data = JSON.parse(cached) as CachedAudio;
        
        // Check if cache is still valid (30 days)
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        if (Date.now() - data.cachedAt < maxAge) {
          console.log(`✅ [BROWSER CACHE] Hit: ${text.substring(0, 30)}...`);
          setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
          return data;
        } else {
          // Expired, remove it
          localStorage.removeItem(key);
          console.log(`🗑️ [BROWSER CACHE] Expired: ${text.substring(0, 30)}...`);
        }
      }
      
      console.log(`🔍 [BROWSER CACHE] Miss: ${text.substring(0, 30)}...`);
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    } catch (error) {
      console.error('❌ [BROWSER CACHE] Error reading:', error);
      return null;
    }
  }, []);

  // Set cached audio in localStorage
  const setCache = useCallback((
    text: string,
    voice: string,
    audio: string,
    accent: string
  ): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const key = `speeck-tts-${hashString(text + voice)}`;
      const data: CachedAudio = {
        audio,
        voiceUsed: voice,
        accent,
        cachedAt: Date.now()
      };
      
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`💾 [BROWSER CACHE] Stored: ${text.substring(0, 30)}... (${(audio.length / 1024).toFixed(1)} KB)`);
    } catch (error) {
      // QuotaExceededError - localStorage full
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('⚠️ [BROWSER CACHE] Storage full, cleaning old entries...');
        cleanupOldEntries();
        
        // Try again after cleanup
        try {
          const key = `speeck-tts-${hashString(text + voice)}`;
          const data: CachedAudio = {
            audio,
            voiceUsed: voice,
            accent,
            cachedAt: Date.now()
          };
          localStorage.setItem(key, JSON.stringify(data));
        } catch (retryError) {
          console.error('❌ [BROWSER CACHE] Still full after cleanup:', retryError);
        }
      } else {
        console.error('❌ [BROWSER CACHE] Error storing:', error);
      }
    }
  }, []);

  // Clear all cached audio
  const clearCache = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    
    let count = 0;
    const keys = Object.keys(localStorage);
    
    for (const key of keys) {
      if (key.startsWith('speeck-tts-')) {
        localStorage.removeItem(key);
        count++;
      }
    }
    
    console.log(`🧹 [BROWSER CACHE] Cleared ${count} entries`);
    setCacheStats({ hits: 0, misses: 0 });
    return count;
  }, []);

  // Cleanup old entries (older than 30 days)
  const cleanupOldEntries = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    
    let count = 0;
    const keys = Object.keys(localStorage);
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = Date.now();
    
    for (const key of keys) {
      if (key.startsWith('speeck-tts-')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (now - data.cachedAt > maxAge) {
            localStorage.removeItem(key);
            count++;
          }
        } catch {
          // Invalid data, remove it
          localStorage.removeItem(key);
          count++;
        }
      }
    }
    
    console.log(`🧹 [BROWSER CACHE] Cleaned ${count} old entries`);
    return count;
  }, []);

  // Get cache statistics
  const getStats = useCallback((): {
    count: number;
    totalSize: number;
    hits: number;
    misses: number;
    hitRate: number;
  } => {
    if (typeof window === 'undefined') {
      return { count: 0, totalSize: 0, hits: 0, misses: 0, hitRate: 0 };
    }
    
    let count = 0;
    let totalSize = 0;
    const keys = Object.keys(localStorage);
    
    for (const key of keys) {
      if (key.startsWith('speeck-tts-')) {
        count++;
        const item = localStorage.getItem(key);
        if (item) {
          totalSize += item.length;
        }
      }
    }
    
    const total = cacheStats.hits + cacheStats.misses;
    const hitRate = total > 0 ? (cacheStats.hits / total) * 100 : 0;
    
    return {
      count,
      totalSize,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      hitRate
    };
  }, [cacheStats]);

  return {
    getCached,
    setCache,
    clearCache,
    cleanupOldEntries,
    getStats,
    stats: cacheStats
  };
}
