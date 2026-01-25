# AI Layer Architecture

This document describes the AI-enhanced search system in WhoNow, including architecture, safety guarantees, and usage instructions.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Safety Guarantees](#safety-guarantees)
4. [Model Hosting](#model-hosting)
5. [User Experience](#user-experience)
6. [Configuration](#configuration)
7. [Debugging](#debugging)
8. [Performance](#performance)

## Overview

The AI layer enhances contact search with natural language understanding while maintaining **100% reliability** through deterministic fallback.

### Key Principles

1. **Deterministic First**: Rule-based search ALWAYS works
2. **AI is Optional**: User opt-in required for browser/PWA
3. **Never Breaks**: AI failures are invisible to users
4. **Zero Cost**: All models run locally, no API costs
5. **Offline Capable**: Works without internet (after initial setup)

### What AI Does

- **Query Understanding**: Interprets "find marketing people" → job_title filter
- **Semantic Similarity**: Ranks results by meaning, not just keywords
- **Synonym Expansion**: "engineers" matches "developers"

### What AI Doesn't Do

- Replace deterministic search (it enhances it)
- Block or delay search results
- Make requests to external APIs
- Require user setup in Tauri desktop app

## Architecture

### Component Overview

```
┌─────────────────────────────────────────┐
│           User Query Input              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│     Step 1: Deterministic Parser        │
│   (ALWAYS runs, ALWAYS works)           │
│   - Entity extraction                   │
│   - Time range parsing                  │
│   - Synonym expansion                   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│   Step 2: Execute Deterministic Search  │
│   (Results immediately available)       │
└────────────────┬────────────────────────┘
                 │
                 ├──> User sees results (instant)
                 │
                 ▼
┌─────────────────────────────────────────┐
│   Step 3: AI Enhancement (Optional)     │
│   - Respects user preferences           │
│   - Circuit breaker protection          │
│   - Timeout enforcement                 │
│   - Never throws errors                 │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│   Step 4: Merge & Re-rank (If AI used)  │
│   - Deterministic filters NEVER changed │
│   - AI can only enhance, not restrict   │
│   - Conflict detection                  │
└────────────────┬────────────────────────┘
                 │
                 ▼
       Enhanced Results (optional)
```

### File Structure

```
src/
├── utils/
│   ├── ai/
│   │   ├── aiConfig.ts          # Configuration & feature flags
│   │   ├── aiLayer.ts           # Main AI abstraction
│   │   ├── modelLoader.ts       # Platform-aware model loading
│   │   ├── aiMonitor.ts         # Performance monitoring
│   │   └── index.ts             # Public API
│   ├── semanticAssist/
│   │   ├── unifiedLLMAdapter.ts # Model inference
│   │   └── mergeQueries.ts      # Query merging logic
│   └── searchQueryParser.ts     # Deterministic parser
├── components/
│   ├── AISettingsDialog.tsx     # User settings UI
│   └── SearchDebugPanel.tsx     # Debug panel (Ctrl+Shift+D)
└── hooks/
    └── useSmartSearch.ts         # Search hook (refactored)

scripts/
└── download-models.js            # Model download script

src-tauri/
└── models/                       # Bundled models (desktop)
    ├── LaMini-Flan-T5-77M/
    └── all-MiniLM-L6-v2/
```

## Safety Guarantees

### 1. Deterministic Search Never Breaks

```typescript
// BEFORE (unsafe)
const results = await aiSearch(query);  // What if AI fails?

// AFTER (safe)
const deterministicResults = executeSearchQuery(contacts, deterministicQuery);
// User sees results immediately ✓

// Then optionally enhance with AI (background, non-blocking)
const enhancement = await enhanceQuery(query, deterministicQuery);
```

### 2. AI Failures Are Invisible

All AI functions return fallback values, never throw:

```typescript
export async function enhanceQuery(
  query: string,
  deterministicQuery: SearchQuery
): Promise<AIEnhancement> {
  try {
    // ... AI logic
  } catch (error) {
    // Return deterministic result, never throw
    return createFallbackResult(deterministicQuery, error.message);
  }
}
```

### 3. Circuit Breaker Pattern

After 3 consecutive failures, AI is auto-disabled for 1 minute:

```typescript
if (shouldTripCircuitBreaker(maxFailures)) {
  return createFallbackResult(
    deterministicQuery,
    'Circuit breaker tripped'
  );
}
```

### 4. Merge Logic Safety

```typescript
// Deterministic filters ALWAYS preserved
merged.filters = {
  ...semantic.filters,      // AI suggestions
  ...deterministic.filters, // Deterministic OVERRIDES
};

// Validation: Ensure deterministic wasn't overridden
for (const key of deterministicKeys) {
  if (merged.filters[key] !== deterministic.filters[key]) {
    console.error(`ERROR: Deterministic field "${key}" was overridden!`);
    merged.filters[key] = deterministic.filters[key]; // Force restore
  }
}
```

### 5. Timeout Enforcement

```typescript
const timeoutMs = 5000; // 5 seconds max
const result = await Promise.race([
  aiEnhancement,
  timeout(timeoutMs, fallbackResult)
]);
```

## Model Hosting

### Desktop (Tauri)

Models are **bundled** in the app package:

```
app-bundle/
└── resources/
    └── models/
        ├── LaMini-Flan-T5-77M/  (~30MB)
        └── all-MiniLM-L6-v2/    (~80MB)
```

- No download required
- Works offline immediately
- +110MB app size

### Browser/PWA

Models are **opt-in** and hosted on Supabase Storage:

```
Supabase Storage Bucket: ai-models/
├── LaMini-Flan-T5-77M/
│   ├── config.json
│   ├── tokenizer.json
│   └── onnx/model.onnx
└── all-MiniLM-L6-v2/
    ├── config.json
    ├── tokenizer.json
    └── onnx/model.onnx
```

- User must enable in Settings
- One-time download, cached forever
- 0MB default, 30MB with T5, 110MB with both

### Setup Steps

#### 1. Download Models

```bash
npm run download-models
```

This script:
- Downloads models from HuggingFace
- Copies to `src-tauri/models/` for bundling
- (Manual) Upload to Supabase Storage

#### 2. Upload to Supabase

1. Create public bucket: `ai-models`
2. Upload model directories
3. Set CORS headers: `Access-Control-Allow-Origin: *`
4. Set cache headers: `Cache-Control: max-age=31536000`

#### 3. Configure Environment

```bash
# .env.local
VITE_MODEL_STORAGE_URL=https://your-project.supabase.co/storage/v1/object/public/ai-models
```

#### 4. Build Tauri App

```bash
npm run tauri:build
```

Models are automatically bundled in the app package.

## User Experience

### Tauri Desktop

**First Launch:**
- AI features work immediately (models bundled)
- No setup, no download, no wait

**Behavior:**
- All AI features enabled by default
- Search enhanced automatically
- Works offline

### Browser/PWA

**First Launch:**
- Classical NLP works immediately (0MB)
- AI features disabled (user opt-in required)

**Enable AI:**
1. Open Settings
2. Click "AI Search Settings"
3. Toggle "AI Query Understanding"
4. Wait for download (~30 seconds)
5. AI features activated

**Behavior:**
- Settings persist in localStorage
- Models cached in IndexedDB
- Subsequent visits: instant

## Configuration

### Environment Variables

```bash
# Feature flags
VITE_ENABLE_AI=true                      # Master switch
VITE_ENABLE_SEMANTIC_PARSING=true        # T5 model
VITE_ENABLE_SEMANTIC_RANKING=true        # Embeddings
VITE_AI_DEBUG_MODE=false                 # Debug logging

# Models
VITE_LLM_MODEL=Xenova/LaMini-Flan-T5-77M
VITE_EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
VITE_MODEL_STORAGE_URL=https://...

# Performance
VITE_AI_TIMEOUT_MS=5000                  # Query parsing timeout
```

### Runtime Configuration

```typescript
import { enableFeature, disableFeature } from '@/utils/ai';

// Enable AI query parsing
enableFeature('enableSemanticQueryParsing');

// Disable AI completely
disableFeature('enableAI');
```

### User Preferences

Stored in `localStorage`:
- `whonow_ai_enabled`
- `whonow_query_parsing_enabled`
- `whonow_semantic_ranking_enabled`

## Debugging

### Debug Panel

Press **Ctrl+Shift+D** (or **Cmd+Shift+D**) to open:

- Current query status
- AI metadata (source, confidence, latency)
- Model status
- Session statistics
- Recent events

### Console API

```javascript
// Available in browser console
window.__aiDiagnostics

// Commands:
__aiDiagnostics.getStats()        // Get statistics
__aiDiagnostics.printStats()      // Pretty print stats
__aiDiagnostics.getRecentEvents() // Recent AI events
__aiDiagnostics.clearStats()      // Reset statistics
__aiDiagnostics.enableDebugMode() // Enable debug logging
__aiDiagnostics.disableDebugMode()// Disable debug logging
```

### Debug Mode

Enable detailed logging:

```bash
# .env.local
VITE_AI_DEBUG_MODE=true
```

Or at runtime:
```javascript
__aiDiagnostics.enableDebugMode();
```

Logs include:
- Model loading progress
- Query parsing results
- Merge decisions
- Fallback reasons
- Performance metrics

## Performance

### Latency

| Operation | Latency | Notes |
|-----------|---------|-------|
| Deterministic search | <10ms | Always runs first |
| T5 query parsing | 50-150ms | Background, non-blocking |
| Embedding generation | 20-50ms per contact | Cached after first run |
| Model loading (Tauri) | <100ms | From bundled resources |
| Model loading (Browser, cached) | <500ms | From IndexedDB |
| Model loading (Browser, first time) | 5-10s | One-time download |

### Memory

| Component | Memory | Notes |
|-----------|--------|-------|
| T5 model | ~30MB RAM | Loaded on first search |
| Embeddings model | ~80MB RAM | Loaded on first search |
| Contact embeddings | ~1KB per contact | Cached in IndexedDB |
| Total (both models) | ~110MB RAM | Released after timeout |

### Storage

| Platform | Storage | Notes |
|----------|---------|-------|
| Tauri desktop | +110MB app size | Bundled in installer |
| Browser (default) | 0MB | Classical NLP only |
| Browser (T5) | ~30MB | IndexedDB cache |
| Browser (T5 + embeddings) | ~110MB | IndexedDB cache |

### Optimization Tips

1. **Lazy Loading**: Models load on first search, not app launch
2. **Caching**: Query results cached for 24 hours
3. **Circuit Breaker**: Auto-disables after failures
4. **Timeout**: 5s max for query parsing
5. **Cleanup**: Models unloaded after 5 minutes of inactivity

## Testing

Run tests:

```bash
npm test src/utils/__tests__/searchIntegrity.test.ts
```

Tests verify:
- Deterministic search correctness
- AI enhancement doesn't break search
- Merge logic preserves deterministic filters
- AI failures fall back gracefully

## Privacy

- **All processing is local**: No data sent to external servers
- **Models run in-browser**: WASM execution
- **No tracking**: No telemetry or analytics
- **Offline capable**: Works without internet after setup

## Support

### Common Issues

**"AI features not working in browser"**
- Check user has enabled in Settings
- Check `VITE_MODEL_STORAGE_URL` is configured
- Check browser console for errors

**"Models won't download"**
- Check Supabase Storage bucket is public
- Check CORS headers are set
- Check network tab for 403/404 errors

**"Tauri app too large"**
- Models are bundled (~110MB overhead)
- Consider excluding embeddings model for smaller builds

**"Circuit breaker tripped"**
- AI auto-disables after 3 consecutive failures
- Resets after 1 minute
- Or call `__aiDiagnostics.clearStats()` to reset

### Getting Help

1. Enable debug mode: `__aiDiagnostics.enableDebugMode()`
2. Open debug panel: Press Ctrl+Shift+D
3. Check console for errors
4. Check `__aiDiagnostics.printStats()` for diagnostic info

## Future Enhancements

- [ ] Background model preloading during idle time
- [ ] Progressive model loading (load tokenizer first)
- [ ] Model compression (ONNX quantization)
- [ ] Edge function fallback for browser users
- [ ] Multi-language support
- [ ] Custom model fine-tuning

## License

Models used:
- **LaMini-Flan-T5-77M**: Apache 2.0
- **all-MiniLM-L6-v2**: Apache 2.0

Both are free to use, modify, and distribute.
