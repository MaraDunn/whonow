/**
 * Search Debug Panel
 * Dev-mode panel for debugging AI search behavior
 * 
 * Toggle with Ctrl+Shift+D (or Cmd+Shift+D on Mac)
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X, RefreshCw, Download } from "lucide-react";
import { getAIStatus, getStats, getRecentEvents, type AIStats, type AIEvent } from "@/utils/ai";

interface SearchDebugPanelProps {
  aiMetadata?: {
    aiUsed: boolean;
    fallbackReason?: string;
    confidence: number;
    latencyMs: number;
    modelLoaded: boolean;
    source: 'ai' | 'deterministic' | 'hybrid';
  };
  query?: string;
  interpretation?: string | null;
}

export function SearchDebugPanel({ aiMetadata, query, interpretation }: SearchDebugPanelProps) {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<AIStats | null>(null);
  const [events, setEvents] = useState<AIEvent[]>([]);
  const [aiStatus, setAiStatus] = useState(getAIStatus());
  
  // Keyboard shortcut: Ctrl+Shift+D or Cmd+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'D' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        setVisible(v => !v);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Load stats and events when visible
  useEffect(() => {
    if (visible) {
      refreshData();
      const interval = setInterval(refreshData, 2000);
      return () => clearInterval(interval);
    }
  }, [visible]);
  
  const refreshData = async () => {
    setStats(getStats());
    setEvents(await getRecentEvents(10));
    setAiStatus(getAIStatus());
  };
  
  if (!visible) return null;
  
  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[80vh] overflow-auto z-50 shadow-2xl">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Search Debug Panel</CardTitle>
              <CardDescription className="text-xs">
                AI search diagnostics
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={refreshData}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setVisible(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 text-xs">
          {/* Current Query Status */}
          {query && (
            <div className="space-y-2">
              <h4 className="font-medium">Current Query</h4>
              <div className="bg-muted p-2 rounded text-xs font-mono">
                {query}
              </div>
              
              {aiMetadata && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Source:</span>
                    <Badge variant={aiMetadata.aiUsed ? "default" : "secondary"}>
                      {aiMetadata.source}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Confidence:</span>
                    <span className="font-medium">{(aiMetadata.confidence * 100).toFixed(0)}%</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Latency:</span>
                    <span className="font-medium">{aiMetadata.latencyMs}ms</span>
                  </div>
                  
                  {aiMetadata.fallbackReason && (
                    <div className="text-xs text-orange-600 mt-1">
                      Fallback: {aiMetadata.fallbackReason}
                    </div>
                  )}
                </div>
              )}
              
              {interpretation && (
                <div className="text-xs text-muted-foreground italic">
                  "{interpretation}"
                </div>
              )}
            </div>
          )}
          
          <Separator />
          
          {/* AI Status */}
          <div className="space-y-2">
            <h4 className="font-medium">AI Status</h4>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Available:</span>
                <Badge variant={aiStatus.available ? "default" : "secondary"}>
                  {aiStatus.available ? 'Yes' : 'No'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Query Parsing:</span>
                <Badge variant={aiStatus.queryParsingEnabled ? "default" : "secondary"}>
                  {aiStatus.queryParsingEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Semantic Ranking:</span>
                <Badge variant={aiStatus.semanticRankingEnabled ? "default" : "secondary"}>
                  {aiStatus.semanticRankingEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              
              {aiStatus.circuitBreakerTripped && (
                <div className="text-xs text-red-600 font-medium">
                  ⚠️ Circuit breaker tripped
                </div>
              )}
              
              <div className="text-xs text-muted-foreground">
                Platform: {aiStatus.platform}
              </div>
            </div>
          </div>
          
          <Separator />
          
          {/* Statistics */}
          {stats && (
            <div className="space-y-2">
              <h4 className="font-medium">Session Statistics</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-muted-foreground">Total Queries</div>
                  <div className="font-medium">{stats.totalQueries}</div>
                </div>
                
                <div>
                  <div className="text-muted-foreground">AI Enhanced</div>
                  <div className="font-medium">{stats.aiEnhancedQueries}</div>
                </div>
                
                <div>
                  <div className="text-muted-foreground">Success Rate</div>
                  <div className="font-medium">
                    {stats.totalQueries > 0 
                      ? `${((stats.successCount / stats.totalQueries) * 100).toFixed(0)}%`
                      : 'N/A'}
                  </div>
                </div>
                
                <div>
                  <div className="text-muted-foreground">Avg Latency</div>
                  <div className="font-medium">{stats.avgLatencyMs.toFixed(0)}ms</div>
                </div>
              </div>
              
              {stats.consecutiveFailures > 0 && (
                <div className="text-xs text-orange-600">
                  {stats.consecutiveFailures} consecutive failures
                </div>
              )}
            </div>
          )}
          
          <Separator />
          
          {/* Recent Events */}
          <div className="space-y-2">
            <h4 className="font-medium">Recent Events</h4>
            <div className="space-y-1 max-h-40 overflow-auto">
              {events.length === 0 ? (
                <div className="text-muted-foreground text-xs">No events yet</div>
              ) : (
                events.map((event, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Badge 
                      variant={event.type === 'success' ? 'default' : event.type === 'failure' ? 'destructive' : 'secondary'}
                      className="text-[10px] px-1"
                    >
                      {event.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      {event.query && (
                        <div className="truncate text-muted-foreground">
                          {event.query}
                        </div>
                      )}
                      {event.latencyMs && (
                        <span className="text-muted-foreground">{event.latencyMs}ms</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Console Commands */}
          <div className="text-xs text-muted-foreground">
            <div className="font-medium mb-1">Console Commands:</div>
            <code className="block bg-muted p-1 rounded">
              __aiDiagnostics.printStats()
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
