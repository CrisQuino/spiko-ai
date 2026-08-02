// Filesystem Cache - Stores audio files on disk
// Zero RAM usage, persistent across restarts

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const CACHE_DIR = path.join(process.cwd(), '.cache', 'audio');
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CachedAudio {
  audioContent: string;
  voiceUsed: string;
  accent: string;
  timestamp: number;
}

// Generate cache key from text and voice
function generateCacheKey(text: string, voiceUsed: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(text + voiceUsed)
    .digest('hex')
    .substring(0, 16);
  return hash;
}

// Ensure cache directory exists
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('❌ [FS-CACHE] Failed to create cache directory:', error);
  }
}

// Get cached audio from filesystem
export async function getCachedAudio(
  text: string,
  voiceUsed: string
): Promise<CachedAudio | null> {
  try {
    const key = generateCacheKey(text, voiceUsed);
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      console.log(`🔍 [FS-CACHE] Miss: ${key}`);
      return null;
    }
    
    // Read and parse cache file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const cached: CachedAudio = JSON.parse(fileContent);
    
    // Check if cache is expired
    const age = Date.now() - cached.timestamp;
    if (age > MAX_CACHE_AGE_MS) {
      console.log(`⏰ [FS-CACHE] Expired (${Math.floor(age / (24 * 60 * 60 * 1000))} days): ${key}`);
      // Delete expired cache
      await fs.unlink(filePath).catch(() => {});
      return null;
    }
    
    console.log(`✅ [FS-CACHE] Hit: ${key}`);
    return cached;
  } catch (error) {
    console.error('❌ [FS-CACHE] Error reading cache:', error);
    return null;
  }
}

// Store audio in filesystem cache
export async function setCachedAudio(
  text: string,
  voiceUsed: string,
  audioContent: string,
  accent: string
): Promise<void> {
  try {
    await ensureCacheDir();
    
    const key = generateCacheKey(text, voiceUsed);
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    
    const cacheData: CachedAudio = {
      audioContent,
      voiceUsed,
      accent,
      timestamp: Date.now()
    };
    
    await fs.writeFile(filePath, JSON.stringify(cacheData), 'utf-8');
    console.log(`💾 [FS-CACHE] Stored: ${key}`);
  } catch (error) {
    console.error('❌ [FS-CACHE] Error writing cache:', error);
  }
}

// Get cache statistics
export async function getCacheStats(): Promise<{
  totalFiles: number;
  totalSizeMB: number;
  oldestCacheDate: Date | null;
}> {
  try {
    await ensureCacheDir();
    
    const files = await fs.readdir(CACHE_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    let totalSize = 0;
    let oldestTimestamp = Date.now();
    
    for (const file of jsonFiles) {
      const filePath = path.join(CACHE_DIR, file);
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
      
      // Read timestamp from file
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data: CachedAudio = JSON.parse(content);
        if (data.timestamp < oldestTimestamp) {
          oldestTimestamp = data.timestamp;
        }
      } catch {
        // Skip invalid files
      }
    }
    
    return {
      totalFiles: jsonFiles.length,
      totalSizeMB: parseFloat((totalSize / (1024 * 1024)).toFixed(2)),
      oldestCacheDate: jsonFiles.length > 0 ? new Date(oldestTimestamp) : null
    };
  } catch (error) {
    console.error('❌ [FS-CACHE] Error getting stats:', error);
    return {
      totalFiles: 0,
      totalSizeMB: 0,
      oldestCacheDate: null
    };
  }
}

// Clean up old cache files
export async function cleanupOldCache(): Promise<number> {
  try {
    await ensureCacheDir();
    
    const files = await fs.readdir(CACHE_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    let deletedCount = 0;
    const now = Date.now();
    
    for (const file of jsonFiles) {
      const filePath = path.join(CACHE_DIR, file);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data: CachedAudio = JSON.parse(content);
        
        const age = now - data.timestamp;
        if (age > MAX_CACHE_AGE_MS) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      } catch {
        // Delete invalid files
        await fs.unlink(filePath).catch(() => {});
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      console.log(`🧹 [FS-CACHE] Cleaned up ${deletedCount} old files`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('❌ [FS-CACHE] Error cleaning cache:', error);
    return 0;
  }
}
