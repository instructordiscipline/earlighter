const STORAGE_KEY = 'earlighter.app.state.v1';
const DB_NAME = 'earlighter-local-db';
const DB_VERSION = 1;
const STORE_BLOBS = 'bookBlobs';
const SAVE_THROTTLE_MS = 1800;

const $ = (selector) => document.querySelector(selector);
const el = {
  importBookBtn: $('#importBookBtn'),
  fallbackFileInput: $('#fallbackFileInput'),
  player: $('#player'),
  progressRange: $('#progressRange'),
  playPauseBtn: $('#playPauseBtn'),
  currentTime: $('#currentTime'),
  remainingTime: $('#remainingTime'),
  speedSelect: $('#speedSelect'),
  bookTitle: $('#bookTitle'),
  bookAuthor: $('#bookAuthor'),
  bookArt: $('#bookArt'),
  savedPosition: $('#savedPosition'),
  speedReadout: $('#speedReadout'),
  transcriptStatus: $('#transcriptStatus'),
  bookList: $('#bookList'),
  libraryCount: $('#libraryCount'),
  outlineRoot: $('#outlineRoot'),
  addRootNoteBtn: $('#addRootNoteBtn'),
  organizeNotesBtn: $('#organizeNotesBtn'),
  clipList: $('#clipList'),
  clipCount: $('#clipCount'),
  toastRegion: $('#toastRegion'),
  settingsDialog: $('#settingsDialog'),
  openSettingsBtn: $('#openSettingsBtn'),
  transcriptionModeSelect: $('#transcriptionModeSelect'),
  rememberSpeedCheckbox: $('#rememberSpeedCheckbox'),
  autoOrganizeCheckbox: $('#autoOrganizeCheckbox'),
  storageEstimate: $('#storageEstimate'),
  transcriptionPresetLabel: $('#transcriptionPresetLabel')
};

const appState = loadState();
let dbPromise;
let currentBookBlob = null;
let currentBookUrl = null;
let saveTimer = null;

const CapacitorRef = window.Capacitor;
const Plugins = CapacitorRef?.Plugins ?? {};

function createDefaultState() {
  return {
    books: [],
    lastBookId: null,
    settings: {
      transcriptionMode: 'base',
      rememberSpeedPerBook: true,
      autoOrganize: true
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    return {
      ...createDefaultState(),
      ...parsed,
      settings: {
        ...createDefaultState().settings,
        ...(parsed.settings || {})
      },
      books: Array.isArray(parsed.books) ? parsed.books : []
    };
  } catch {
    return createDefaultState();
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  refreshStorageEstimate();
}

function uid(prefix = 'id') {
  const value = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

function getDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

async function putBookBlob(id, blob) {
  const db = await getDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    tx.objectStore(STORE_BLOBS).put({ id, blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBookBlob(id) {
  const db = await getDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const req = tx.objectStore(STORE_BLOBS).get(id);
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteBookBlob(id) {
  const db = await getDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    tx.objectStore(STORE_BLOBS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function formatTime(seconds) {
  const safe = Math.max(0, Number.isFinite(seconds) ? Math.floor(seconds) : 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes) {
  const mb = (bytes || 0) / (1024 * 1024);
  return `${mb.toFixed(mb > 100 ? 0 : 1)} MB`;
}

function parseDisplayName(fileName) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled audiobook';
}

function initials(text) {
  return text.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'EA';
}

async function readPickedFileAsBlob() {
  if (Plugins.FilePicker) {
    try {
      if (Plugins.FilePicker.requestPermissions) {
        await Plugins.FilePicker.requestPermissions({ permissions: ['readExternalStorage'] }).catch(() => {});
      }
      const result = await Plugins.FilePicker.pickFiles({ types: ['audio/*'], limit: 1 });
      const file = result.files?.[0];
      if (!file) return null;
      if (file.path && CapacitorRef?.convertFileSrc) {
        const webPath = CapacitorRef.convertFileSrc(file.path);
        const response = await fetch(webPath);
        const blob = await response.blob();
        return { blob, name: file.name || 'Imported audiobook.mp3', mimeType: file.mimeType || blob.type || 'audio/mpeg', size: file.size || blob.size };
      }
      if (file.data) {
        const byteCharacters = atob(file.data);
        const array = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i += 1) array[i] = byteCharacters.charCodeAt(i);
        const blob = new Blob([array], { type: file.mimeType || 'audio/mpeg' });
        return { blob, name: file.name || 'Imported audiobook.mp3', mimeType: file.mimeType || blob.type || 'audio/mpeg', size: file.size || blob.size };
      }
    } catch (error) {
      console.warn('Native file pick failed, falling back to browser picker.', error);
    }
  }

  return await new Promise((resolve) => {
    el.fallbackFileInput.value = '';
    el.fallbackFileInput.onchange = () => {
      const file = el.fallbackFileInput.files?.[0];
      if (!file) return resolve(null);
      resolve({ blob: file, name: file.name, mimeType: file.type || 'audio/mpeg', size: file.size || 0 });
    };
    el.fallbackFileInput.click();
  });
}

async function getAudioDuration(blob) {
  return await new Promise((resolve, reject) => {
    const tempAudio = new Audio();
    const tempUrl = URL.createObjectURL(blob);
    tempAudio.preload = 'metadata';
    tempAudio.src = tempUrl;
    tempAudio.onloadedmetadata = () => {
      URL.revokeObjectURL(tempUrl);
      resolve(tempAudio.duration || 0);
    };
    tempAudio.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      reject(new Error('Unable to read audio metadata.'));
    };
  });
}

async function importBook() {
  try {
    const picked = await readPickedFileAsBlob();
    if (!picked?.blob) return;

    showToast('Importing audiobook into secure offline storage…');
    const durationSec = await getAudioDuration(picked.blob);
    const title = parseDisplayName(picked.name);
    const id = uid('book');

    const book = {
      id,
      title,
      author: 'Local MP3',
      durationMs: Math.round(durationSec * 1000),
      size: picked.size,
      importedAt: Date.now(),
      updatedAt: Date.now(),
      lastOpenedAt: Date.now(),
      lastPositionMs: 0,
      speed: 1,
      transcriptStatus: 'Runtime not bundled',
      clips: [],
      outline: [],
      playbackHistory: [],
      sourceName: picked.name,
      ai: {
        modelLabel: 'TinyLlama planned',
        transcriptModelLabel: readableTranscriptionMode(appState.settings.transcriptionMode)
      }
    };

    await putBookBlob(id, picked.blob);
    appState.books.unshift(book);
    appState.lastBookId = id;
    persistState();
    await loadBook(id);
    refreshUI();
    await haptic('impactLight');
    showToast(`Imported “${title}”.`);
  } catch (error) {
    console.error(error);
    showToast('Import failed. Try a smaller or standard MP3 file.');
  }
}

function currentBook() {
  return appState.books.find(book => book.id === appState.lastBookId) || null;
}

async function loadBook(bookId) {
  const book = appState.books.find(item => item.id === bookId);
  if (!book) return;
  appState.lastBookId = book.id;
  book.lastOpenedAt = Date.now();
  persistState();

  if (currentBookUrl) {
    URL.revokeObjectURL(currentBookUrl);
    currentBookUrl = null;
  }

  currentBookBlob = await getBookBlob(book.id);
  if (!currentBookBlob) {
    showToast('This audiobook file is missing from local storage.');
    return;
  }

  currentBookUrl = URL.createObjectURL(currentBookBlob);
  el.player.src = currentBookUrl;
  el.player.playbackRate = book.speed || 1;
  el.speedSelect.value = String(book.speed || 1);
  el.speedReadout.textContent = `${(book.speed || 1).toFixed(2).replace(/\.00$/, '.0')}×`;

  el.player.onloadedmetadata = () => {
    el.player.currentTime = (book.lastPositionMs || 0) / 1000;
    updateProgressUI();
  };

  refreshUI();
}

function readableTranscriptionMode(mode) {
  if (mode === 'tiny') return 'Low quality but fast';
  if (mode === 'small') return 'High quality but slow';
  return 'Balanced';
}

function updateHero() {
  const book = currentBook();
  el.bookTitle.textContent = book?.title || 'No audiobook imported';
  el.bookAuthor.textContent = book ? `${book.author} • ${formatBytes(book.size || 0)}` : 'Import an MP3 to start listening offline.';
  el.bookArt.textContent = initials(book?.title || 'Earlighter');
  el.savedPosition.textContent = book ? formatTime((book.lastPositionMs || 0) / 1000) : '00:00';
  el.speedReadout.textContent = `${(book?.speed || 1).toFixed(2).replace(/\.00$/, '.0')}×`;
  el.transcriptStatus.textContent = book?.transcriptStatus || 'Transcript runtime not bundled';
  el.transcriptionPresetLabel.textContent = readableTranscriptionMode(appState.settings.transcriptionMode);
}

function renderLibrary() {
  const books = [...appState.books].sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
  el.libraryCount.textContent = `${books.length} ${books.length === 1 ? 'book' : 'books'}`;

  if (!books.length) {
    el.bookList.innerHTML = `<div class="empty-state">Import an MP3 and Earlighter will store it locally, remember your last position, and keep one note document per book.</div>`;
    return;
  }

  el.bookList.innerHTML = books.map((book) => {
    const active = appState.lastBookId === book.id ? 'active' : '';
    return `
      <article class="book-item ${active}" data-book-id="${book.id}">
        <div class="book-item-meta">
          <div class="book-item-title">${escapeHtml(book.title)}</div>
          <div class="book-item-sub">${formatTime((book.durationMs || 0) / 1000)} • ${formatTime((book.lastPositionMs || 0) / 1000)} saved • ${escapeHtml(book.sourceName || '')}</div>
        </div>
        <div class="book-item-actions">
          <button type="button" data-action="open-book" data-book-id="${book.id}" title="Open">↗</button>
          <button type="button" data-action="delete-book" data-book-id="${book.id}" title="Delete">✕</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderClips() {
  const book = currentBook();
  const clips = book?.clips || [];
  el.clipCount.textContent = `${clips.length} ${clips.length === 1 ? 'clip' : 'clips'}`;

  if (!book) {
    el.clipList.innerHTML = `<div class="empty-state">Open an audiobook to start capturing the last 10, 30, or 60 seconds as structured note anchors.</div>`;
    return;
  }

  if (!clips.length) {
    el.clipList.innerHTML = `<div class="empty-state">No clips yet. Tap Save 10s, Save 30s, or Save 60s while listening.</div>`;
    return;
  }

  const ordered = [...clips].sort((a, b) => b.createdAt - a.createdAt);
  el.clipList.innerHTML = ordered.map((clip) => `
    <article class="clip-card">
      <div class="clip-meta">
        <div>
          <div class="clip-title">${escapeHtml(clip.title)}</div>
          <div class="subtle">${formatTime(clip.startMs / 1000)} → ${formatTime(clip.endMs / 1000)} • ${clip.durationMs / 1000}s source time</div>
        </div>
        <div class="clip-actions-mini">
          <button data-action="jump-clip" data-clip-id="${clip.id}" title="Jump">⤴</button>
          <button data-action="note-clip" data-clip-id="${clip.id}" title="Add note">＋</button>
        </div>
      </div>
      <div class="subtle">${escapeHtml(clip.summary || 'Captured moment saved. Add a note or jump back into the book.')}</div>
    </article>
  `).join('');
}

function getOutline(book = currentBook()) {
  if (!book) return [];
  if (!Array.isArray(book.outline)) book.outline = [];
  return book.outline;
}

function renderOutline() {
  const book = currentBook();
  if (!book) {
    el.outlineRoot.innerHTML = `<div class="empty-state">Every audiobook gets a single hierarchical notes document here.</div>`;
    return;
  }

  const outline = getOutline(book);
  if (!outline.length) {
    el.outlineRoot.innerHTML = `<div class="empty-state">No bullets yet. Capture a clip or add a root bullet.</div>`;
    return;
  }

  el.outlineRoot.innerHTML = renderNodes(outline, 0);
}

function renderNodes(nodes, level) {
  return nodes.map((node) => `
    <div class="note-node" data-node-id="${node.id}" style="margin-left:${level === 0 ? 0 : 0}px">
      <div class="note-row">
        <div class="note-bullet"></div>
        <textarea class="note-input" data-role="note-input" data-node-id="${node.id}" rows="${Math.max(2, Math.min(8, (node.text || '').length > 140 ? 4 : 2))}">${escapeHtml(node.text || '')}</textarea>
        <div class="note-toolbar">
          <button class="outline-action" data-action="add-sibling" data-node-id="${node.id}" title="Add sibling">＋</button>
          <button class="outline-action" data-action="add-child" data-node-id="${node.id}" title="Add child">↳</button>
          <button class="outline-action" data-action="indent" data-node-id="${node.id}" title="Indent">⇥</button>
          <button class="outline-action" data-action="outdent" data-node-id="${node.id}" title="Outdent">⇤</button>
          <button class="outline-action" data-action="delete-node" data-node-id="${node.id}" title="Delete">✕</button>
        </div>
      </div>
      ${node.children?.length ? `<div class="note-children">${renderNodes(node.children, level + 1)}</div>` : ''}
    </div>
  `).join('');
}

function findNodeContext(targetId, nodes = getOutline(), parentArray = null, parentNode = null, grandParentArray = null, grandParentNode = null) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === targetId) {
      return { node, index, parentArray: nodes, parentNode, grandParentArray, grandParentNode };
    }
    if (node.children?.length) {
      const found = findNodeContext(targetId, node.children, node.children, node, nodes, parentNode);
      if (found) return found;
    }
  }
  return null;
}

function addRootNode(text = '') {
  const outline = getOutline();
  outline.push(createNode(text));
  persistState();
  renderOutline();
}

function createNode(text) {
  return { id: uid('node'), text, children: [] };
}

function updateNodeText(id, text) {
  const context = findNodeContext(id);
  if (!context) return;
  context.node.text = text;
  context.node.updatedAt = Date.now();
  persistState();
}

function handleOutlineAction(action, id) {
  const context = findNodeContext(id);
  if (!context) return;
  if (action === 'delete-node') {
    context.parentArray.splice(context.index, 1);
  } else if (action === 'add-sibling') {
    context.parentArray.splice(context.index + 1, 0, createNode(''));
  } else if (action === 'add-child') {
    context.node.children = context.node.children || [];
    context.node.children.unshift(createNode(''));
  } else if (action === 'indent') {
    if (context.index > 0) {
      const [node] = context.parentArray.splice(context.index, 1);
      const previousSibling = context.parentArray[context.index - 1];
      previousSibling.children = previousSibling.children || [];
      previousSibling.children.push(node);
    }
  } else if (action === 'outdent') {
    if (context.grandParentArray) {
      const [node] = context.parentArray.splice(context.index, 1);
      const parentIndex = context.grandParentArray.findIndex(item => item.id === context.parentNode.id);
      context.grandParentArray.splice(parentIndex + 1, 0, node);
    }
  }
  persistState();
  renderOutline();
}

function ensureCategoryRoots(book) {
  const labels = ['Captured clips', 'Mindsets', 'Actions', 'Quotes', 'Questions'];
  labels.forEach((label) => {
    if (!book.outline.some(node => (node.text || '').trim().toLowerCase() === label.toLowerCase())) {
      book.outline.push(createNode(label));
    }
  });
}

function classifyText(text) {
  const normalized = (text || '').toLowerCase();
  if (/(should|must|need to|do this|next step|action)/.test(normalized)) return 'Actions';
  if (/(believe|mindset|identity|discipline|focus|habit)/.test(normalized)) return 'Mindsets';
  if (/(\?|question|wonder|unclear)/.test(normalized)) return 'Questions';
  if (/^"|quote|remember this|line/.test(normalized)) return 'Quotes';
  return 'Captured clips';
}

function organizeOutline() {
  const book = currentBook();
  if (!book) return;
  ensureCategoryRoots(book);
  const labels = new Map(book.outline.map(node => [node.text.trim().toLowerCase(), node]));
  const categories = ['Captured clips', 'Mindsets', 'Actions', 'Quotes', 'Questions'];
  const categorizedIds = new Set(categories.map(label => labels.get(label.toLowerCase())?.id).filter(Boolean));
  const loose = book.outline.filter(node => !categorizedIds.has(node.id));
  book.outline = book.outline.filter(node => categorizedIds.has(node.id));

  for (const node of loose) {
    const category = classifyText(node.text);
    const parent = labels.get(category.toLowerCase());
    parent.children = parent.children || [];
    parent.children.push(node);
  }
  persistState();
  renderOutline();
  showToast('Notes organized into a clean hierarchy.');
}

function createClipSummary(clip) {
  return `Saved from ${formatTime(clip.startMs / 1000)} to ${formatTime(clip.endMs / 1000)}. Add a note to preserve the insight behind this moment.`;
}

function createClip(seconds) {
  const book = currentBook();
  if (!book || !Number.isFinite(el.player.currentTime)) {
    showToast('Open an audiobook before capturing clips.');
    return;
  }
  const endMs = Math.round(el.player.currentTime * 1000);
  const startMs = Math.max(0, endMs - seconds * 1000);
  const clip = {
    id: uid('clip'),
    createdAt: Date.now(),
    startMs,
    endMs,
    durationMs: seconds * 1000,
    sourcePlaybackSpeedAtCapture: el.player.playbackRate || 1,
    title: `Clip ${formatTime(startMs / 1000)}–${formatTime(endMs / 1000)}`,
    summary: createClipSummary({ startMs, endMs })
  };
  book.clips = book.clips || [];
  book.clips.unshift(clip);

  const outline = getOutline(book);
  if (appState.settings.autoOrganize) ensureCategoryRoots(book);
  const node = createNode(`${clip.title} — ${clip.summary}`);
  if (appState.settings.autoOrganize) {
    const bucketName = classifyText(node.text);
    const bucket = book.outline.find(item => item.text.trim().toLowerCase() === bucketName.toLowerCase());
    bucket.children = bucket.children || [];
    bucket.children.unshift(node);
  } else {
    outline.unshift(node);
  }

  persistState();
  renderClips();
  renderOutline();
  haptic('impactMedium');
  showToast(`Saved the last ${seconds} seconds.`);
}

function jumpToClip(clipId) {
  const book = currentBook();
  const clip = book?.clips?.find(item => item.id === clipId);
  if (!clip) return;
  el.player.currentTime = clip.startMs / 1000;
  updateProgressUI();
  el.player.play().catch(() => {});
  showToast(`Jumped to ${formatTime(clip.startMs / 1000)}.`);
}

function addClipBullet(clipId) {
  const book = currentBook();
  const clip = book?.clips?.find(item => item.id === clipId);
  if (!clip) return;
  getOutline(book).unshift(createNode(`${clip.title} — `));
  persistState();
  renderOutline();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function schedulePositionSave() {
  if (saveTimer) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    savePlaybackPosition();
  }, SAVE_THROTTLE_MS);
}

function savePlaybackPosition() {
  const book = currentBook();
  if (!book || !Number.isFinite(el.player.currentTime)) return;
  book.lastPositionMs = Math.round(el.player.currentTime * 1000);
  book.updatedAt = Date.now();
  persistState();
  updateHero();
}

function updateProgressUI() {
  const duration = Number.isFinite(el.player.duration) ? el.player.duration : (currentBook()?.durationMs || 0) / 1000;
  const current = Number.isFinite(el.player.currentTime) ? el.player.currentTime : (currentBook()?.lastPositionMs || 0) / 1000;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
  el.progressRange.value = Math.round(ratio * 1000);
  el.currentTime.textContent = formatTime(current);
  el.remainingTime.textContent = duration > 0 ? `-${formatTime(Math.max(0, duration - current))}` : '00:00';
}

async function refreshStorageEstimate() {
  const blobBytes = appState.books.reduce((sum, book) => sum + (book.size || 0), 0);
  const metadataBytes = new Blob([JSON.stringify(appState)]).size;
  el.storageEstimate.textContent = formatBytes(blobBytes + metadataBytes);
}

function refreshUI() {
  updateHero();
  renderLibrary();
  renderOutline();
  renderClips();
  refreshStorageEstimate();
  el.transcriptionModeSelect.value = appState.settings.transcriptionMode;
  el.rememberSpeedCheckbox.checked = appState.settings.rememberSpeedPerBook;
  el.autoOrganizeCheckbox.checked = appState.settings.autoOrganize;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  el.toastRegion.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
  }, 2200);
  setTimeout(() => toast.remove(), 2700);
}

async function haptic(type) {
  try {
    if (Plugins.Haptics?.[type]) {
      await Plugins.Haptics[type]();
    }
  } catch {
    // no-op
  }
}

async function deleteBook(bookId) {
  const index = appState.books.findIndex(book => book.id === bookId);
  if (index < 0) return;
  const [book] = appState.books.splice(index, 1);
  await deleteBookBlob(book.id);
  if (appState.lastBookId === book.id) {
    appState.lastBookId = appState.books[0]?.id || null;
    if (appState.lastBookId) {
      await loadBook(appState.lastBookId);
    } else {
      if (currentBookUrl) URL.revokeObjectURL(currentBookUrl);
      currentBookUrl = null;
      currentBookBlob = null;
      el.player.removeAttribute('src');
      el.player.load();
    }
  }
  persistState();
  refreshUI();
  showToast(`Deleted “${book.title}”.`);
}

function bindEvents() {
  el.importBookBtn.addEventListener('click', importBook);
  el.openSettingsBtn.addEventListener('click', () => el.settingsDialog.showModal());
  el.transcriptionModeSelect.addEventListener('change', () => {
    appState.settings.transcriptionMode = el.transcriptionModeSelect.value;
    persistState();
    refreshUI();
  });
  el.rememberSpeedCheckbox.addEventListener('change', () => {
    appState.settings.rememberSpeedPerBook = el.rememberSpeedCheckbox.checked;
    persistState();
  });
  el.autoOrganizeCheckbox.addEventListener('change', () => {
    appState.settings.autoOrganize = el.autoOrganizeCheckbox.checked;
    persistState();
  });

  el.playPauseBtn.addEventListener('click', async () => {
    if (!currentBook()) {
      showToast('Import an audiobook to start listening.');
      return;
    }
    if (el.player.paused) {
      await el.player.play().catch(() => showToast('Playback could not start.'));
    } else {
      el.player.pause();
    }
  });

  document.querySelectorAll('[data-skip]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!currentBook()) return;
      const delta = Number(button.dataset.skip || 0);
      el.player.currentTime = Math.max(0, Math.min((el.player.duration || Infinity), (el.player.currentTime || 0) + delta));
      updateProgressUI();
      schedulePositionSave();
      haptic('impactLight');
    });
  });

  document.querySelectorAll('[data-capture]').forEach((button) => {
    button.addEventListener('click', () => createClip(Number(button.dataset.capture || 0)));
  });

  el.speedSelect.addEventListener('change', () => {
    const speed = Number(el.speedSelect.value || 1);
    el.player.playbackRate = speed;
    const book = currentBook();
    if (book && appState.settings.rememberSpeedPerBook) {
      book.speed = speed;
      persistState();
      updateHero();
    }
    el.speedReadout.textContent = `${speed.toFixed(2).replace(/\.00$/, '.0')}×`;
  });

  el.progressRange.addEventListener('input', () => {
    if (!currentBook()) return;
    const duration = el.player.duration || ((currentBook()?.durationMs || 0) / 1000);
    el.player.currentTime = (Number(el.progressRange.value) / 1000) * duration;
    updateProgressUI();
  });
  el.progressRange.addEventListener('change', schedulePositionSave);

  el.player.addEventListener('timeupdate', () => {
    updateProgressUI();
    schedulePositionSave();
  });
  el.player.addEventListener('play', () => {
    el.playPauseBtn.textContent = 'Pause';
  });
  el.player.addEventListener('pause', () => {
    el.playPauseBtn.textContent = 'Play';
    savePlaybackPosition();
  });
  el.player.addEventListener('ended', () => {
    el.playPauseBtn.textContent = 'Play';
    savePlaybackPosition();
  });

  el.addRootNoteBtn.addEventListener('click', () => addRootNode(''));
  el.organizeNotesBtn.addEventListener('click', organizeOutline);

  el.bookList.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    const bookId = target.dataset.bookId;
    const action = target.dataset.action;
    if (action === 'open-book') {
      await loadBook(bookId);
    }
    if (action === 'delete-book') {
      await deleteBook(bookId);
    }
  });

  el.clipList.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    const clipId = target.dataset.clipId;
    const action = target.dataset.action;
    if (action === 'jump-clip') jumpToClip(clipId);
    if (action === 'note-clip') addClipBullet(clipId);
  });

  el.outlineRoot.addEventListener('input', (event) => {
    const target = event.target.closest('[data-role="note-input"]');
    if (!target) return;
    updateNodeText(target.dataset.nodeId, target.value);
  });

  el.outlineRoot.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-action]');
    if (!target) return;
    handleOutlineAction(target.dataset.action, target.dataset.nodeId);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) savePlaybackPosition();
  });
  window.addEventListener('beforeunload', savePlaybackPosition);
}

async function init() {
  bindEvents();
  refreshUI();
  if (appState.lastBookId) {
    await loadBook(appState.lastBookId);
  }
  refreshUI();
}

init();
