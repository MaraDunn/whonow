# AI Layer Integration Guide

This guide explains how to integrate the new AI components into your existing UI.

## Quick Integration

### 1. Add SearchDebugPanel to Index.tsx

```typescript
// At the top of Index.tsx
import { SearchDebugPanel } from "@/components/SearchDebugPanel";

// In the IndexContent component, access the aiMetadata from useSmartSearch:
const { contacts: searchResults, aiMetadata, interpretation } = useSmartSearch(
  folderFilteredContacts,
  searchQuery
);

// At the end of the return statement, before the closing tags:
return (
  <div className="flex h-screen overflow-hidden">
    {/* ... existing content ... */}
    
    {/* Add Search Debug Panel (toggles with Ctrl+Shift+D) */}
    <SearchDebugPanel 
      aiMetadata={aiMetadata}
      query={searchQuery}
      interpretation={interpretation}
    />
  </div>
);
```

### 2. Add AISettingsDialog to SettingsDialog

```typescript
// In SettingsDialog.tsx
import { AISettingsDialog } from "@/components/AISettingsDialog";
import { useState } from "react";

// Add state:
const [aiSettingsOpen, setAiSettingsOpen] = useState(false);

// Add a new button in the settings dialog:
<Button 
  variant="outline" 
  onClick={() => setAiSettingsOpen(true)}
  className="w-full"
>
  AI Search Settings
</Button>

// Add the dialog:
<AISettingsDialog 
  open={aiSettingsOpen} 
  onOpenChange={setAiSettingsOpen} 
/>
```

### 3. Update Tauri Configuration

Add models to bundled resources in `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "resources": [
      "models/*"
    ]
  }
}
```

## Usage

### For End Users

**Desktop (Tauri)**
- AI features work immediately, no setup required
- Models are bundled in the app

**Browser/PWA**
1. Open Settings → AI Search Settings
2. Enable "AI Query Understanding" (30MB download)
3. Optionally enable "Semantic Similarity Ranking" (80MB additional)

### For Developers

**Debug Panel**
- Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac) to toggle
- Shows AI status, query metadata, performance stats
- Useful for debugging AI behavior

**Console API**
```javascript
// Available in browser console
__aiDiagnostics.printStats()
__aiDiagnostics.getRecentEvents()
__aiDiagnostics.enableDebugMode()
```

**Environment Configuration**
```bash
# .env.local
VITE_ENABLE_AI=true
VITE_MODEL_STORAGE_URL=https://your-supabase-project.supabase.co/storage/v1/object/public/ai-models
```

## Testing

Run the integration tests:

```bash
npm test src/utils/__tests__/searchIntegrity.test.ts
```

These tests verify:
- Deterministic search always works
- AI enhancement doesn't break search
- Merge logic preserves deterministic filters
- Failures fall back gracefully

## Model Setup

### For Development

1. **Download models**:
   ```bash
   npm run download-models
   ```

2. **Upload to Supabase** (for browser users):
   - Create public bucket: `ai-models`
   - Upload `src-tauri/models/LaMini-Flan-T5-77M/` directory
   - Upload `src-tauri/models/all-MiniLM-L6-v2/` directory
   - Set CORS headers to allow all origins

3. **Configure environment**:
   ```bash
   VITE_MODEL_STORAGE_URL=https://[your-project].supabase.co/storage/v1/object/public/ai-models
   ```

### For Production Builds

**Tauri Desktop**:
```bash
npm run tauri:build
```
Models are automatically bundled.

**Browser/PWA**:
- Deploy normally
- Models download on user opt-in
- Cached in browser IndexedDB

## Monitoring

### Check AI Status

```typescript
import { getAIStatus } from '@/utils/ai';

const status = getAIStatus();
console.log('AI Available:', status.available);
console.log('Circuit Breaker:', status.circuitBreakerTripped);
```

### View Statistics

```typescript
import { getStats } from '@/utils/ai';

const stats = getStats();
console.log('Success Rate:', stats.successCount / stats.totalQueries);
console.log('Avg Latency:', stats.avgLatencyMs);
```

## Troubleshooting

### AI Not Working in Browser

1. Check user has enabled in Settings
2. Verify `VITE_MODEL_STORAGE_URL` is set
3. Check browser console for errors
4. Try `__aiDiagnostics.printStats()` in console

### Models Won't Download

1. Check Supabase Storage bucket is public
2. Verify CORS headers allow your domain
3. Check Network tab for 403/404 errors
4. Try clearing browser cache

### Circuit Breaker Tripped

AI auto-disables after 3 consecutive failures:
```javascript
// Reset via console:
__aiDiagnostics.clearStats()
```

Or wait 1 minute for automatic reset.

## Performance

- **Deterministic search**: <10ms (always)
- **AI enhancement**: 50-150ms (background, non-blocking)
- **Model loading** (Tauri): <100ms
- **Model loading** (Browser, first time): 5-10 seconds
- **Model loading** (Browser, cached): <500ms

## Security & Privacy

- All processing is local (in-browser or bundled)
- No data sent to external servers
- No API keys required
- Works offline after initial setup

## Next Steps

1. Test the integration in development
2. Upload models to Supabase Storage
3. Configure production environment variables
4. Deploy and monitor AI usage
5. Gather user feedback on AI quality

For detailed documentation, see [AI_LAYER.md](./AI_LAYER.md).
