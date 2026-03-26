const STORAGE_KEY = 'earlighter-state-v3';
const DB_NAME = 'earlighter-db';
const DB_VERSION = 2;
const STORE_BLOBS = 'book-blobs';
const STORE_MODEL_FILES = 'model-files';
const SAVE_THROTTLE_MS = 1200;
const MAX_INDENT = 8;
const SWIPE_THRESHOLD = 42;
const INDENT_STEP_PX = 24;
const HIGHLIGHT_MIN_WORDS = 4;

const MODEL_CATALOG = {
  whisper: [
    { id: 'whisper-tiny-en', tier: 'Fastest', title: 'tiny.en', note: 'Fastest transcription', recommended: false, mode: 'tiny', sizeLabel: '~75 MB', filename: 'ggml-tiny.en.bin', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin' },
    { id: 'whisper-base-en', tier: 'Balanced', title: 'base.en', note: 'Balanced transcription', recommended: true, mode: 'base', sizeLabel: '~142 MB', filename: 'ggml-base.en.bin', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin' },
    { id: 'whisper-small-en', tier: 'Highest Quality', title: 'small.en', note: 'Highest quality of the three', recommended: false, mode: 'small', sizeLabel: '~466 MB', filename: 'ggml-small.en.bin', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin' }
  ],
  llm: [
    { id: 'llm-tinyllama', tier: 'Fastest', title: 'TinyLlama 1.1B', note: 'Fastest notes cleanup', recommended: true, sizeLabel: '~669 MB', filename: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf', url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf' },
    { id: 'llm-qwen-0_5b', tier: 'Balanced', title: 'Qwen2.5 0.5B', note: 'Balanced notes cleanup', recommended: false, sizeLabel: '~491 MB', filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf', url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf' },
    { id: 'llm-qwen-1_5b', tier: 'Highest Quality', title: 'Qwen2.5 1.5B', note: 'Highest quality of the three', recommended: false, sizeLabel: '~1.12 GB', filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf', url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf' }
  ]
};

const $ = (selector) => document.querySelector(selector);

const el = {
  appRoot: $('#appRoot'),
  sidebar: $('#sidebar'),
  sidebarBackdrop: $('#sidebarBackdrop'),
  openSidebarBtn: $('#openSidebarBtn'),
  sidebarTabs: [...document.querySelectorAll('.sidebar-tab')],
  libraryPanel: $('#libraryPanel'),
  modelsPanel: $('#modelsPanel'),
  settingsPanel: $('#settingsPanel'),
  libraryGrid: $('#libraryGrid'),
  libraryFolderLabel: $('#libraryFolderLabel'),
  modelFolderLabel: $('#modelFolderLabel'),
  whisperModelsList: $('#whisperModelsList'),
  llmModelsList: $('#llmModelsList'),
  changeLibraryFolderBtn: $('#changeLibraryFolderBtn'),
  transcriptionModeSelect: $('#transcriptionModeSelect'),
  rememberSpeedCheckbox: $('#rememberSpeedCheckbox'),
  highlightModeSelect: $('#highlightModeSelect'),

  screen: $('.screen'),
  viewsViewport: $('#viewsViewport'),
  viewsTrack: $('#viewsTrack'),
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

  notesStickyShell: $('#notesStickyShell'),
  miniCollapseBtn: $('#miniCollapseBtn'),
  notesDocument: $('#notesDocument'),
  clipButtons: [...document.querySelectorAll('[data-clip]')],

  librarySetupDialog: $('#librarySetupDialog'),
  librarySetupForm: $('#librarySetupForm'),
  librarySetupInput: $('#librarySetupInput'),
  libraryDialogTitle: $('#libraryDialogTitle'),
  libraryDialogSubtitle: $('#libraryDialogSubtitle'),
  libraryDialogWarning: $('#libraryDialogWarning'),
  cancelLibraryDialogBtn: $('#cancelLibraryDialogBtn'),
  completeSetupBtn: $('#completeSetupBtn'),

  toastRegion: $('#toastRegion'),
  fallbackFileInput: $('#fallbackFileInput'),
  modelFileInput: $('#modelFileInput')
};

const CapacitorRef = window.Capacitor;
const Plugins = CapacitorRef?.Plugins ?? {};

let dbPromise;
let currentBookBlob = null;
let currentBookUrl = null;
let saveTimer = null;
let draggedLineId = null;
let pendingFocusLineId = null;
let pendingFocusCaret = null;
let libraryDialogMode = 'setup';
let swipeStartX = null;
let swipeStartY = null;
let dragPreview = { targetId: null, indent: 0, placement: 'before' };
let noteDragActive = false;
let highlightProcessingActive = false;
let swipeMode = null;
let swipeSidebarCandidate = false;
let pageSwipeOffset = 0;
let sidebarSwipeStartX = null;
let sidebarSwipeStartY = null;
let sidebarSwipeDragging = false;
let modelDownloadState = {};
let currentModelPickKind = null;

const appState = loadState();

function createDefaultState() {
  return {
    books: [],
    lastBookId: null,
    settings: {
      transcriptionMode: 'base',
      rememberSpeedPerBook: true,
      libraryFolderName: '',
      highlightMode: 'verbatim',
      models: defaultModelsState()
    },
    ui: {
      activeTab: 'player',
      sidebarTab: 'library',
      notesMiniCollapsed: false
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
        ...(parsed.settings || {}),
        models: normalizeModelsState(parsed.settings?.models || parsed.models)
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


function defaultModelsState() {
  return {
    whisper: {
      activeId: 'whisper-base-en',
      installed: {}
    },
    llm: {
      activeId: 'llm-tinyllama',
      installed: {}
    }
  };
}

function normalizeModelsState(models = {}) {
  const defaults = defaultModelsState();
  return {
    whisper: {
      ...defaults.whisper,
      ...(models.whisper || {}),
      installed: { ...(models.whisper?.installed || {}) }
    },
    llm: {
      ...defaults.llm,
      ...(models.llm || {}),
      installed: { ...(models.llm?.installed || {}) }
    }
  };
}

function catalogForKind(kind) {
  return MODEL_CATALOG[kind] || [];
}

function definitionForModel(kind, id) {
  return catalogForKind(kind).find((item) => item.id === id) || null;
}

function getModelState(kind) {
  if (!appState.settings.models) appState.settings.models = defaultModelsState();
  if (!appState.settings.models[kind]) appState.settings.models[kind] = defaultModelsState()[kind];
  if (!appState.settings.models[kind].installed) appState.settings.models[kind].installed = {};
  return appState.settings.models[kind];
}

function sanitizeFolderName(name) {
  return String(name || 'Earlighter Library').trim().replace(/[\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Earlighter Library';
}

function modelsRelativeDir() {
  return `${sanitizeFolderName(appState.settings.libraryFolderName || 'Earlighter Library')}/models`;
}

function activeModelFor(kind) {
  const state = getModelState(kind);
  return state.installed?.[state.activeId] || definitionForModel(kind, state.activeId) || null;
}

function whisperModeFromModelId(id) {
  if (id.includes('tiny')) return 'tiny';
  if (id.includes('small')) return 'small';
  return 'base';
}

function humanBytes(bytes = 0) {
  const value = Number(bytes) || 0;
  if (!value) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function migrateBook(book) {
  const migrated = {
    ...book,
    notesDoc: Array.isArray(book.notesDoc) ? book.notesDoc.map(normalizeNoteLine) : flattenOutline(book.outline || []).map(normalizeNoteLine),
    speed: Number.isFinite(book.speed) ? book.speed : 1,
    coverLabel: book.coverLabel || initials(book.title || 'Earlighter'),
    clips: Array.isArray(book.clips) ? book.clips : []
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

function createNoteLine(text = '', indent = 0, extras = {}) {
  return normalizeNoteLine({
    id: uid('line'),
    text,
    indent: Math.max(0, Math.min(MAX_INDENT, indent)),
    ...extras
  });
}

function normalizeNoteLine(line = {}) {
  return {
    id: line.id || uid('line'),
    text: line.text || '',
    indent: Math.max(0, Math.min(MAX_INDENT, Number(line.indent) || 0)),
    kind: line.kind || 'text',
    jobStatus: line.jobStatus || null,
    clipSeconds: Number(line.clipSeconds) || 0,
    startMs: Number(line.startMs) || 0,
    endMs: Number(line.endMs) || 0,
    createdAt: Number(line.createdAt) || Date.now(),
    modelMode: line.modelMode || null
  };
}


function isHighlightJobLine(line) {
  return line?.kind === 'highlight-job';
}

function isPendingHighlightLine(line) {
  return isHighlightJobLine(line) && (line.jobStatus === 'queued' || line.jobStatus === 'processing');
}

function resetStaleProcessingJobs() {
  for (const book of appState.books) {
    if (!Array.isArray(book.notesDoc)) continue;
    for (const line of book.notesDoc) {
      if (line?.kind === 'highlight-job' && line.jobStatus === 'processing') {
        line.jobStatus = 'queued';
        line.text = 'Waiting to Process…';
      }
    }
  }
}

function getNotesDoc(book = currentBook()) {
  if (!book) return [];
  if (!Array.isArray(book.notesDoc)) book.notesDoc = [createNoteLine('')];
  if (!book.notesDoc.length) book.notesDoc = [createNoteLine('')];
  return book.notesDoc;
}

function maxIndentForIndex(lines, index) {
  if (index <= 0) return 0;
  return Math.min(MAX_INDENT, ((lines[index - 1]?.indent) || 0) + 1);
}

function clampIndentForIndex(lines, index, desiredIndent) {
  return Math.max(0, Math.min(maxIndentForIndex(lines, index), desiredIndent));
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
        if (!db.objectStoreNames.contains(STORE_MODEL_FILES)) {
          db.createObjectStore(STORE_MODEL_FILES, { keyPath: 'id' });
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


async function putModelBlob(id, blob) {
  const db = await getDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MODEL_FILES, 'readwrite');
    tx.objectStore(STORE_MODEL_FILES).put({ id, blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function blobToBase64(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || '').split(',').pop() || '');
    reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
    reader.readAsDataURL(blob);
  });
}

async function ensureModelsFolder() {
  if (!Plugins.Filesystem?.mkdir) return;
  await Plugins.Filesystem.mkdir({
    directory: 'DATA',
    path: modelsRelativeDir(),
    recursive: true
  }).catch(() => {});
}

async function writeBlobIntoModelsFolder(filename, blob, id) {
  await ensureModelsFolder();
  const cleanName = String(filename || `${id}.bin`).replace(/[^a-zA-Z0-9._-]+/g, '-');
  const relativePath = `${modelsRelativeDir()}/${cleanName}`;
  if (Plugins.Filesystem?.writeFile) {
    const data = await blobToBase64(blob);
    await Plugins.Filesystem.writeFile({
      directory: 'DATA',
      path: relativePath,
      data,
      recursive: true
    });
    let uri = null;
    if (Plugins.Filesystem?.getUri) {
      const info = await Plugins.Filesystem.getUri({ directory: 'DATA', path: relativePath }).catch(() => null);
      uri = info?.uri || null;
    }
    return { relativePath, uri, sizeBytes: blob.size || 0 };
  }
  await putModelBlob(id, blob);
  return { relativePath: `indexeddb://${id}`, uri: null, sizeBytes: blob.size || 0 };
}

async function readPickedModelAsBlob(kind) {
  const accept = kind === 'whisper' ? '.bin,.en,.ggml' : '.gguf';
  if (Plugins.FilePicker) {
    try {
      if (Plugins.FilePicker.requestPermissions) {
        await Plugins.FilePicker.requestPermissions({ permissions: ['readExternalStorage'] }).catch(() => {});
      }
      const result = await Plugins.FilePicker.pickFiles({ limit: 1 });
      const file = result.files?.[0];
      if (!file) return null;
      if (file.path && CapacitorRef?.convertFileSrc) {
        const response = await fetch(CapacitorRef.convertFileSrc(file.path));
        const blob = await response.blob();
        return { blob, name: file.name || `${kind}-model`, size: file.size || blob.size };
      }
      if (file.data) {
        const binary = atob(file.data);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) array[i] = binary.charCodeAt(i);
        const blob = new Blob([array], { type: file.mimeType || 'application/octet-stream' });
        return { blob, name: file.name || `${kind}-model`, size: file.size || blob.size };
      }
    } catch (error) {
      console.warn('Model picker failed, using browser fallback.', error);
    }
  }
  return await new Promise((resolve) => {
    el.modelFileInput.accept = accept;
    el.modelFileInput.value = '';
    el.modelFileInput.onchange = () => {
      const file = el.modelFileInput.files?.[0];
      if (!file) return resolve(null);
      resolve({ blob: file, name: file.name, size: file.size || 0 });
    };
    el.modelFileInput.click();
  });
}

function saveInstalledModel(kind, meta) {
  const state = getModelState(kind);
  state.installed[meta.id] = meta;
  state.activeId = meta.id;
  if (kind === 'whisper') {
    appState.settings.transcriptionMode = meta.mode || whisperModeFromModelId(meta.id);
  }
  persistState();
  renderModels();
}

async function installManualModel(kind) {
  if (!appState.settings.libraryFolderName.trim()) {
    openLibrarySetup(true);
    return;
  }
  const picked = await readPickedModelAsBlob(kind);
  if (!picked) return;
  const id = `${kind}-custom-${Date.now()}`;
  const stored = await writeBlobIntoModelsFolder(picked.name, picked.blob, id);
  saveInstalledModel(kind, {
    id,
    title: picked.name,
    note: 'Selected from a file',
    filename: picked.name,
    source: 'manual',
    storedPath: stored.relativePath,
    storedUri: stored.uri,
    sizeBytes: picked.size || stored.sizeBytes || 0,
    sizeLabel: humanBytes(picked.size || stored.sizeBytes || 0),
    mode: kind === 'whisper' ? appState.settings.transcriptionMode : null,
    downloadedAt: Date.now()
  });
  showToast(`${kind === 'whisper' ? 'Whisper' : 'Notes AI'} file linked.`);
}

async function downloadModel(kind, modelId) {
  const definition = definitionForModel(kind, modelId);
  if (!definition) return;
  if (!appState.settings.libraryFolderName.trim()) {
    openLibrarySetup(true);
    return;
  }
  const state = getModelState(kind);
  if (state.installed?.[modelId]) {
    state.activeId = modelId;
    if (kind === 'whisper') appState.settings.transcriptionMode = definition.mode || whisperModeFromModelId(modelId);
    persistState();
    renderModels();
    showToast(`${definition.title} is active.`);
    return;
  }

  modelDownloadState[modelId] = { status: 'downloading', progress: 0 };
  renderModels();
  try {
    await ensureModelsFolder();
    let stored;
    if (Plugins.FileTransfer?.downloadFile && Plugins.Filesystem?.getUri) {
      const relativePath = `${modelsRelativeDir()}/${definition.filename}`;
      const info = await Plugins.Filesystem.getUri({ directory: 'DATA', path: relativePath });
      let progressHandle = null;
      if (Plugins.FileTransfer.addListener) {
        progressHandle = await Plugins.FileTransfer.addListener('progress', (progress) => {
          const total = Number(progress.contentLength) || 0;
          const pct = total > 0 ? Math.round((Number(progress.bytes || 0) / total) * 100) : 0;
          modelDownloadState[modelId] = { status: 'downloading', progress: Math.max(4, Math.min(100, pct)) };
          renderModels();
        }).catch(() => null);
      }
      await Plugins.FileTransfer.downloadFile({ url: definition.url, path: info.uri, progress: true });
      if (progressHandle?.remove) await progressHandle.remove().catch(() => {});
      let stat = null;
      if (Plugins.Filesystem?.stat) stat = await Plugins.Filesystem.stat({ directory: 'DATA', path: relativePath }).catch(() => null);
      stored = { relativePath, uri: info.uri, sizeBytes: Number(stat?.size) || 0 };
    } else {
      const response = await fetch(definition.url);
      if (!response.ok) throw new Error(`Download failed (${response.status}).`);
      const blob = await response.blob();
      stored = await writeBlobIntoModelsFolder(definition.filename, blob, definition.id);
    }
    saveInstalledModel(kind, {
      ...definition,
      source: 'download',
      storedPath: stored.relativePath,
      storedUri: stored.uri,
      sizeBytes: stored.sizeBytes || 0,
      downloadedAt: Date.now()
    });
    modelDownloadState[modelId] = { status: 'done', progress: 100 };
    renderModels();
    showToast(`${definition.title} downloaded.`);
  } catch (error) {
    console.error(error);
    modelDownloadState[modelId] = { status: 'error', progress: 0 };
    renderModels();
    showToast(error?.message || 'Model download failed.');
  }
}

function renderModelList(kind, container) {
  if (!container) return;
  const state = getModelState(kind);
  const cards = catalogForKind(kind).map((definition) => {
    const installed = state.installed?.[definition.id];
    const downloadState = modelDownloadState[definition.id] || null;
    const isActive = state.activeId === definition.id;
    const status = installed ? (isActive ? 'Active' : 'Downloaded') : (downloadState?.status === 'downloading' ? 'Downloading…' : 'Not downloaded');
    const actionLabel = installed ? (isActive ? 'Active' : 'Use') : (downloadState?.status === 'downloading' ? 'Downloading…' : 'Download');
    return `
      <article class="model-card ${installed ? 'installed' : ''} ${isActive ? 'active' : ''}">
        <div class="model-card-copy">
          <div class="model-card-eyebrow">${escapeHtml(definition.tier)}${definition.recommended ? ' <span class="model-rec">(recommended)</span>' : ''}</div>
          <div class="model-card-title">${escapeHtml(definition.title)}</div>
          <div class="model-card-note">${escapeHtml(definition.note)}</div>
          <div class="model-card-meta">${escapeHtml(installed?.sizeLabel || definition.sizeLabel || '')}${status ? ` • ${escapeHtml(status)}` : ''}</div>
          ${downloadState?.status === 'downloading' ? `<div class="model-progress"><span style="width:${downloadState.progress || 6}%"></span></div>` : ''}
        </div>
        <div class="model-card-actions">
          <button class="model-action ${installed && isActive ? 'is-active' : ''}" type="button" data-model-action="${installed ? 'activate' : 'download'}" data-model-kind="${kind}" data-model-id="${definition.id}" ${downloadState?.status === 'downloading' ? 'disabled' : ''}>${actionLabel}</button>
        </div>
      </article>`;
  }).join('');

  const customItems = Object.values(state.installed || {}).filter((item) => String(item.id || '').startsWith(`${kind}-custom-`));
  const custom = customItems.length ? customItems.map((item) => `
      <article class="model-card active custom-model-card ${state.activeId === item.id ? 'active' : ''}">
        <div class="model-card-copy">
          <div class="model-card-eyebrow">Select a File</div>
          <div class="model-card-title">${escapeHtml(item.title || item.filename || 'Custom file')}</div>
          <div class="model-card-note">Saved inside ${escapeHtml(modelsRelativeDir())}</div>
          <div class="model-card-meta">${escapeHtml(item.sizeLabel || humanBytes(item.sizeBytes || 0) || '')}${state.activeId === item.id ? ' • Active' : ' • Custom'}</div>
        </div>
        <div class="model-card-actions">
          <button class="model-action ${state.activeId === item.id ? 'is-active' : ''}" type="button" data-model-action="activate" data-model-kind="${kind}" data-model-id="${item.id}">${state.activeId === item.id ? 'Active' : 'Use'}</button>
        </div>
      </article>`).join('') : '';

  container.innerHTML = cards + custom;
}

function renderModels() {
  if (el.modelFolderLabel) {
    el.modelFolderLabel.textContent = `${sanitizeFolderName(appState.settings.libraryFolderName || 'Earlighter Library')}/models`;
  }
  renderModelList('whisper', el.whisperModelsList);
  renderModelList('llm', el.llmModelsList);
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
      notesDoc: [createNoteLine('')],
      clips: []
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
  if (el.speedDialog?.open) return;
  el.sidebar.style.transform = '';
  el.appRoot.classList.add('sidebar-open');
}

function closeSidebar() {
  el.sidebar.style.transform = '';
  el.appRoot.classList.remove('sidebar-open');
}

function setSidebarTab(tab, persist = true) {
  appState.ui.sidebarTab = tab;
  if (persist) persistState();
  el.sidebarTabs.forEach((button) => button.classList.toggle('active', button.dataset.sidebarTab === tab));
  el.libraryPanel.classList.toggle('active', tab === 'library');
  el.modelsPanel?.classList.toggle('active', tab === 'models');
  el.settingsPanel.classList.toggle('active', tab === 'settings');
}

function applyViewTransform(immediate = false, dragOffsetPx = 0) {
  const width = el.viewsViewport?.clientWidth || el.screen?.clientWidth || window.innerWidth || 1;
  const base = appState.ui.activeTab === 'notes' ? -width : 0;
  const next = Math.max(-width, Math.min(0, base + dragOffsetPx));
  if (!el.viewsTrack) return;
  el.viewsTrack.classList.toggle('dragging', immediate || swipeMode === 'page');
  el.viewsTrack.style.transform = `translate3d(${next}px, 0, 0)`;
  if (immediate) requestAnimationFrame(() => el.viewsTrack.classList.remove('dragging'));
}

function setActiveTab(tab, persist = true, immediate = false) {
  appState.ui.activeTab = tab;
  if (persist) persistState();
  el.bottomTabs.forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  el.playerView.classList.toggle('active', tab === 'player');
  el.notesView.classList.toggle('active', tab === 'notes');
  el.miniCollapseBtn?.classList.toggle('hidden', tab !== 'notes');
  applyViewTransform(immediate, 0);
}

function applyNotesMiniState(persist = true) {
  const collapsed = !!appState.ui.notesMiniCollapsed;
  el.notesView.classList.toggle('mini-collapsed', collapsed);
  if (el.miniCollapseBtn) {
    el.miniCollapseBtn.setAttribute('aria-label', collapsed ? 'Expand mini player' : 'Collapse mini player');
    el.miniCollapseBtn.setAttribute('aria-expanded', String(!collapsed));
    el.miniCollapseBtn.classList.toggle('collapsed', collapsed);
  }
  if (persist) persistState();
}

function updateSpeedReadout(speed) {
  el.speedReadout.textContent = `${Number(speed).toFixed(2).replace(/\.00$/, '.0').replace(/(\.\d)0$/, '$1')}×`;
}

function updateBookUI() {
  const book = currentBook();
  el.bookTitle.textContent = book?.title || 'No audiobook selected';
  el.notesBookTitle.textContent = book?.title || 'No audiobook selected';
  el.coverArt.textContent = book?.coverLabel || 'EA';
  el.coverHint.textContent = '';
  el.libraryFolderLabel.textContent = appState.settings.libraryFolderName.trim() || 'No library folder set yet';
  if (el.modelFolderLabel) el.modelFolderLabel.textContent = `${sanitizeFolderName(appState.settings.libraryFolderName || 'Earlighter Library')}/models`;
  if (el.transcriptionModeSelect) el.transcriptionModeSelect.value = appState.settings.transcriptionMode;
  el.rememberSpeedCheckbox.checked = !!appState.settings.rememberSpeedPerBook;
  if (el.highlightModeSelect) el.highlightModeSelect.value = appState.settings.highlightMode || 'verbatim';
  const speed = book?.speed || 1;
  el.speedSlider.value = String(speed);
  updateSpeedReadout(speed);
}

function renderLibrary() {
  const books = [...appState.books].sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
  const cards = [
    `<button class="library-import-card" type="button" data-import-card="1">
      <div class="library-cover">＋</div>
      <div class="library-title">Import MP3</div>
    </button>`
  ];

  cards.push(...books.map((book) => `
    <button class="library-card ${book.id === appState.lastBookId ? 'active' : ''}" type="button" data-book-id="${book.id}">
      <div class="library-cover">${escapeHtml(book.coverLabel || initials(book.title))}</div>
      <div class="library-title">${escapeHtml(book.title)}</div>
    </button>
  `));

  el.libraryGrid.innerHTML = cards.join('');
}

function renderNotesDocument() {
  const book = currentBook();
  if (!book) {
    el.notesDocument.innerHTML = `<div class="note-empty">Import an audiobook to start a note document for it.</div>`;
    return;
  }

  const lines = getNotesDoc(book);
  el.notesDocument.innerHTML = '';

  lines.forEach((line, index) => {
    const row = document.createElement('div');
    row.className = 'note-line';
    if (line.jobStatus === 'processing') row.classList.add('processing-line');
    if (line.jobStatus === 'queued') row.classList.add('queued-line');
    row.dataset.lineId = line.id;
    row.dataset.indent = String(line.indent || 0);
    row.style.setProperty('--indent', String(line.indent || 0));

    const handle = document.createElement('button');
    handle.className = 'drag-handle';
    handle.type = 'button';
    handle.draggable = true;
    handle.setAttribute('aria-label', 'Drag line');
    handle.textContent = '⋮⋮';

    const bullet = document.createElement('button');
    bullet.className = 'note-bullet';
    bullet.type = 'button';
    bullet.draggable = true;
    bullet.setAttribute('aria-label', line.jobStatus === 'processing' ? 'Processing highlight' : line.jobStatus === 'queued' ? 'Queued highlight' : 'Drag line');

    const editor = document.createElement('textarea');
    editor.className = 'note-editor';
    if (isPendingHighlightLine(line)) editor.classList.add('note-editor-pending');
    editor.dataset.lineId = line.id;
    editor.rows = 1;
    editor.placeholder = index === 0 && !line.text ? 'Start writing…' : '';
    editor.value = line.text || '';
    editor.inputMode = 'text';
    editor.enterKeyHint = 'enter';
    editor.autocorrect = 'on';
    editor.autocapitalize = 'sentences';
    editor.spellcheck = !isPendingHighlightLine(line);
    editor.autocomplete = 'off';
    editor.readOnly = isPendingHighlightLine(line);

    row.append(handle, bullet, editor);
    el.notesDocument.appendChild(row);
    autoSizeTextarea(editor);
  });

  if (pendingFocusLineId) {
    focusLine(pendingFocusLineId, pendingFocusCaret);
    pendingFocusLineId = null;
    pendingFocusCaret = null;
  }
}

function autoSizeTextarea(textarea) {
  textarea.style.height = '0px';
  textarea.style.height = `${Math.max(28, textarea.scrollHeight)}px`;
}

function focusLine(lineId, caret = null) {
  const textarea = el.notesDocument.querySelector(`textarea[data-line-id="${lineId}"]`);
  if (!textarea) return;
  textarea.focus();
  const length = textarea.value.length;
  const position = caret == null ? length : Math.max(0, Math.min(length, caret));
  textarea.setSelectionRange(position, position);
}

function paintRangeProgress(range, ratio) {
  const pct = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
  range.style.background = `linear-gradient(90deg, var(--progress-fill) 0%, var(--progress-fill-strong) ${pct}, rgba(143, 166, 255, 0.18) ${pct}, rgba(143, 166, 255, 0.18) 100%)`;
}

function updateProgressUI() {
  const duration = Number.isFinite(el.player.duration) ? el.player.duration : (currentBook()?.durationMs || 0) / 1000;
  const current = Number.isFinite(el.player.currentTime) ? el.player.currentTime : (currentBook()?.lastPositionMs || 0) / 1000;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
  const rangeValue = Math.round(ratio * 1000);
  el.progressRange.value = rangeValue;
  el.notesProgressRange.value = rangeValue;
  paintRangeProgress(el.progressRange, ratio);
  paintRangeProgress(el.notesProgressRange, ratio);
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


function addPendingHighlightLine(book, seconds, startMs, endMs) {
  const lines = getNotesDoc(book);
  const line = createNoteLine('Waiting to Process…', 0, {
    kind: 'highlight-job',
    jobStatus: 'queued',
    clipSeconds: seconds,
    startMs,
    endMs,
    createdAt: Date.now(),
    modelMode: appState.settings.highlightMode || 'verbatim'
  });
  lines.unshift(line);
  persistState();
  renderNotesDocument();
  return line;
}

function collectPendingHighlightJobs() {
  const jobs = [];
  for (const book of appState.books) {
    const lines = getNotesDoc(book);
    lines.forEach((line, index) => {
      if (isPendingHighlightLine(line)) jobs.push({ book, lines, line, index });
    });
  }
  return jobs.sort((a, b) => (a.line.createdAt || 0) - (b.line.createdAt || 0));
}

function findProcessingJob() {
  for (const book of appState.books) {
    const lines = getNotesDoc(book);
    const index = lines.findIndex((line) => line?.jobStatus === 'processing');
    if (index >= 0) return { book, lines, line: lines[index], index };
  }
  return null;
}

function extractLikelySentences(rawText) {
  const normalized = String(rawText || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
  if (!normalized) return [];
  const parts = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
  const cleaned = [];
  for (let part of parts) {
    let sentence = part.trim();
    if (!sentence) continue;
    const startsWell = /^["'([A-Z0-9]/.test(sentence);
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    const endsWell = /[.!?]$/.test(sentence);
    if (!startsWell) continue;
    if (!endsWell) {
      if (wordCount >= HIGHLIGHT_MIN_WORDS + 1) sentence += '.';
      else continue;
    }
    if (wordCount < HIGHLIGHT_MIN_WORDS) continue;
    cleaned.push(sentence);
  }
  return cleaned;
}

function summarizeSentences(sentences) {
  if (!sentences.length) return '';
  const merged = sentences.slice(0, 3).join(' ');
  if (merged.length <= 220) return merged;
  return `${merged.slice(0, 217).trimEnd()}…`;
}

function buildHighlightLinesFromText(rawText, mode = 'verbatim') {
  const sentences = extractLikelySentences(rawText);
  if (!sentences.length) return [];
  if (mode === 'summary') return [summarizeSentences(sentences)];
  return sentences;
}

async function runOfflineHighlightProcessor(job) {
  const bridge = window.EarlighterOffline || Plugins.EarlighterOffline;
  const activeWhisper = activeModelFor('whisper');
  const activeLlm = activeModelFor('llm');
  if (!activeWhisper?.storedPath || !activeLlm?.storedPath) {
    throw new Error('Choose and install a Whisper model and a Notes AI model in Models first.');
  }
  if (!bridge?.processHighlight) {
    throw new Error('Offline highlight runtime is not installed in this build.');
  }
  return await bridge.processHighlight({
    bookId: job.book.id,
    sourceName: job.book.sourceName || job.book.title,
    startMs: job.line.startMs,
    endMs: job.line.endMs,
    clipSeconds: job.line.clipSeconds,
    transcriptionMode: appState.settings.transcriptionMode,
    highlightMode: job.line.modelMode || appState.settings.highlightMode || 'verbatim',
    whisperModelPath: activeWhisper.storedPath,
    whisperModelUri: activeWhisper.storedUri || null,
    llmModelPath: activeLlm.storedPath,
    llmModelUri: activeLlm.storedUri || null,
    whisperModelId: activeWhisper.id,
    llmModelId: activeLlm.id
  });
}

function replacePendingLineWithNotes(job, noteTexts) {
  const { lines, index, line } = job;
  if (!noteTexts.length) {
    lines.splice(index, 1);
    persistState();
    renderNotesDocument();
    showToast('Nothing usable was found in that highlight.');
    return;
  }
  const indent = line.indent || 0;
  const newLines = noteTexts.map((text) => createNoteLine(text, indent));
  lines.splice(index, 1, ...newLines);
  persistState();
  renderNotesDocument();
}

async function processHighlightQueue() {
  if (highlightProcessingActive) return;
  const existing = findProcessingJob();
  if (existing) {
    highlightProcessingActive = true;
  }
  const nextJob = existing || collectPendingHighlightJobs()[0];
  if (!nextJob) {
    highlightProcessingActive = false;
    return;
  }
  const { line } = nextJob;
  line.jobStatus = 'processing';
  line.text = 'Processing Highlight…';
  persistState();
  renderNotesDocument();
  highlightProcessingActive = true;

  try {
    const result = await runOfflineHighlightProcessor(nextJob);
    const noteTexts = Array.isArray(result?.items) && result.items.length
      ? result.items.map((item) => String(item || '').trim()).filter(Boolean)
      : buildHighlightLinesFromText(result?.summary || result?.text || result?.transcript || '', nextJob.line.modelMode || appState.settings.highlightMode || 'verbatim');
    replacePendingLineWithNotes(nextJob, noteTexts);
  } catch (error) {
    console.error(error);
    line.jobStatus = null;
    line.kind = 'text';
    line.text = 'Highlight processing unavailable in this build.';
    persistState();
    renderNotesDocument();
    showToast(error?.message || 'Highlight processing failed.');
  } finally {
    highlightProcessingActive = false;
    window.setTimeout(() => processHighlightQueue(), 30);
  }
}

function insertNoteAfter(lineId, text = '', caret = null) {
  const lines = getNotesDoc();
  const index = lines.findIndex((line) => line.id === lineId);
  if (index < 0) return;
  const indent = lines[index].indent || 0;
  const newLine = createNoteLine(text, indent);
  lines.splice(index + 1, 0, newLine);
  persistState();
  pendingFocusLineId = newLine.id;
  pendingFocusCaret = caret;
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
  const index = lines.findIndex((item) => item.id === lineId);
  const line = lines[index];
  if (!line) return;

  const currentIndent = line.indent || 0;
  let nextIndent = currentIndent;
  let nextText = rawValue;
  let shouldRerender = false;

  const leadingSpaces = rawValue.match(/^ +/)?.[0]?.length || 0;
  const trimmedText = rawValue.replace(/^ +/, '');

  // Preserve indentation while typing. Only interpret leading spaces as an
  // indent shortcut when the user is clearly adding them at the start.
  if (leadingSpaces >= 2) {
    const previousText = line.text || '';
    const shortcutTriggered =
      previousText === '' ||
      rawValue.trimStart() === previousText ||
      previousText.startsWith(trimmedText);

    if (shortcutTriggered) {
      nextIndent = clampIndentForIndex(lines, index, Math.floor(leadingSpaces / 2));
      nextText = trimmedText;
      shouldRerender = nextIndent !== currentIndent;
    }
  }

  line.indent = nextIndent;
  line.text = nextText;
  persistState();

  if (shouldRerender) {
    pendingFocusLineId = lineId;
    pendingFocusCaret = 0;
    renderNotesDocument();
  }
}

function changeLineIndent(lineId, delta) {
  const lines = getNotesDoc();
  const index = lines.findIndex((item) => item.id === lineId);
  const line = lines[index];
  if (!line) return;
  line.indent = clampIndentForIndex(lines, index, (line.indent || 0) + delta);
  persistState();
  pendingFocusLineId = lineId;
  renderNotesDocument();
}

function endOfSubtreeIndex(lines, index) {
  const baseIndent = lines[index]?.indent || 0;
  let end = index + 1;
  while (end < lines.length && (lines[end]?.indent || 0) > baseIndent) end += 1;
  return end;
}

function moveLine(dragId, targetId, nextIndent = null, placement = 'before') {
  const lines = getNotesDoc();
  const dragIndex = lines.findIndex((line) => line.id === dragId);
  const targetIndex = lines.findIndex((line) => line.id === targetId);
  if (dragIndex < 0 || targetIndex < 0) return;

  const [moved] = lines.splice(dragIndex, 1);
  let insertionIndex;

  if (placement === 'after') {
    const adjustedTargetIndex = lines.findIndex((line) => line.id === targetId);
    insertionIndex = adjustedTargetIndex >= 0 ? endOfSubtreeIndex(lines, adjustedTargetIndex) : lines.length;
  } else {
    const adjustedTargetIndex = lines.findIndex((line) => line.id === targetId);
    insertionIndex = adjustedTargetIndex >= 0 ? adjustedTargetIndex : lines.length;
  }

  const finalIndex = Math.max(0, Math.min(lines.length, insertionIndex));
  lines.splice(finalIndex, 0, moved);
  const desiredIndent = nextIndent != null ? nextIndent : moved.indent || 0;
  moved.indent = clampIndentForIndex(lines, finalIndex, desiredIndent);
  persistState();
  pendingFocusLineId = dragId;
  renderNotesDocument();
}

function clipLabel(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

function saveClip(seconds) {
  const book = currentBook();
  if (!book) {
    showToast('Import an audiobook first.');
    return;
  }
  const endMs = Math.round((el.player.currentTime || 0) * 1000);
  const durationMs = seconds * 1000;
  const startMs = Math.max(0, endMs - durationMs);
  if (!Array.isArray(book.clips)) book.clips = [];
  book.clips.unshift({
    id: uid('clip'),
    createdAt: Date.now(),
    startMs,
    endMs,
    durationMs,
    sourcePlaybackSpeedAtCapture: book.speed || 1
  });
  addPendingHighlightLine(book, seconds, startMs, endMs);
  persistState();
  haptic('impactLight');
  showToast(`Queued ${clipLabel(seconds)} highlight.`);
  processHighlightQueue();
}

function renderApp() {
  updateBookUI();
  renderLibrary();
  renderModels();
  renderNotesDocument();
  updateProgressUI();
  setActiveTab(appState.ui.activeTab || 'player', false, true);
  setSidebarTab(appState.ui.sidebarTab || 'library', false);
  applyNotesMiniState(false);
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

function openLibrarySetup(force = false, mode = 'setup') {
  libraryDialogMode = mode;
  el.librarySetupInput.value = appState.settings.libraryFolderName || 'Earlighter Library';
  if (mode === 'rename') {
    el.libraryDialogTitle.textContent = 'Change library folder';
    el.libraryDialogSubtitle.textContent = 'Choose a new library folder name.';
    el.libraryDialogWarning.textContent = 'Are you sure? New model downloads will be saved into <folder>/models using this new name. Existing downloads already inside the app stay where they are unless you move them manually.';
    el.cancelLibraryDialogBtn.hidden = false;
  } else {
    el.libraryDialogTitle.textContent = 'Create your library folder';
    el.libraryDialogSubtitle.textContent = 'Set this once before importing audiobooks. Model downloads will be saved in a models subfolder inside it.';
    el.libraryDialogWarning.textContent = '';
    el.cancelLibraryDialogBtn.hidden = true;
  }
  if (!el.librarySetupDialog.open || force) {
    el.librarySetupDialog.showModal();
  }
}

function closeLibrarySetup() {
  if (libraryDialogMode === 'setup' && !appState.settings.libraryFolderName.trim()) return;
  el.librarySetupDialog.close();
}

function clearDragPreview() {
  dragPreview = { targetId: null, indent: 0, placement: 'before' };
  [...el.notesDocument.querySelectorAll('.note-line')].forEach((row) => {
    row.classList.remove('drag-preview', 'drag-preview-before', 'drag-preview-after');
    row.style.removeProperty('--preview-indent');
  });
}

function targetIsInteractive(target) {
  return !!target?.closest?.('textarea, input, select, dialog, .sheet-card, .speed-card');
}

function bindEvents() {
  el.openSidebarBtn.addEventListener('click', openSidebar);
  el.miniCollapseBtn?.addEventListener('click', () => {
    appState.ui.notesMiniCollapsed = !appState.ui.notesMiniCollapsed;
    applyNotesMiniState();
  });
  el.sidebarBackdrop.addEventListener('click', closeSidebar);

  let gestureHandled = false;

  document.addEventListener('touchstart', (event) => {
    const target = event.target;
    if (target.closest('.sheet-dialog') || target.closest('dialog') || el.speedDialog?.open || el.appRoot.classList.contains('sidebar-open')) {
      swipeStartX = null;
      swipeStartY = null;
      swipeMode = null;
      return;
    }
    if (target.closest('.drag-handle, .note-bullet')) {
      noteDragActive = true;
      return;
    }
    if (target.closest('textarea, input, select')) {
      swipeStartX = null;
      swipeStartY = null;
      swipeMode = null;
      return;
    }
    const touch = event.touches[0];
    swipeStartX = touch.clientX;
    swipeStartY = touch.clientY;
    swipeMode = null;
    swipeSidebarCandidate = appState.ui.activeTab === 'player' && swipeStartX <= (window.innerWidth / 2);
    gestureHandled = false;
    pageSwipeOffset = 0;
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (noteDragActive || gestureHandled || swipeStartX == null || swipeStartY == null || el.appRoot.classList.contains('sidebar-open') || el.speedDialog?.open) return;
    const touch = event.touches[0];
    const dx = touch.clientX - swipeStartX;
    const dy = touch.clientY - swipeStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (!swipeMode) {
      if (absDx < 10) return;
      if (absDy > absDx + 8) {
        swipeMode = 'vertical';
        return;
      }
      const onNotes = appState.ui.activeTab === 'notes';
      const wantsPage = (appState.ui.activeTab === 'player' && dx < 0) || (onNotes && dx > 0);
      if (wantsPage) {
        swipeMode = 'page';
      } else if (swipeSidebarCandidate && dx > SWIPE_THRESHOLD && appState.ui.activeTab === 'player') {
        swipeMode = 'sidebar';
      } else {
        return;
      }
    }

    if (swipeMode === 'page') {
      event.preventDefault();
      const width = el.viewsViewport?.clientWidth || window.innerWidth || 1;
      const limitedDx = Math.max(-width, Math.min(width, dx));
      pageSwipeOffset = limitedDx;
      applyViewTransform(false, limitedDx);
      return;
    }

    if (swipeMode === 'sidebar' && dx > 56 && absDy < 42) {
      openSidebar();
      gestureHandled = true;
      swipeMode = 'sidebar-opened';
    }
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (swipeMode === 'page') {
      const width = el.viewsViewport?.clientWidth || window.innerWidth || 1;
      const shouldCommit = Math.abs(pageSwipeOffset) > width * 0.22;
      if (appState.ui.activeTab === 'player') {
        setActiveTab(shouldCommit ? 'notes' : 'player');
      } else {
        setActiveTab(shouldCommit ? 'player' : 'notes');
      }
    } else if (swipeMode && swipeMode !== 'vertical') {
      applyViewTransform(false, 0);
    }
    gestureHandled = false;
    swipeStartX = null;
    swipeStartY = null;
    swipeMode = null;
    swipeSidebarCandidate = false;
    pageSwipeOffset = 0;
    noteDragActive = false;
  }, { passive: true });

  window.addEventListener('resize', () => applyViewTransform(true, 0));

  document.addEventListener('touchstart', (event) => {
    if (!el.appRoot.classList.contains('sidebar-open') || el.speedDialog?.open) return;
    if (targetIsInteractive(event.target)) return;
    const touch = event.touches[0];
    sidebarSwipeStartX = touch.clientX;
    sidebarSwipeStartY = touch.clientY;
    sidebarSwipeDragging = false;
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!el.appRoot.classList.contains('sidebar-open') || sidebarSwipeStartX == null || sidebarSwipeStartY == null || el.speedDialog?.open) return;
    const touch = event.touches[0];
    const dx = touch.clientX - sidebarSwipeStartX;
    const dy = touch.clientY - sidebarSwipeStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (!sidebarSwipeDragging) {
      if (absDx < 8) return;
      if (absDy > absDx + 6) return;
      if (dx >= 0) return;
      sidebarSwipeDragging = true;
    }
    if (!sidebarSwipeDragging) return;
    event.preventDefault();
    el.sidebar.style.transform = `translateX(${Math.min(0, dx)}px)`;
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (sidebarSwipeDragging && el.appRoot.classList.contains('sidebar-open')) {
      const computed = el.sidebar.style.transform || '';
      const match = computed.match(/translateX\((-?\d+(?:\.\d+)?)px\)/);
      const shift = match ? Number(match[1]) : 0;
      if (shift <= -40) {
        closeSidebar();
      } else {
        el.sidebar.style.transform = '';
      }
    }
    sidebarSwipeStartX = null;
    sidebarSwipeStartY = null;
    sidebarSwipeDragging = false;
  }, { passive: true });

  el.sidebarTabs.forEach((button) => {
    button.addEventListener('click', () => setSidebarTab(button.dataset.sidebarTab));
  });

  el.bottomTabs.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  el.coverButton.addEventListener('click', importBook);
  el.openSpeedBtn.addEventListener('click', () => {
    if (el.appRoot.classList.contains('sidebar-open')) return;
    el.appRoot.classList.add('sheet-open');
    el.speedDialog.showModal();
  });
  el.speedSlider.addEventListener('input', () => setPlaybackSpeed(el.speedSlider.value));

  el.speedDialog.addEventListener('click', (event) => {
    const rect = el.speedDialog.querySelector('.sheet-card').getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) el.speedDialog.close();
  });
  el.speedDialog.addEventListener('close', () => {
    el.appRoot.classList.remove('sheet-open');
  });

  el.changeLibraryFolderBtn.addEventListener('click', () => openLibrarySetup(true, 'rename'));
  el.transcriptionModeSelect?.addEventListener('change', () => {
    appState.settings.transcriptionMode = el.transcriptionModeSelect.value;
    persistState();
    showToast('Transcription quality updated.');
  });

  el.modelsPanel?.addEventListener('click', async (event) => {
    const pickerButton = event.target.closest('[data-model-picker]');
    if (pickerButton) {
      await installManualModel(pickerButton.dataset.modelPicker);
      return;
    }
    const actionButton = event.target.closest('[data-model-action]');
    if (!actionButton) return;
    const kind = actionButton.dataset.modelKind;
    const modelId = actionButton.dataset.modelId;
    const action = actionButton.dataset.modelAction;
    if (action === 'download') {
      await downloadModel(kind, modelId);
      return;
    }
    if (action === 'activate') {
      const state = getModelState(kind);
      state.activeId = modelId;
      if (kind === 'whisper') appState.settings.transcriptionMode = definitionForModel(kind, modelId)?.mode || whisperModeFromModelId(modelId);
      persistState();
      renderModels();
      showToast('Model switched.');
    }
  });
  el.rememberSpeedCheckbox.addEventListener('change', () => {
    appState.settings.rememberSpeedPerBook = el.rememberSpeedCheckbox.checked;
    persistState();
  });
  el.highlightModeSelect?.addEventListener('change', () => {
    appState.settings.highlightMode = el.highlightModeSelect.value;
    persistState();
    showToast(el.highlightModeSelect.value === 'summary' ? 'Summary Mode enabled.' : 'Verbatim highlights enabled.');
  });

  el.cancelLibraryDialogBtn.addEventListener('click', closeLibrarySetup);
  el.librarySetupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const folderName = el.librarySetupInput.value.trim();
    if (!folderName) {
      showToast('Enter a library folder name.');
      return;
    }
    appState.settings.libraryFolderName = folderName;
    persistState();
    ensureModelsFolder();
    el.librarySetupDialog.close();
    updateBookUI();
    renderModels();
    showToast(libraryDialogMode === 'rename' ? 'Library folder updated.' : 'Library folder created.');
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

  el.clipButtons.forEach((button) => {
    button.addEventListener('click', () => saveClip(Number(button.dataset.clip || 0)));
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
    const importCard = event.target.closest('[data-import-card]');
    if (importCard) {
      closeSidebar();
      await importBook();
      return;
    }
    const card = event.target.closest('[data-book-id]');
    if (!card) return;
    await loadBook(card.dataset.bookId);
    closeSidebar();
  });

  el.notesDocument.addEventListener('input', (event) => {
    const textarea = event.target.closest('textarea[data-line-id]');
    if (!textarea) return;
    const lines = getNotesDoc();
    const current = lines.find((item) => item.id === textarea.dataset.lineId);
    if (isPendingHighlightLine(current)) return;
    updateNoteLine(textarea.dataset.lineId, textarea.value);
    autoSizeTextarea(textarea);
  });

  el.notesDocument.addEventListener('keydown', (event) => {
    const textarea = event.target.closest('textarea[data-line-id]');
    if (!textarea) return;
    const lineId = textarea.dataset.lineId;
    const lines = getNotesDoc();
    const line = lines.find((item) => item.id === lineId);
    if (!line || isPendingHighlightLine(line)) return;

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? start;
      const before = textarea.value.slice(0, start);
      const after = textarea.value.slice(end);
      line.text = before;
      persistState();
      insertNoteAfter(lineId, after, 0);
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      changeLineIndent(lineId, event.shiftKey ? -1 : 1);
      return;
    }

    if (event.key === 'Backspace' && textarea.selectionStart === textarea.selectionEnd && textarea.value === '') {
      event.preventDefault();
      if ((line.indent || 0) > 0) {
        changeLineIndent(lineId, -1);
      } else {
        removeNoteLine(lineId);
      }
    }
  });

  el.notesDocument.addEventListener('dragstart', (event) => {
    const dragStartControl = event.target.closest('.drag-handle, .note-bullet');
    if (!dragStartControl) return;
    const row = dragStartControl.closest('.note-line');
    if (!row) return;
    draggedLineId = row.dataset.lineId;
    noteDragActive = true;
    event.dataTransfer.effectAllowed = 'move';
  });

  el.notesDocument.addEventListener('dragend', () => {
    draggedLineId = null;
    noteDragActive = false;
    clearDragPreview();
  });

  el.notesDocument.addEventListener('dragover', (event) => {
    event.preventDefault();
    const row = event.target.closest('.note-line');
    if (!row) return;
    const docRect = el.notesDocument.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const targetId = row.dataset.lineId;
    const lines = getNotesDoc();
    const targetIndex = lines.findIndex((line) => line.id === targetId);
    if (targetIndex < 0) return;

    const placement = event.clientY > (rowRect.top + rowRect.height / 2) ? 'after' : 'before';
    const previewIndexBase = placement === 'after' ? endOfSubtreeIndex(lines, targetIndex) : targetIndex;
    const dragIndex = lines.findIndex((line) => line.id === draggedLineId);
    const previewIndex = dragIndex >= 0 && dragIndex < previewIndexBase ? Math.max(0, previewIndexBase - 1) : Math.max(0, previewIndexBase);
    const relativeX = Math.max(0, event.clientX - docRect.left - 24);
    const requestedIndent = Math.round(relativeX / INDENT_STEP_PX);
    const indent = clampIndentForIndex(lines, previewIndex, requestedIndent);
    clearDragPreview();
    row.classList.add('drag-preview', placement === 'after' ? 'drag-preview-after' : 'drag-preview-before');
    row.style.setProperty('--preview-indent', String(indent));
    dragPreview = { targetId, indent, placement };
  });

  el.notesDocument.addEventListener('drop', (event) => {
    event.preventDefault();
    if (!draggedLineId || !dragPreview.targetId) return;
    moveLine(draggedLineId, dragPreview.targetId, dragPreview.indent, dragPreview.placement);
    draggedLineId = null;
    noteDragActive = false;
    clearDragPreview();
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
  resetStaleProcessingJobs();
  bindEvents();
  renderApp();
  if (!appState.settings.libraryFolderName.trim()) {
    openLibrarySetup(true);
  } else {
    ensureModelsFolder();
  }
  if (appState.lastBookId) {
    await loadBook(appState.lastBookId);
  }
  renderApp();
  processHighlightQueue();
}

init();
