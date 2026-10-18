// ── Offline Message Queue using IndexedDB ──────────────────
// Stores messages when user is offline, replays them on reconnect

const DB_NAME = 'zammarket_offline';
const STORE = 'message_queue';
const VERSION = 1;

const openDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// Add a message to the offline queue. Returns its queue id (or null if it failed),
// which the chat page uses to remove the "queued" copy once the message is sent.
export const queueMessage = async (conversationId, text) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add({
      conversationId,
      text,
      queuedAt: new Date().toISOString(),
    });
    return new Promise((res, rej) => {
      tx.oncomplete = () => res(req.result);
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error('Queue failed:', err);
    return null;
  }
};

// Get all queued messages
export const getQueuedMessages = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return [];
  }
};

// Remove a message from the queue after it's been sent
export const dequeueMessage = async (id) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    return new Promise((res, rej) => {
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    return false;
  }
};

// Clear entire queue
export const clearQueue = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
  } catch (err) {
    console.error('Clear queue failed:', err);
  }
};