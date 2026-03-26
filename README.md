# Earlighter

Offline-first Android audiobook player and knowledge capture app.

## Fastest possible setup

1. Put the full `whisper.cpp` source tree into:
   - `plugins/earlighter-whisper-runtime/android/src/main/cpp/third_party/whisper.cpp/`
2. Put the full `llama.cpp` source tree into:
   - `plugins/earlighter-llama-runtime/android/src/main/cpp/third_party/llama.cpp/`
3. Upload the repo to GitHub.
4. Run the included GitHub Action.
5. Install the APK.
6. In the app, open **Models** and download or select your Whisper + GGUF models.

See `NATIVE_RUNTIME_SETUP.md` for the step-by-step guide.
