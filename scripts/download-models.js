#!/usr/bin/env node

/**
 * Model Download and Deployment Script
 * 
 * Downloads AI models from HuggingFace and prepares them for:
 * 1. Tauri desktop app bundling (src-tauri/models/)
 * 2. Browser/PWA deployment (uploads to Supabase Storage)
 * 
 * Run: npm run download-models
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MODELS = {
  't5': {
    name: 'LaMini-Flan-T5-77M',
    huggingfaceRepo: 'Xenova/LaMini-Flan-T5-77M',
    size: '~30MB',
    files: [
      'config.json',
      'generation_config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/encoder_model.onnx',
      'onnx/encoder_model_quantized.onnx',
      'onnx/decoder_model_merged.onnx',
      'onnx/decoder_model_merged_quantized.onnx'
    ]
  },
  'embeddings': {
    name: 'all-MiniLM-L6-v2',
    huggingfaceRepo: 'Xenova/all-MiniLM-L6-v2',
    size: '~80MB',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model.onnx',
      'onnx/model_quantized.onnx'
    ]
  }
};

const TAURI_MODELS_DIR = path.join(__dirname, '..', 'src-tauri', 'models');
const CACHE_DIR = path.join(__dirname, '..', '.model-cache');

/**
 * Download a file from HuggingFace CDN
 */
async function downloadFile(url, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Check if file already exists
  if (fs.existsSync(dest)) {
    console.log(`  ✓ Already cached: ${path.basename(dest)}`);
    return;
  }

  return new Promise((resolve, reject) => {
    console.log(`  ⬇ Downloading: ${path.basename(dest)}...`);
    
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`  ✓ Downloaded: ${path.basename(dest)}`);
            resolve();
          });
        }).on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`  ✓ Downloaded: ${path.basename(dest)}`);
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

/**
 * Download all files for a model
 */
async function downloadModel(modelKey) {
  const model = MODELS[modelKey];
  console.log(`\n📦 Downloading ${model.name} (${model.size})...`);
  
  const modelCacheDir = path.join(CACHE_DIR, model.name);
  
  for (const file of model.files) {
    const url = `https://huggingface.co/${model.huggingfaceRepo}/resolve/main/${file}`;
    const dest = path.join(modelCacheDir, file);
    
    try {
      await downloadFile(url, dest);
    } catch (error) {
      console.error(`  ✗ Failed to download ${file}:`, error.message);
      throw error;
    }
  }
  
  console.log(`✓ ${model.name} downloaded successfully`);
  return modelCacheDir;
}

/**
 * Copy models to Tauri bundle directory
 */
function copyToTauriBundle(modelCacheDir, modelName) {
  const tauriModelDir = path.join(TAURI_MODELS_DIR, modelName);
  
  console.log(`\n📁 Copying ${modelName} to Tauri bundle...`);
  
  if (!fs.existsSync(tauriModelDir)) {
    fs.mkdirSync(tauriModelDir, { recursive: true });
  }
  
  // Copy all files recursively
  function copyRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ✓ Copied: ${entry.name}`);
      }
    }
  }
  
  copyRecursive(modelCacheDir, tauriModelDir);
  console.log(`✓ ${modelName} copied to Tauri bundle`);
}

/**
 * Generate model directory README
 */
function generateReadme() {
  const readmePath = path.join(TAURI_MODELS_DIR, 'README.md');
  const content = `# AI Models Directory

This directory contains bundled AI models for the Tauri desktop application.

## Models

### LaMini-Flan-T5-77M (~30MB)
- **Purpose**: Natural language query parsing
- **Source**: ${MODELS.t5.huggingfaceRepo}
- **Format**: ONNX (quantized for performance)
- **Usage**: Interprets user search queries like "find marketing people"

### all-MiniLM-L6-v2 (~80MB)
- **Purpose**: Semantic similarity and ranking
- **Source**: ${MODELS.embeddings.huggingfaceRepo}
- **Format**: ONNX (quantized for performance)
- **Usage**: Ranks search results by semantic similarity

## How These Models Are Used

1. **Desktop App (Tauri)**: Models are bundled in the app and loaded from local resources
2. **Browser/PWA**: Models are hosted on Supabase Storage and downloaded on user opt-in

## Updating Models

To update or re-download models:

\`\`\`bash
npm run download-models
\`\`\`

This will:
1. Download latest models from HuggingFace
2. Copy to this directory for Tauri bundling
3. (Manual step) Upload to Supabase Storage for browser users

## Size Impact

- Total bundled size: ~110MB
- Impact on app download: Desktop installers will be ~110MB larger
- Browser users: 0MB by default (opt-in download)

## License

Models are from HuggingFace and licensed under their respective licenses:
- LaMini-Flan-T5-77M: Apache 2.0
- all-MiniLM-L6-v2: Apache 2.0
`;

  fs.writeFileSync(readmePath, content);
  console.log('\n✓ Generated README.md');
}

/**
 * Upload models to Supabase Storage (if configured)
 */
async function uploadToSupabase(modelCacheDir, modelName) {
  // Check if Supabase credentials are configured
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('\n⚠ Supabase credentials not configured. Skipping upload.');
    console.log('  To enable browser model hosting, set:');
    console.log('    - SUPABASE_URL (or VITE_SUPABASE_URL)');
    console.log('    - SUPABASE_SERVICE_KEY');
    return;
  }
  
  console.log(`\n☁️  Uploading ${modelName} to Supabase Storage...`);
  console.log('  Note: This requires manual upload via Supabase dashboard or API');
  console.log(`  Upload directory: ${modelCacheDir}`);
  console.log(`  Destination bucket: ai-models/${modelName}/`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🤖 AI Model Download and Deployment Script');
  console.log('=========================================\n');
  
  try {
    // Ensure directories exist
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (!fs.existsSync(TAURI_MODELS_DIR)) {
      fs.mkdirSync(TAURI_MODELS_DIR, { recursive: true });
    }
    
    // Download T5 model
    const t5CacheDir = await downloadModel('t5');
    copyToTauriBundle(t5CacheDir, MODELS.t5.name);
    await uploadToSupabase(t5CacheDir, MODELS.t5.name);
    
    // Download embeddings model
    const embeddingsCacheDir = await downloadModel('embeddings');
    copyToTauriBundle(embeddingsCacheDir, MODELS.embeddings.name);
    await uploadToSupabase(embeddingsCacheDir, MODELS.embeddings.name);
    
    // Generate README
    generateReadme();
    
    console.log('\n✅ All models downloaded and prepared successfully!');
    console.log('\nNext steps:');
    console.log('1. Commit src-tauri/models/ to version control (or add to .gitignore)');
    console.log('2. Upload models to Supabase Storage for browser users');
    console.log('3. Configure VITE_MODEL_STORAGE_URL in .env');
    console.log('\nTauri builds will now include bundled models.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
