# Tauri LLM Model Bundling Guide

This guide explains how to bundle LLM models with your Tauri app for offline, CORS-free model loading.

## Overview

By bundling the primary model (LaMini-Flan-T5-78M) with your Tauri app, you can:
- Load models instantly (no network requests)
- Work completely offline
- Avoid CORS issues
- Provide a better user experience

**Bundle Size Impact**: ~30MB for primary model, total app size ~40-60MB

## Step 1: Download Model Files

The model files need to be downloaded from Hugging Face and placed in your Tauri resources directory.

### Option A: Manual Download

1. Visit: https://huggingface.co/Xenova/LaMini-Flan-T5-78M/tree/main
2. Download these files:
   - `model_quantized.onnx` (~30MB)
   - `tokenizer.json`
   - `config.json`
   - `vocab.json` (if exists)
   - `merges.txt` (if exists)

3. Create directory: `src-tauri/models/LaMini-Flan-T5-78M/`
4. Place all files in that directory

### Option B: Automated Script (Recommended)

Create a script to download models automatically:

```bash
#!/bin/bash
# download-tauri-models.sh

MODEL_NAME="Xenova/LaMini-Flan-T5-78M"
MODEL_DIR="src-tauri/models/LaMini-Flan-T5-78M"
BASE_URL="https://huggingface.co/${MODEL_NAME}/resolve/main"

mkdir -p "$MODEL_DIR"

# Download model files
echo "Downloading model files..."
curl -L "${BASE_URL}/model_quantized.onnx" -o "${MODEL_DIR}/model_quantized.onnx"
curl -L "${BASE_URL}/tokenizer.json" -o "${MODEL_DIR}/tokenizer.json"
curl -L "${BASE_URL}/config.json" -o "${MODEL_DIR}/config.json"

# Download vocab files if they exist
curl -L "${BASE_URL}/vocab.json" -o "${MODEL_DIR}/vocab.json" 2>/dev/null || true
curl -L "${BASE_URL}/merges.txt" -o "${MODEL_DIR}/merges.txt" 2>/dev/null || true

echo "Model files downloaded to ${MODEL_DIR}"
echo "Total size: $(du -sh ${MODEL_DIR} | cut -f1)"
```

Run: `chmod +x download-tauri-models.sh && ./download-tauri-models.sh`

## Step 2: Update Tauri Configuration

The Tauri configuration has already been updated to:
1. Include models in the bundle (`resources: ["models/**"]`)
2. Allow asset protocol in CSP for loading bundled files

The configuration is in `src-tauri/tauri.conf.json` and should already be set up correctly.

## Step 3: Update Model Loading Code

The model loading code in `src/utils/semanticAssist/unifiedLLMAdapter.ts` will automatically detect Tauri and load from the bundle. The code uses Tauri's resource path resolution.

## Step 4: Build Tauri App

After adding models, build your Tauri app:

```bash
npm run tauri:build
```

The models will be included in the final bundle.

## Verification

After building, check the app bundle size:
- **Expected**: ~40-60MB (base app + primary model)
- **Without models**: ~10-30MB

## Fallback Behavior

If bundled models fail to load, the system will:
1. Try to load from Supabase proxy (if available)
2. Fall back to deterministic parsing

## Notes

- Only bundle the primary model (LaMini-Flan-T5-78M) to keep app size reasonable
- Fallback models can still be loaded via proxy if needed
- Models are loaded lazily (only when first search query is made)
- Models are cached in IndexedDB after first load for faster subsequent loads
