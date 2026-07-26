export interface OfflineAction {
  id: string;
  endpoint: string;
  method: string;
  body: string;
  timestamp: number;
  retryCount: number;
}

const DB_NAME = "clinical-kb-offline-queue";
const STORE_NAME = "actions";
const MAX_RETRIES = 5;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
    });
  }
  return dbPromise;
}

export async function enqueueOfflineAction(action: Omit<OfflineAction, "id" | "timestamp" | "retryCount">) {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const fullAction: OfflineAction = {
        ...action,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        retryCount: 0,
      };
      store.add(fullAction);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn("Failed to enqueue offline action", error);
  }
}

export async function drainOfflineQueue(getAuthHeaders: () => Record<string, string>) {
  if (typeof window === "undefined" || !navigator.onLine) return;

  try {
    const db = await getDb();
    const actions = await new Promise<OfflineAction[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (actions.length === 0) return;

    // Sort by timestamp (oldest first)
    actions.sort((a, b) => a.timestamp - b.timestamp);

    for (const action of actions) {
      if (!navigator.onLine) break;

      try {
        const response = await fetch(action.endpoint, {
          method: action.method,
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: action.body,
        });

        if (
          response.ok ||
          response.status === 400 ||
          response.status === 401 ||
          response.status === 403 ||
          response.status === 404
        ) {
          // Success or non-retriable client error
          await removeAction(db, action.id);
        } else {
          // Retriable error (e.g. 500, 502, 503, 429)
          await incrementRetry(db, action);
        }
      } catch {
        // Network error (fetch threw)
        await incrementRetry(db, action);
      }
    }
  } catch (error) {
    console.warn("Failed to drain offline queue", error);
  }
}

async function removeAction(db: IDBDatabase, id: string) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function incrementRetry(db: IDBDatabase, action: OfflineAction) {
  if (action.retryCount >= MAX_RETRIES) {
    return removeAction(db, action.id);
  }
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    action.retryCount += 1;
    transaction.objectStore(STORE_NAME).put(action);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
