# Earlighter

Earlighter is an offline-first Android audiobook player for local MP3 files built with Capacitor.

## What is included in this repo
- Premium dark UI tuned for Android.
- Local audiobook import using Capacitor file picking when available.
- Offline library persistence in IndexedDB.
- Per-book resume position, remembered speed, and remembered last-opened book.
- Premium player with back 30, back 10, play/pause, forward 10, forward 30 controls.
- Playback speed control.
- Clip capture references for the last 10, 30, or 60 seconds of source time.
- Dynalist-style hierarchical notes document per audiobook.
- Local note organization helpers.
- Settings, storage dashboard, and polished state handling.

## Important implementation note
This build ships the complete offline player, storage, notes, hierarchy, and capture workflow.

The on-device Whisper.cpp and TinyLlama runtime integration discussed in planning is **not fully bundled in this repo**, because packaging and validating native model runtimes and model files for Android from this environment would require additional native build assets and large local model binaries that are not present here.

To keep the repository compile-ready with your GitHub Actions workflow, the app includes:
- a production-ready UI shell,
- persistence and player logic,
- transcript and notes architecture,
- deterministic offline note organization fallback logic.

## Build
Use the included GitHub Actions workflow or the workflow body you already provided.

## Current architecture choices
- Static web assets in `www/` so the provided workflow does not need a web build step.
- Capacitor plugins installed through `npm install` and `npx cap sync android`.
- Offline book storage via IndexedDB blobs.
- Native file picking through `@capawesome/capacitor-file-picker` when available.

## Suggested next native upgrades
When you are ready to take this beyond the compile-ready shell in this repo, the next high-value additions are:
1. Android foreground service for long-running transcription.
2. Whisper.cpp native bridge with tiny/base/small model selection.
3. TinyLlama native or wasm bridge for note cleanup and organization.
4. Incremental transcript persistence backed by a native worker.

