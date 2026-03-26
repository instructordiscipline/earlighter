# Native runtime setup (simple version)

This repo is pre-wired so you only need to do **two manual source drops** before compiling.

## 1) Put `whisper.cpp` here

Drop the full upstream `whisper.cpp` source tree into:

`plugins/earlighter-whisper-runtime/android/src/main/cpp/third_party/whisper.cpp/`

You should see files like `CMakeLists.txt`, `README.md`, `src/`, `include/`, and `ggml/` inside that folder when you are done.

## 2) Put `llama.cpp` here

Drop the full upstream `llama.cpp` source tree into:

`plugins/earlighter-llama-runtime/android/src/main/cpp/third_party/llama.cpp/`

You should see files like `CMakeLists.txt`, `README.md`, `src/`, and `include/` inside that folder when you are done.

## 3) Upload the repo to GitHub

Upload the entire repo after those two folders are in place.

## 4) Run the included GitHub Action

The workflow now:
- uses Node 22
- uses Java 21
- installs Android NDK + CMake
- generates/syncs the Android project
- compiles the local Capacitor plugins that wrap Whisper + llama

## 5) Install the APK

After install, use the app's **Models** section to:
- download a Whisper model (`tiny.en`, `base.en`, or `small.en`)
- download a GGUF model (TinyLlama or Qwen)
- or choose a file manually

Those model files are saved under:

`<your startup library folder>/models`

## Important note

The runtime engines (`whisper.cpp` and `llama.cpp`) are compiled into the app.
The model files are **not** compiled into the app.
The app downloads or picks those model files later.
