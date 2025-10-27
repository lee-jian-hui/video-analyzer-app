/**
 * Centralized localStorage manager for type-safe state persistence
 */

import type { ActionEntry } from "../components/ActionHistoryPanel";

// Storage schema version for future migrations
const STORAGE_VERSION = 1;
const VERSION_KEY = "videoAnalyzer_storageVersion";

// Type definitions for stored data
export interface StoredVideo {
  id: string;
  name: string;
  uploadedAt?: number;
}

export interface UserPreferences {
  theme?: "light" | "dark";
  maxHistoryItems?: number;
  autoRefreshHistory?: boolean;
}

/**
 * Storage Key Enum - Single source of truth for all localStorage keys
 */
export enum StorageKey {
  ACTION_HISTORY = "ACTION_HISTORY",
  LAST_VIDEO = "LAST_VIDEO",
  USER_PREFERENCES = "USER_PREFERENCES",
}

/**
 * Storage Schema - Maps keys to their value types
 */
export interface StorageSchema {
  [StorageKey.ACTION_HISTORY]: ActionEntry[];
  [StorageKey.LAST_VIDEO]: StoredVideo | null;
  [StorageKey.USER_PREFERENCES]: UserPreferences;
}

/**
 * Internal mapping of enum keys to actual localStorage keys
 */
const STORAGE_KEY_MAP: Record<StorageKey, string> = {
  [StorageKey.ACTION_HISTORY]: "videoAnalyzerActionHistory",
  [StorageKey.LAST_VIDEO]: "videoAnalyzerLastVideo",
  [StorageKey.USER_PREFERENCES]: "videoAnalyzerUserPreferences",
};

/**
 * localStorage Manager with type-safe operations
 */
class LocalStorageManager {
  constructor() {
    this.ensureVersion();
  }

  /**
   * Ensure storage version is current
   */
  private ensureVersion() {
    const currentVersion = localStorage.getItem(VERSION_KEY);
    if (currentVersion !== String(STORAGE_VERSION)) {
      console.log(`📦 Storage version mismatch. Current: ${currentVersion}, Expected: ${STORAGE_VERSION}`);
      // Future: Add migration logic here
      localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
    }
  }

  /**
   * Get actual localStorage key from enum
   */
  private getStorageKey(key: StorageKey): string {
    return STORAGE_KEY_MAP[key];
  }

  /**
   * Get item from localStorage with type safety
   */
  get<K extends StorageKey>(
    key: K,
    defaultValue: StorageSchema[K]
  ): StorageSchema[K] {
    try {
      const storageKey = this.getStorageKey(key);
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        return defaultValue;
      }

      const parsed = JSON.parse(stored);
      console.log(`📦 Retrieved from localStorage: ${key}`, parsed);
      return parsed as StorageSchema[K];
    } catch (error) {
      console.error(`❌ Failed to parse localStorage key "${key}":`, error);
      // Clean up corrupted data
      this.remove(key);
      return defaultValue;
    }
  }

  /**
   * Set item in localStorage with type safety
   */
  set<K extends StorageKey>(key: K, value: StorageSchema[K]): boolean {
    try {
      const storageKey = this.getStorageKey(key);
      const serialized = JSON.stringify(value);
      localStorage.setItem(storageKey, serialized);
      console.log(`📦 Saved to localStorage: ${key}`, value);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save to localStorage key "${key}":`, error);
      return false;
    }
  }

  /**
   * Remove item from localStorage
   */
  remove<K extends StorageKey>(key: K): void {
    const storageKey = this.getStorageKey(key);
    localStorage.removeItem(storageKey);
    console.log(`🗑️  Removed from localStorage: ${key}`);
  }

  /**
   * Clear all app-related storage
   */
  clearAll(): void {
    Object.values(STORAGE_KEY_MAP).forEach((storageKey) => {
      localStorage.removeItem(storageKey);
    });
    localStorage.removeItem(VERSION_KEY);
    console.log("🗑️  Cleared all localStorage");
  }

  /**
   * Get storage size in bytes
   */
  getStorageSize(): number {
    let total = 0;
    Object.values(STORAGE_KEY_MAP).forEach((storageKey) => {
      const item = localStorage.getItem(storageKey);
      if (item) {
        total += item.length + storageKey.length;
      }
    });
    return total;
  }

  /**
   * Get human-readable storage size
   */
  getStorageSizeFormatted(): string {
    const bytes = this.getStorageSize();
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Debug: List all stored items
   */
  debugListAll(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    Object.entries(STORAGE_KEY_MAP).forEach(([enumKey, storageKey]) => {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          data[enumKey] = JSON.parse(stored);
        } catch {
          data[enumKey] = stored;
        }
      }
    });
    return data;
  }

  /**
   * Debug: Print storage summary
   */
  debugPrintSummary(): void {
    console.group("📦 localStorage Summary");
    console.log("Version:", localStorage.getItem(VERSION_KEY));
    console.log("Total Size:", this.getStorageSizeFormatted());
    console.log("Stored Items:");

    Object.entries(STORAGE_KEY_MAP).forEach(([enumKey, storageKey]) => {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        console.log(`  - ${enumKey}:`, stored.length, "chars");
      } else {
        console.log(`  - ${enumKey}: (empty)`);
      }
    });
    console.groupEnd();
  }

  /**
   * Export all data (for backup/debugging)
   */
  exportAll(): string {
    return JSON.stringify({
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      data: this.debugListAll(),
    }, null, 2);
  }

  /**
   * Import data (for restore)
   */
  importAll(exportedData: string): boolean {
    try {
      const parsed = JSON.parse(exportedData);
      if (parsed.version !== STORAGE_VERSION) {
        console.warn("⚠️  Version mismatch during import");
      }

      Object.entries(parsed.data).forEach(([enumKey, value]) => {
        const storageKey = STORAGE_KEY_MAP[enumKey as StorageKey];
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(value));
        }
      });

      console.log("✅ Imported localStorage data");
      return true;
    } catch (error) {
      console.error("❌ Failed to import data:", error);
      return false;
    }
  }
}

// Singleton instance
export const storageManager = new LocalStorageManager();

// Expose to window for debugging (only in development)
if (import.meta.env.DEV) {
  (window as any).storageManager = storageManager;
  console.log("💡 Debug: Access localStorage via window.storageManager");
}
