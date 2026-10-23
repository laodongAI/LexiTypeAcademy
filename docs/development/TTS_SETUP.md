# Offline TTS Setup Guide (Sherpa-Onnx)

To enable offline Text-to-Speech using Sherpa-Onnx, you need to place the required model and engine files in the `public/sherpa` directory.

## 1. Directory Structure

Ensure your `public/sherpa` folder looks like this:

```
public/
  sherpa/
    sherpa-onnx-wasm-main.js       <-- REQUIRED: The WASM JS wrapper
    sherpa-onnx-wasm-main.wasm     <-- REQUIRED: The WASM binary
    sherpa-onnx-zipvoice-distill-zh-en-emilia/  <-- The Model Folder
      text_encoder.onnx
      fm_decoder.onnx
      vocos_24khz.onnx
      tokens.txt
      espeak-ng-data/
```

## 2. Download Missing Files

You currently have the model files, but you are missing the **WASM Engine** files.

1.  **Download `sherpa-onnx-wasm-main.js` and `sherpa-onnx-wasm-main.wasm`**:
    *   You can find these in the `sherpa-onnx` releases on GitHub or HuggingFace.
    *   Example source: [HuggingFace k2-fsa/sherpa-onnx-wasm-sim-zh-en-tts](https://huggingface.co/spaces/k2-fsa/web-assembly-tts-sherpa-onnx-zh-en/tree/main) (You can grab the `.js` and `.wasm` files from here or similar demos).
    *   **Important**: Rename them to `sherpa-onnx-wasm-main.js` and `sherpa-onnx-wasm-main.wasm` if they have different names.

2.  **Place them in `public/sherpa/`**.

## 3. Verify

After placing the files:
1.  Refresh the application.
2.  Go to Settings -> TTS.
3.  Select "Sherpa-Onnx (Offline)".
4.  Try the "Test Voice" button.
