const STORAGE_KEY = 'earlighter-state-v2';
const DB_NAME = 'earlighter-db';
const DB_VERSION = 1;
const STORE_BLOBS = 'book-blobs';
const SAVE_THROTTLE_MS = 1200;
const MAX_INDENT = 8;

const $ = (selector) => document.querySelector(selector);

const el = {
  appRoot: $('#appRoot'),
  sidebar: $('#sidebar'),
  sidebarBackdrop: $('#sidebarBackdrop'),
  openSidebarBtn: $('#openSidebarBtn'),
  closeSidebarBtn: $('#closeSidebarBtn'),
  sidebarTabs: [...document.querySelectorAll('.sidebar-tab')],
  libraryPanel: $('#libraryPanel'),
  settingsPanel: $('#settingsPanel'),
  libraryGrid: $('#libraryGrid'),
  libraryFolderLabel: $('#libraryFolderLabel'),
  libraryFolderInput: $('#libraryFolderInput'),
  transcriptionModeSelect: $('#transcriptionModeSelect'),
  rememberSpeedCheckbox: $('#rememberSpeedCheckbox'),
  saveSettingsBtn: $('#saveSettingsBtn'),

  playerView: $('#playerView'),
  notesView: $('#notesView'),
  bottomTabs: [...document.querySelectorAll('.bottom-tab')],
  coverButton: $('#coverButton'),
  coverArt: $('#coverArt'),
  coverHint: $('#coverHint'),
  bookTitle: $('#bookTitle'),
  notesBookTitle: $('#notesBookTitle'),

  player: $('#player'),
  progressRange: $('#progressRange'),
  notesProgressRange: $('#notesProgressRange'),
  currentTime: $('#currentTime'),
  remainingTime: $('#remainingTime'),
  notesCurrentTime: $('#notesCurrentTime'),
  notesRemainingTime: $('#notesRemainingTime'),
  playPauseBtn: $('#playPauseBtn'),
  notesPlayPauseBtn: $('#notesPlayPauseBtn'),
  playIcon: $('#playIcon'),
  pauseIcon: $('#pauseIcon'),
  notesPlayIcon: $('#notesPlayIcon'),
  notesPauseIcon: $('#notesPauseIcon'),

  openSpeedBtn: $('#openSpeedBtn'),
  speedDialog: $('#speedDialog'),
  speedSlider: $('#speedSlider'),
  speedReadout: $('#speedReadout'),

  notesDocument: $('#notesDocument'),
  addNoteLineBtn: $('#addNoteLineBtn'),

  librarySetupDialog: $('#librarySetupDialog'),
  librarySetupForm: $('#librarySetupForm'),
  librarySetupInput: $('#librarySetupInput'),

  toastRegion: $('#toastRegion'),
  fallbackFileInput: $('#fallbackFileInput')
};

const CapacitorRef = window.Capacitor;
const Plugins = CapacitorRef?.Plugins ?? {};

let dbPromise;
let currentBookBlob = null;
let currentBookUrl = null;
let saveTimer = null;
let draggedLineId = null;
let pendingFocusLineId = null;

const appState = loadState();

function createDefaultState() {
  return {
    books: [],
    lastBookId: null,
    settings: {
      transcriptionMode: 'base',
      rememberSpeedPerBook: true,
      libraryFolderName: ''
    },
    ui: {
      activeTab: 'player',
      sidebarTab: 'library'
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    const state = {
      ...createDefaultState(),
      ...parsed,
      settings: {
        ...createDefaultState().settings,
        ...(parsed.settings || {})
      },
      ui: {
        ...createDefaultState().ui,
        ...(parsed.ui || {})
      },
      books: Array.isArray(parsed.books) ? parsed.books : []
    };
    state.books = state.books.map(migrateBook);
    return state;
  } catch {
    return createDefaultState();
  }
}

function migrateBook(book) {
  const migrated = {
    ...book,
    notesDoc: Array.isArray(book.notesDoc) ? book.notesDoc : flattenOutline(book.outline || []),
    speed: Number.isFinite(book.speed) ? book.speed : 1,
    coverLabel: book.coverLabel || initials(book.title || 'Earlighter')
  };
  if (!migrated.notesDoc.length) migrated.notesDoc = [createNoteLine('')];
  delete migrated.outline;
  return migrated;
}

function flattenOutline(nodes, indent = 0, lines = []) {
  for (const node of nodes) {
    lines.push({ id: node.id || uid('line'), text: node.text || '', indent: Math.min(indent, MAX_INDENT) });
    if (Array.isArray(node.children) && node.children.length) flattenOutline(node.children, indent + 1, lines);
  }
  return lines;
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function uid(prefix = 'id') {
  const value = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

function initials(text) {
  return (text || 'Earlighter')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'EA';
}

function parseDisplayName(fileName) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled audiobook';
}

function formatTime(seconds) {
  const safe = Math.max(0, Number.isFinite(seconds) ? Math.floor(seconds) : 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function currentBook() {
  return appState.books.find((book) => book.id === appState.lastBookId) || null;
}

function createNoteLine(text = '', indent = 0) {
  return {
    id: uid('line'),
    text,
    indent: Math.max(0, Math.min(MAX_INDENT, indent))
  };
}

function getNotesDoc(book = currentBook()) {
  if (!book) return [];
  if (!Array.isArray(book.notesDoc)) book.notesDoc = [createNoteLine('')];
  if (!book.notesDoc.length) book.notesDoc = [createNoteLine('')];
  return book.notesDoc;
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
        return { blob, name: file.name || 'Imported audiobook.mp3', size: file.size || blob.size };
      }
      if (file.data) {
        const binary = atob(file.data);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) array[i] = binary.charCodeAt(i);
        const blob = new Blob([array], { type: file.mimeType || 'audio/mpeg' });
        return { blob, name: file.name || 'Imported audiobook.mp3', size: file.size || blob.size };
      }
    } catch (error) {
      console.warn('Native file picker failed, using browser fallback.', error);
    }
  }

  return await new Promise((resolve) => {
    el.fallbackFileInput.value = '';
    el.fallbackFileInput.onchange = () => {
      const file = el.fallbackFileInput.files?.[0];
      if (!file) return resolve(null);
      resolve({ blob: file, name: file.name, size: file.size || 0 });
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
  if (!appState.settings.libraryFolderName.trim()) {
    openLibrarySetup(true);
    return;
  }

  try {
    const picked = await readPickedFileAsBlob();
    if (!picked?.blob) return;

    showToast('Importing audiobook…');
    const durationSec = await getAudioDuration(picked.blob);
    const title = parseDisplayName(picked.name);
    const id = uid('book');

    const book = {
      id,
      title,
      durationMs: Math.round(durationSec * 1000),
      size: picked.size,
      sourceName: picked.name,
      importedAt: Date.now(),
      updatedAt: Date.now(),
      lastOpenedAt: Date.now(),
      lastPositionMs: 0,
      speed: 1,
      coverLabel: initials(title),
      notesDoc: [createNoteLine('')]
    };

    await putBookBlob(id, picked.blob);
    appState.books.unshift(book);
    appState.lastBookId = id;
    persistState();
    await loadBook(id);
    renderApp();
    await haptic('impactLight');
    showToast(`Imported “${title}”.`);
  } catch (error) {
    console.error(error);
    showToast('Import failed. Try a standard MP3 file.');
  }
}

async function loadBook(bookId) {
  const book = appState.books.find((item) => item.id === bookId);
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
  el.speedSlider.value = String(book.speed || 1);
  updateSpeedReadout(book.speed || 1);

  el.player.onloadedmetadata = () => {
    el.player.currentTime = (book.lastPositionMs || 0) / 1000;
    updateProgressUI();
  };

  renderApp();
}

function openSidebar() {
  el.appRoot.classList.add('sidebar-open');
}

function closeSidebar() {
  el.appRoot.classList.remove('sidebar-open');
}

function setSidebarTab(tab, persist = true) {
  appState.ui.sidebarTab = tab;
  if (persist) persistState();
  el.sidebarTabs.forEach((button) => button.classList.toggle('active', button.dataset.sidebarTab === tab));
  el.libraryPanel.classList.toggle('active', tab === 'library');
  el.settingsPanel.classList.toggle('active', tab === 'settings');
}

function setActiveTab(tab, persist = true) {
  appState.ui.activeTab = tab;
  if (persist) persistState();
  el.bottomTabs.forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  el.playerView.classList.toggle('active', tab === 'player');
  el.notesView.classList.toggle('active', tab === 'notes');
}

function updateSpeedReadout(speed) {
  el.speedReadout.textContent = `${Number(speed).toFixed(2).replace(/\.00$/, '.0').replace(/(\.\d)0$/, '$1')}×`;
}

function updateBookUI() {
  const book = currentBook();
  el.bookTitle.textContent = book?.title || 'No audiobook selected';
  el.notesBookTitle.textContent = book?.title || 'No audiobook selected';
  el.coverArt.textContent = book?.coverLabel || 'EA';
  el.coverHint.textContent = book ? 'Tap cover to import another MP3' : 'Tap to import an MP3';
  el.libraryFolderLabel.textContent = appState.settings.libraryFolderName.trim() || 'No library folder set yet';
  el.libraryFolderInput.value = appState.settings.libraryFolderName || '';
  el.transcriptionModeSelect.value = appState.settings.transcriptionMode;
  el.rememberSpeedCheckbox.checked = !!appState.settings.rememberSpeedPerBook;
  const speed = book?.speed || 1;
  el.speedSlider.value = String(speed);
  updateSpeedReadout(speed);
}

function renderLibrary() {
  const books = [...appState.books].sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
  if (!books.length) {
    el.libraryGrid.innerHTML = `<div class="library-empty">Import an MP3 by tapping the cover on the player screen.</div>`;
    return;
  }

  el.libraryGrid.innerHTML = books.map((book) => `
    <button class="library-card ${book.id === appState.lastBookId ? 'active' : ''}" type="button" data-book-id="${book.id}">
      <div class="library-cover">${escapeHtml(book.coverLabel || initials(book.title))}</div>
      <div class="library-title">${escapeHtml(book.title)}</div>
    </button>
  `).join('');
}

function renderNotesDocument() {
  const book = currentBook();
  if (!book) {
    el.notesDocument.innerHTML = `<div class="note-empty">Import an audiobook to start a note document for it.</div>`;
    return;
  }

  const lines = getNotesDoc(book);
  el.notesDocument.innerHTML = '';

  lines.forEach((line) => {
    const row = document.createElement('div');
    row.className = 'note-line';
    row.dataset.lineId = line.id;
    row.dataset.indent = String(line.indent || 0);
    row.draggable = true;

    const handle = document.createElement('button');
    handle.className = 'drag-handle';
    handle.type = 'button';
    handle.setAttribute('aria-label', 'Drag line');
    handle.textContent = '⋮⋮';

    const bullet = document.createElement('div');
    bullet.className = 'note-bullet';

    const editor = document.createElement('textarea');
    editor.className = 'note-editor';
    editor.dataset.lineId = line.id;
    editor.rows = 1;
    editor.placeholder = lines.length === 1 ? 'Start writing…' : '';
    editor.value = line.text || '';

    row.append(handle, bullet, editor);
    el.notesDocument.appendChild(row);
    autoSizeTextarea(editor);
  });

  if (pendingFocusLineId) {
    focusLine(pendingFocusLineId);
    pendingFocusLineId = null;
  }
}

function autoSizeTextarea(textarea) {
  textarea.style.height = '0px';
  textarea.style.height = `${Math.max(28, textarea.scrollHeight)}px`;
}

function focusLine(lineId, toEnd = true) {
  const textarea = el.notesDocument.querySelector(`textarea[data-line-id="${lineId}"]`);
  if (!textarea) return;
  textarea.focus();
  if (toEnd) {
    const length = textarea.value.length;
    textarea.setSelectionRange(length, length);
  }
}

function updateProgressUI() {
  const duration = Number.isFinite(el.player.duration) ? el.player.duration : (currentBook()?.durationMs || 0) / 1000;
  const current = Number.isFinite(el.player.currentTime) ? el.player.currentTime : (currentBook()?.lastPositionMs || 0) / 1000;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
  const rangeValue = Math.round(ratio * 1000);
  el.progressRange.value = rangeValue;
  el.notesProgressRange.value = rangeValue;
  el.currentTime.textContent = formatTime(current);
  el.remainingTime.textContent = duration > 0 ? `-${formatTime(Math.max(0, duration - current))}` : '-00:00';
  el.notesCurrentTime.textContent = formatTime(current);
  el.notesRemainingTime.textContent = duration > 0 ? `-${formatTime(Math.max(0, duration - current))}` : '-00:00';
}

function syncPlayButtons(isPlaying) {
  el.playIcon.classList.toggle('hidden', isPlaying);
  el.pauseIcon.classList.toggle('hidden', !isPlaying);
  el.notesPlayIcon.classList.toggle('hidden', isPlaying);
  el.notesPauseIcon.classList.toggle('hidden', !isPlaying);
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
}

function setPlaybackSpeed(speed) {
  const safeSpeed = Math.max(0.5, Math.min(3, Number(speed) || 1));
  el.player.playbackRate = safeSpeed;
  el.speedSlider.value = String(safeSpeed);
  updateSpeedReadout(safeSpeed);
  const book = currentBook();
  if (book && appState.settings.rememberSpeedPerBook) {
    book.speed = safeSpeed;
    persistState();
  }
}

function insertNoteAfter(lineId) {
  const lines = getNotesDoc();
  const index = lines.findIndex((line) => line.id === lineId);
  if (index < 0) return;
  const indent = lines[index].indent || 0;
  const newLine = createNoteLine('', indent);
  lines.splice(index + 1, 0, newLine);
  persistState();
  pendingFocusLineId = newLine.id;
  renderNotesDocument();
}

function addNoteLine() {
  const book = currentBook();
  if (!book) {
    showToast('Import an audiobook first.');
    return;
  }
  const lines = getNotesDoc(book);
  const last = lines[lines.length - 1];
  const newLine = createNoteLine('', last?.indent || 0);
  lines.push(newLine);
  persistState();
  pendingFocusLineId = newLine.id;
  renderNotesDocument();
}

function removeNoteLine(lineId) {
  const lines = getNotesDoc();
  if (lines.length === 1) {
    lines[0].text = '';
    lines[0].indent = 0;
    persistState();
    renderNotesDocument();
    return;
  }
  const index = lines.findIndex((line) => line.id === lineId);
  if (index < 0) return;
  lines.splice(index, 1);
  persistState();
  const fallback = lines[Math.max(0, index - 1)]?.id || lines[0]?.id;
  pendingFocusLineId = fallback;
  renderNotesDocument();
}

function updateNoteLine(lineId, rawValue) {
  const lines = getNotesDoc();
  const line = lines.find((item) => item.id === lineId);
  if (!line) return;

  const leadingSpaces = rawValue.match(/^ +/)?.[0]?.length || 0;
  const computedIndent = Math.max(0, Math.min(MAX_INDENT, Math.floor(leadingSpaces / 2)));
  const trimmedText = rawValue.replace(/^ +/, '');
  const indentChanged = computedIndent !== (line.indent || 0);
  line.indent = computedIndent;
  line.text = trimmedText;
  persistState();

  if (indentChanged) {
    pendingFocusLineId = lineId;
    renderNotesDocument();
  }
}

function changeLineIndent(lineId, delta) {
  const line = getNotesDoc().find((item) => item.id === lineId);
  if (!line) return;
  line.indent = Math.max(0, Math.min(MAX_INDENT, (line.indent || 0) + delta));
  persistState();
  pendingFocusLineId = lineId;
  renderNotesDocument();
}

function moveLine(dragId, targetId) {
  const lines = getNotesDoc();
  const dragIndex = lines.findIndex((line) => line.id === dragId);
  const targetIndex = lines.findIndex((line) => line.id === targetId);
  if (dragIndex < 0 || targetIndex < 0 || dragIndex === targetIndex) return;
  const [moved] = lines.splice(dragIndex, 1);
  const insertIndex = dragIndex < targetIndex ? targetIndex - 1 : targetIndex;
  lines.splice(Math.max(0, insertIndex), 0, moved);
  persistState();
  pendingFocusLineId = dragId;
  renderNotesDocument();
}

function renderApp() {
  updateBookUI();
  renderLibrary();
  renderNotesDocument();
  updateProgressUI();
  setActiveTab(appState.ui.activeTab || 'player', false);
  setSidebarTab(appState.ui.sidebarTab || 'library', false);
  syncPlayButtons(!el.player.paused);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  el.toastRegion.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 2100);
  window.setTimeout(() => toast.remove(), 2600);
}

async function haptic(type) {
  try {
    if (Plugins.Haptics?.[type]) await Plugins.Haptics[type]();
  } catch {
    // no-op
  }
}

function openLibrarySetup(force = false) {
  el.librarySetupInput.value = appState.settings.libraryFolderName || 'Earlighter Library';
  if (!el.librarySetupDialog.open || force) {
    el.librarySetupDialog.showModal();
  }
}

function bindEvents() {
  el.openSidebarBtn.addEventListener('click', openSidebar);
  el.closeSidebarBtn.addEventListener('click', closeSidebar);
  el.sidebarBackdrop.addEventListener('click', closeSidebar);

  el.sidebarTabs.forEach((button) => {
    button.addEventListener('click', () => setSidebarTab(button.dataset.sidebarTab));
  });

  el.bottomTabs.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  el.coverButton.addEventListener('click', importBook);
  el.openSpeedBtn.addEventListener('click', () => el.speedDialog.showModal());

  el.speedSlider.addEventListener('input', () => setPlaybackSpeed(el.speedSlider.value));

  el.saveSettingsBtn.addEventListener('click', () => {
    const folderName = el.libraryFolderInput.value.trim();
    if (!folderName) {
      showToast('Enter a library folder name.');
      return;
    }
    appState.settings.libraryFolderName = folderName;
    appState.settings.transcriptionMode = el.transcriptionModeSelect.value;
    appState.settings.rememberSpeedPerBook = el.rememberSpeedCheckbox.checked;
    persistState();
    updateBookUI();
    showToast('Settings saved.');
  });

  el.librarySetupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const folderName = el.librarySetupInput.value.trim();
    if (!folderName) {
      showToast('Enter a library folder name.');
      return;
    }
    appState.settings.libraryFolderName = folderName;
    el.libraryFolderInput.value = folderName;
    persistState();
    el.librarySetupDialog.close();
    updateBookUI();
    showToast('Library folder created.');
  });

  async function togglePlayback() {
    if (!currentBook()) {
      showToast('Import an audiobook to start listening.');
      return;
    }
    if (el.player.paused) {
      await el.player.play().catch(() => showToast('Playback could not start.'));
    } else {
      el.player.pause();
    }
  }

  el.playPauseBtn.addEventListener('click', togglePlayback);
  el.notesPlayPauseBtn.addEventListener('click', togglePlayback);

  document.querySelectorAll('[data-skip]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!currentBook()) return;
      const delta = Number(button.dataset.skip || 0);
      const duration = Number.isFinite(el.player.duration) ? el.player.duration : (currentBook()?.durationMs || 0) / 1000;
      el.player.currentTime = Math.max(0, Math.min(duration || Infinity, (el.player.currentTime || 0) + delta));
      updateProgressUI();
      schedulePositionSave();
      await haptic('impactLight');
    });
  });

  const syncRangeChange = (range) => {
    range.addEventListener('input', () => {
      if (!currentBook()) return;
      const duration = el.player.duration || ((currentBook()?.durationMs || 0) / 1000);
      el.player.currentTime = (Number(range.value) / 1000) * duration;
      updateProgressUI();
    });
    range.addEventListener('change', schedulePositionSave);
  };
  syncRangeChange(el.progressRange);
  syncRangeChange(el.notesProgressRange);

  el.player.addEventListener('timeupdate', () => {
    updateProgressUI();
    schedulePositionSave();
  });
  el.player.addEventListener('play', () => syncPlayButtons(true));
  el.player.addEventListener('pause', () => {
    syncPlayButtons(false);
    savePlaybackPosition();
  });
  el.player.addEventListener('ended', () => {
    syncPlayButtons(false);
    savePlaybackPosition();
  });

  el.libraryGrid.addEventListener('click', async (event) => {
    const card = event.target.closest('[data-book-id]');
    if (!card) return;
    await loadBook(card.dataset.bookId);
    closeSidebar();
  });

  el.addNoteLineBtn.addEventListener('click', addNoteLine);

  el.notesDocument.addEventListener('input', (event) => {
    const textarea = event.target.closest('textarea[data-line-id]');
    if (!textarea) return;
    updateNoteLine(textarea.dataset.lineId, textarea.value);
    autoSizeTextarea(textarea);
  });

  el.notesDocument.addEventListener('keydown', (event) => {
    const textarea = event.target.closest('textarea[data-line-id]');
    if (!textarea) return;
    const lineId = textarea.dataset.lineId;

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      insertNoteAfter(lineId);
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      changeLineIndent(lineId, event.shiftKey ? -1 : 1);
      return;
    }

    if (event.key === 'Backspace' && textarea.value === '') {
      event.preventDefault();
      removeNoteLine(lineId);
    }
  });

  el.notesDocument.addEventListener('dragstart', (event) => {
    const row = event.target.closest('.note-line');
    if (!row) return;
    draggedLineId = row.dataset.lineId;
    event.dataTransfer.effectAllowed = 'move';
    row.classList.add('drag-target');
  });

  el.notesDocument.addEventListener('dragend', () => {
    draggedLineId = null;
    [...el.notesDocument.querySelectorAll('.note-line')].forEach((row) => row.classList.remove('drag-target'));
  });

  el.notesDocument.addEventListener('dragover', (event) => {
    event.preventDefault();
    const row = event.target.closest('.note-line');
    [...el.notesDocument.querySelectorAll('.note-line')].forEach((item) => item.classList.toggle('drag-target', item === row));
  });

  el.notesDocument.addEventListener('drop', (event) => {
    event.preventDefault();
    const row = event.target.closest('.note-line');
    [...el.notesDocument.querySelectorAll('.note-line')].forEach((item) => item.classList.remove('drag-target'));
    if (!draggedLineId || !row) return;
    moveLine(draggedLineId, row.dataset.lineId);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) savePlaybackPosition();
  });
  window.addEventListener('beforeunload', savePlaybackPosition);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function init() {
  bindEvents();
  renderApp();
  if (!appState.settings.libraryFolderName.trim()) {
    openLibrarySetup(true);
  }
  if (appState.lastBookId) {
    await loadBook(appState.lastBookId);
  }
  renderApp();
}

init();
