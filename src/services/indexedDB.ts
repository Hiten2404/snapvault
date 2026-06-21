import { SnapchatMemory, ArchiveStats, UserSettings, DuplicateGroup } from '../types';

const DB_NAME = 'snapvault_db';
const DB_VERSION = 2; // Incremented database version for migration
const MEMORIES_STORE = 'memories';
const MEDIA_STORE = 'media_content';
const SETTINGS_STORE = 'settings';

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;

      if (!db.objectStoreNames.contains(MEMORIES_STORE)) {
        const memoryStore = db.createObjectStore(MEMORIES_STORE, { keyPath: 'id' });
        memoryStore.createIndex('dateTaken', 'dateTaken', { unique: false });
        memoryStore.createIndex('sha256', 'sha256', { unique: false });
        memoryStore.createIndex('isFavorite', 'isFavorite', { unique: false });
      }

      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Saves a memory metadata and its raw media content separately
 */
export async function saveMemory(memory: SnapchatMemory): Promise<void> {
  const db = await initDB();
  const rawBlob = memory.mediaBlob;
  
  // Create metadata copy without the heavy blob
  const metadata = { ...memory };
  // Keep type-safety but remove blob from memory store to optimize memory
  // We will cast to any to delete the property for storage
  delete (metadata as any).mediaBlob;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([MEMORIES_STORE, MEDIA_STORE], 'readwrite');
    const memoriesStore = tx.objectStore(MEMORIES_STORE);
    const mediaStore = tx.objectStore(MEDIA_STORE);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    memoriesStore.put(metadata);
    mediaStore.put({ id: memory.id, mediaBlob: rawBlob });
  });
}

/**
 * Saves bulk memories in a transaction, writing metadata and media separately
 */
export async function saveMemoriesBulk(memories: SnapchatMemory[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MEMORIES_STORE, MEDIA_STORE], 'readwrite');
    const memoriesStore = tx.objectStore(MEMORIES_STORE);
    const mediaStore = tx.objectStore(MEDIA_STORE);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    memories.forEach((memory) => {
      const rawBlob = memory.mediaBlob;
      const metadata = { ...memory };
      delete (metadata as any).mediaBlob;

      memoriesStore.put(metadata);
      mediaStore.put({ id: memory.id, mediaBlob: rawBlob });
    });
  });
}

/**
 * Gets all memory metadata records (excludes raw media blobs for memory efficiency)
 */
export async function getMemories(): Promise<SnapchatMemory[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEMORIES_STORE, 'readonly');
    const store = tx.objectStore(MEMORIES_STORE);
    const index = store.index('dateTaken');
    const request = index.getAll();

    request.onsuccess = () => {
      // In our code, SnapchatMemory instances retrieved by getMemories will have mediaBlob as null/undefined,
      // and they should be loaded on demand using getMediaBlob.
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves a specific memory metadata
 */
export async function getMemory(id: string): Promise<SnapchatMemory | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEMORIES_STORE, 'readonly');
    const store = tx.objectStore(MEMORIES_STORE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Loads the raw media blob for a specific memory
 */
export async function getMediaBlob(id: string): Promise<Blob | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const store = tx.objectStore(MEDIA_STORE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result?.mediaBlob || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MEMORIES_STORE, MEDIA_STORE], 'readwrite');
    const memoriesStore = tx.objectStore(MEMORIES_STORE);
    const mediaStore = tx.objectStore(MEDIA_STORE);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    memoriesStore.delete(id);
    mediaStore.delete(id);
  });
}

export async function toggleFavorite(id: string): Promise<void> {
  const memory = await getMemory(id);
  if (!memory) return;

  memory.isFavorite = !memory.isFavorite;
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEMORIES_STORE, 'readwrite');
    const store = tx.objectStore(MEMORIES_STORE);
    const request = store.put(memory);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateMemoryMetadata(id: string, updates: Partial<SnapchatMemory>): Promise<void> {
  const memory = await getMemory(id);
  if (!memory) return;

  const updatedMemory = { ...memory, ...updates };
  // Ensure we don't save raw media blob back to main memories store if it's there
  delete (updatedMemory as any).mediaBlob;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEMORIES_STORE, 'readwrite');
    const store = tx.objectStore(MEMORIES_STORE);
    const request = store.put(updatedMemory);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearDatabase(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MEMORIES_STORE, MEDIA_STORE], 'readwrite');
    const memoriesStore = tx.objectStore(MEMORIES_STORE);
    const mediaStore = tx.objectStore(MEDIA_STORE);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    memoriesStore.clear();
    mediaStore.clear();
  });
}

export async function getSettings(): Promise<UserSettings> {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.get('user_settings');

    request.onsuccess = () => {
      const defaultSettings: UserSettings = {
        theme: 'dark',
        importPreference: 'both',
        autoRepairMetadata: true,
        saveGpsIfAvailable: true,
      };
      resolve(request.result?.value || defaultSettings);
    };
    request.onerror = () => {
      resolve({
        theme: 'dark',
        importPreference: 'both',
        autoRepairMetadata: true,
        saveGpsIfAvailable: true,
      });
    };
  });
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.put({ key: 'user_settings', value: settings });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getStats(): Promise<ArchiveStats> {
  const memories = await getMemories();
  const totalMemories = memories.length;

  let totalPhotos = 0;
  let totalVideos = 0;
  let oldestMemory: string | null = null;
  let newestMemory: string | null = null;
  const yearsSet = new Set<number>();
  let gpsTaggedMemories = 0;
  let storageUsedBytes = 0;

  const sizeCount: Record<string, number> = {};

  memories.forEach((m) => {
    if (m.type === 'photo') totalPhotos++;
    else if (m.type === 'video') totalVideos++;

    const date = new Date(m.dateTaken);
    if (!isNaN(date.getTime())) {
      yearsSet.add(date.getFullYear());
      
      const isoString = date.toISOString();
      if (!oldestMemory || isoString < oldestMemory) oldestMemory = isoString;
      if (!newestMemory || isoString > newestMemory) newestMemory = isoString;
    }

    if (m.location) gpsTaggedMemories++;

    // Size calculation uses metadata size directly
    storageUsedBytes += m.size;
    if (m.thumbnailBlob) {
      storageUsedBytes += m.thumbnailBlob.size;
    }

    // Group duplicates by size + type to catch duplicate file streams with different metadata
    const key = `${m.size}_${m.type}`;
    sizeCount[key] = (sizeCount[key] || 0) + 1;
  });

  let duplicateCount = 0;
  Object.values(sizeCount).forEach((cnt) => {
    if (cnt > 1) {
      duplicateCount += cnt - 1;
    }
  });

  return {
    totalMemories,
    totalPhotos,
    totalVideos,
    oldestMemory,
    newestMemory,
    yearsCovered: Array.from(yearsSet).sort((a, b) => b - a),
    gpsTaggedMemories,
    duplicateCount,
    storageUsedBytes,
  };
}

export async function getDuplicateGroups(): Promise<DuplicateGroup[]> {
  const memories = await getMemories();
  const groupsMap: Record<string, SnapchatMemory[]> = {};

  memories.forEach((memory) => {
    const key = `${memory.size}_${memory.type}`;
    if (!groupsMap[key]) {
      groupsMap[key] = [];
    }
    groupsMap[key].push(memory);
  });

  const duplicateGroups: DuplicateGroup[] = [];
  Object.entries(groupsMap).forEach(([key, list]) => {
    if (list.length > 1) {
      const sortedList = list.sort((a, b) => new Date(a.dateTaken).getTime() - new Date(b.dateTaken).getTime());
      
      duplicateGroups.push({
        id: key,
        sha256: sortedList[0].sha256,
        memories: sortedList,
      });
    }
  });

  return duplicateGroups;
}
