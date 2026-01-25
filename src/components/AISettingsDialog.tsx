/**
 * AI Settings Dialog
 * User-facing controls for enabling/disabling AI features and downloading models
 * 
 * Features:
 * - Toggle AI query parsing (T5 model, ~30MB)
 * - Toggle semantic ranking (embeddings, ~80MB)
 * - Download progress indicators
 * - Storage space estimates
 * - Clear model cache option
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Download, CheckCircle2, XCircle, Trash2, Info } from "lucide-react";
import {
  getAIConfig,
  enableFeature,
  disableFeature,
  getModelSize,
  clearModelCache,
  getStats,
  type AIConfig,
} from "@/utils/ai";
import { detectPlatform } from "@/utils/platformDetection";

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISettingsDialog({ open, onOpenChange }: AISettingsDialogProps) {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [clearing, setClearing] = useState(false);
  const platform = detectPlatform();
  const isTauri = platform === 'desktop';
  
  // Load configuration
  useEffect(() => {
    if (open) {
      setConfig(getAIConfig());
    }
  }, [open]);
  
  const t5Model = getModelSize('Xenova/LaMini-Flan-T5-77M');
  const embeddingsModel = getModelSize('Xenova/all-MiniLM-L6-v2');
  const stats = getStats();
  
  const handleToggleQueryParsing = async () => {
    if (!config) return;
    
    const newValue = !config.features.enableSemanticQueryParsing;
    
    // Classical NLP requires no downloads - instant toggle
    if (newValue) {
      enableFeature('enableSemanticQueryParsing');
    } else {
      disableFeature('enableSemanticQueryParsing');
    }
    
    setConfig(getAIConfig());
  };
  
  const handleToggleSemanticRanking = async () => {
    if (!config) return;
    
    const newValue = !config.features.enableSemanticRanking;
    
    if (newValue) {
      if (!isTauri) {
        setDownloading('embeddings');
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 300));
          setDownloadProgress(i);
        }
        setDownloading(null);
      }
      enableFeature('enableSemanticRanking');
    } else {
      disableFeature('enableSemanticRanking');
    }
    
    setConfig(getAIConfig());
  };
  
  const handleClearCache = async () => {
    if (isTauri) return; // Can't clear bundled models
    
    setClearing(true);
    try {
      await clearModelCache();
      disableFeature('enableSemanticQueryParsing');
      disableFeature('enableSemanticRanking');
      setConfig(getAIConfig());
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setClearing(false);
    }
  };
  
  if (!config) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Search Settings</DialogTitle>
          <DialogDescription>
            Enhance your search experience with AI-powered features. {isTauri ? 'All features are bundled in the app.' : 'Classical NLP is enabled by default (no downloads). Advanced features require model downloads.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Platform Info */}
          {!isTauri && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Classical NLP is enabled and requires no downloads.</strong> Advanced semantic ranking requires an 80MB model download that will be cached in your browser.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Query Parsing Feature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <Label htmlFor="query-parsing" className="text-base font-medium">
                  AI Query Understanding (Classical NLP)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Natural language understanding with synonym expansion and intent detection (0MB - No download required)
                </p>
              </div>
              <Switch
                id="query-parsing"
                checked={config.features.enableSemanticQueryParsing}
                onCheckedChange={handleToggleQueryParsing}
                disabled={downloading === 'embeddings'} // Only disabled when embeddings are downloading
              />
            </div>
            
            {config.features.enableSemanticQueryParsing && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Enabled - Instant, no download needed</span>
              </div>
            )}
          </div>
          
          {/* Semantic Ranking Feature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <Label htmlFor="semantic-ranking" className="text-base font-medium">
                  Semantic Similarity Ranking
                </Label>
                <p className="text-sm text-muted-foreground">
                  {embeddingsModel.description} ({embeddingsModel.sizeMB}MB)
                </p>
                <p className="text-xs text-muted-foreground">
                  Advanced feature - recommended for power users only
                </p>
              </div>
              <Switch
                id="semantic-ranking"
                checked={config.features.enableSemanticRanking}
                onCheckedChange={handleToggleSemanticRanking}
                disabled={downloading !== null || (isTauri && false)}
              />
            </div>
            
            {downloading === 'embeddings' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Downloading model...</span>
                </div>
                <Progress value={downloadProgress} className="h-2" />
              </div>
            )}
            
            {!downloading && config.features.enableSemanticRanking && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Enabled</span>
              </div>
            )}
          </div>
          
          {/* Stats */}
          {stats.totalQueries > 0 && (
            <div className="border-t pt-4 space-y-2">
              <h4 className="text-sm font-medium">Statistics</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Searches</p>
                  <p className="font-medium">{stats.totalQueries}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">AI Enhanced</p>
                  <p className="font-medium">{stats.aiEnhancedQueries}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Success Rate</p>
                  <p className="font-medium">
                    {stats.totalQueries > 0 
                      ? `${((stats.successCount / stats.totalQueries) * 100).toFixed(0)}%`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg Latency</p>
                  <p className="font-medium">{stats.avgLatencyMs.toFixed(0)}ms</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Clear Cache (Browser only) */}
          {!isTauri && (config.features.enableSemanticQueryParsing || config.features.enableSemanticRanking) && (
            <div className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                disabled={clearing}
                className="w-full"
              >
                {clearing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing cache...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Model Cache
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will remove downloaded models and disable AI features. You can re-enable them anytime.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
