# Sherpa-Onnx TTS Installation Report

**Date:** 2025-11-21
**Version:** v1.12.17 (WASM SIMD)
**Type:** Offline Text-to-Speech (TTS)

## 1. Installation Overview
We have successfully installed and configured the **Sherpa-Onnx** offline TTS engine for LexiType Academy. This allows high-quality, low-latency speech synthesis directly in the browser without requiring an internet connection or backend server.

## 2. File Structure
The following files are located in `public/sherpa/sherpa-onnx-wasm-simd-v1.12.17-en-tts/`:

| File | Description |
|------|-------------|
| `sherpa-onnx-tts.js` | High-level JavaScript wrapper class (`OfflineTts`). |
| `sherpa-onnx-wasm-main-tts.js` | Emscripten runtime loader. |
| `sherpa-onnx-wasm-main-tts.wasm` | The compiled WebAssembly binary (contains the engine logic). |
| `sherpa-onnx-wasm-main-tts.data` | Virtual filesystem bundle containing the models and config files. |

**Note:** All other unused files (ASR, VAD, archives) have been removed to save space.

## 3. Model Configuration
The engine is configured to use the **VITS** model embedded in the `.data` file.

- **Model Type:** VITS (Variational Inference with adversarial learning for end-to-end Text-to-Speech)
- **Language:** English (and Chinese support via espeak-ng)
- **Files included in `.data`:**
    - `model.onnx`
    - `tokens.txt`
    - `espeak-ng-data/` (Phoneme data)

## 4. Integration Details

### Provider
`src/services/tts/SherpaOnnxProvider.ts`
- Manages the Web Worker.
- Handles audio playback via `AudioContext`.
- **New Feature:** Implements caching using IndexedDB (`LexiTypeDB`).

### Worker
`src/services/tts/sherpa-worker.js`
- Runs in a separate thread to prevent UI freezing.
- Loads the WASM module.
- Generates audio samples and returns them to the main thread.

### Caching
Generated audio is cached in the browser's IndexedDB (`ttsCache` table).
- **Key:** Text + Model Version
- **Value:** WAV Blob
- **Benefit:** Repeated sentences (e.g., in course reviews) load instantly without re-generation.

## 5. Optimization
- **English Practice:** TTS now triggers on **punctuation** (comma, period, etc.) instead of every word. This provides a more natural "phrase-by-phrase" feedback loop.
- **Cleanup:** Unused ASR/VAD modules were removed.

## 6. Troubleshooting
If TTS fails to load:
1. Check the browser console for 404 errors on `.wasm` or `.data` files.
2. Ensure `sherpa-worker.js` has the correct path in `locateFile`.
3. Verify that `SherpaOnnxProvider` is selected in Settings.
