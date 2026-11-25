const DB_NAME = 'chronostasis';
const DB_VERSION = 1;

let connection;

function openDb() {
  if (connection) return Promise.resolve(connection);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('commitments')) db.createObjectStore('commitments', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('occurrences')) db.createObjectStore('occurrences', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('samples')) db.createObjectStore('samples', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      connection = request.result;
      connection.onversionchange = () => {
        connection.close();
        connection = null;
      };
      resolve(connection);
    };
    request.onerror = () => reject(request.error);
  });
}

function run(storeNames, mode, work) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let value;
    try {
      value = work(tx);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  }));
}

export function loadAll() {
  return run(['kv', 'commitments', 'occurrences', 'samples'], 'readonly', (tx) => {
    const bag = {
      keys: tx.objectStore('kv').getAllKeys(),
      values: tx.objectStore('kv').getAll(),
      commitments: tx.objectStore('commitments').getAll(),
      occurrences: tx.objectStore('occurrences').getAll(),
      samples: tx.objectStore('samples').getAll(),
    };
    bag.unpack = () => {
      const kv = {};
      bag.keys.result.forEach((key, index) => {
        kv[key] = bag.values.result[index];
      });
      const occurrences = {};
      for (const row of bag.occurrences.result) occurrences[row.key] = row;
      return {
        kv,
        commitments: bag.commitments.result,
        occurrences,
        samples: bag.samples.result,
      };
    };
    return bag;
  }).then((bag) => bag.unpack());
}

export function putKv(key, value) {
  return run('kv', 'readwrite', (tx) => {
    const store = tx.objectStore('kv');
    if (value == null) store.delete(key);
    else store.put(value, key);
  });
}

export function saveCommitment(commitment) {
  return run('commitments', 'readwrite', (tx) => {
    tx.objectStore('commitments').put(commitment);
  });
}

export function deleteCommitment(id) {
  return run('commitments', 'readwrite', (tx) => {
    tx.objectStore('commitments').delete(id);
  });
}

export function saveOccurrence(occurrence) {
  return run('occurrences', 'readwrite', (tx) => {
    tx.objectStore('occurrences').put(occurrence);
  });
}

export function addSample(sample) {
  return run('samples', 'readwrite', (tx) => {
    const store = tx.objectStore('samples');
    store.put(sample);
    const all = store.getAll();
    all.onsuccess = () => {
      const same = all.result
        .filter((row) => row.commitmentId === sample.commitmentId && row.kind === sample.kind)
        .sort((a, b) => a.at - b.at);
      const extra = same.slice(0, Math.max(0, same.length - 40));
      for (const old of extra) store.delete(old.id);
    };
  });
}

export async function exportPayload() {
  const data = await loadAll();
  return {
    app: 'chronostasis',
    version: 1,
    exportedAt: new Date().toISOString(),
    commitments: data.commitments,
    occurrences: Object.values(data.occurrences),
    samples: data.samples,
    settings: data.kv.settings ?? null,
    pending: data.kv.pending ?? null,
    consent: data.kv.consent ?? null,
  };
}

export function deleteEverything() {
  if (connection) {
    connection.close();
    connection = null;
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
