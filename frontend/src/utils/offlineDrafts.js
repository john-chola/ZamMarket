// ── Offline listing drafts (IndexedDB) ─────────────────────
// A listing created without a connection is saved here, photo
// included, and posted automatically when the connection returns.
// Separate database from the message queue so neither needs a
// version migration.

const DB_NAME = 'zammarket_drafts';
const STORE = 'listing_drafts';
const VERSION = 1;
export const DRAFTS_CHANGED = 'zammarket:drafts-changed';

const openDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const run = async (mode, fn) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result?.result ?? result);
    tx.onerror = () => reject(tx.error);
  });
};

const notify = () => window.dispatchEvent(new CustomEvent(DRAFTS_CHANGED));

// fields: { title, pricePerBag, unit, quantityAvailable, neighbourhood, description }
export const saveDraft = async (fields, image = null) => {
  await run('readwrite', (store) => store.add({
    fields,
    image,                       // File/Blob, stored as-is by IndexedDB
    imageName: image?.name || '',
    savedAt: new Date().toISOString(),
    error: '',
  }));
  notify();
};

export const getDrafts = async () => {
  try {
    const drafts = await run('readonly', (store) => store.getAll());
    return (drafts || []).sort((a, b) => a.id - b.id);
  } catch {
    return [];
  }
};

export const deleteDraft = async (id) => {
  await run('readwrite', (store) => store.delete(id));
  notify();
};

const markError = (draft, error) =>
  run('readwrite', (store) => store.put({ ...draft, error }));

export const draftToFormData = (draft) => {
  const fd = new FormData();
  Object.entries(draft.fields).forEach(([k, v]) => fd.append(k, v ?? ''));
  if (draft.image) fd.append('image', draft.image, draft.imageName || 'photo.jpg');
  return fd;
};

// Post every draft, oldest first. `post(formData)` sends one listing.
// Stops at the first network failure (still offline); a draft the
// server rejects keeps its error message so the seller can fix or delete it.
let syncing = false;
export const syncDrafts = async (post) => {
  if (syncing) return { posted: 0, failed: 0 };
  syncing = true;
  let posted = 0;
  let failed = 0;
  try {
    for (const draft of await getDrafts()) {
      try {
        await post(draftToFormData(draft));
        await run('readwrite', (store) => store.delete(draft.id));
        posted += 1;
      } catch (err) {
        if (!err.response) break; // no connection: try again later
        await markError(draft, err.response.data?.message || `Rejected by the server (${err.response.status})`);
        failed += 1;
      }
    }
  } finally {
    syncing = false;
    notify();
  }
  return { posted, failed };
};
