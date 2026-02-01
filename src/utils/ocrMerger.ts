/**
 * Intelligent OCR result merging
 * Combines multiple OCR attempts to produce the most accurate result
 */

import { type OCRStructure } from "./ocrParser";
import { devLog } from "@/lib/devLog";

export interface OCRAttempt {
  text: string;
  structure?: OCRStructure;
  confidence: number;
  variantName: string;
}

export interface MergedOCRResult {
  text: string;
  structure?: OCRStructure;
  confidence: number;
  sourcesUsed: string[];
}

/**
 * Merge multiple OCR attempts using confidence voting and spell-checking
 */
export function mergeOCRResults(attempts: OCRAttempt[]): MergedOCRResult {
  if (attempts.length === 0) {
    return {
      text: "",
      structure: undefined,
      confidence: 0,
      sourcesUsed: [],
    };
  }

  if (attempts.length === 1) {
    return {
      text: attempts[0].text,
      structure: attempts[0].structure,
      confidence: attempts[0].confidence,
      sourcesUsed: [attempts[0].variantName],
    };
  }

  devLog("=== Merging OCR results from", attempts.length, "attempts ===");
  
  // CRITICAL FIX: Filter out low-quality attempts before merging
  // Reject attempts with very low confidence or suspiciously long text (likely garbage)
  const avgTextLength = attempts.reduce((sum, a) => sum + a.text.length, 0) / attempts.length;
  const maxReasonableLength = avgTextLength * 3; // 3x average is reasonable
  
  const qualityAttempts = attempts.filter(attempt => {
    // Reject if confidence is too low (likely garbage)
    if (attempt.confidence < 15) {
      devLog(`Filtering out ${attempt.variantName}: confidence too low (${attempt.confidence.toFixed(1)}%)`);
      return false;
    }
    
    // Reject if text is suspiciously long (likely extracting background noise)
    if (attempt.text.length > maxReasonableLength && attempt.text.length > 200) {
      devLog(`Filtering out ${attempt.variantName}: text too long (${attempt.text.length} chars, avg: ${avgTextLength.toFixed(0)})`);
      return false;
    }
    
    // Reject if text is too short (likely failed)
    if (attempt.text.length < 10) {
      devLog(`Filtering out ${attempt.variantName}: text too short (${attempt.text.length} chars)`);
      return false;
    }
    
    return true;
  });
  
  if (qualityAttempts.length === 0) {
    console.warn("All attempts filtered out - using best attempt anyway");
    // Use the best attempt even if quality is low
    const best = [...attempts].sort((a, b) => b.confidence - a.confidence)[0];
    return {
      text: best.text,
      structure: best.structure,
      confidence: best.confidence,
      sourcesUsed: [best.variantName],
    };
  }
  
  devLog(`Using ${qualityAttempts.length}/${attempts.length} quality attempts for merging`);

  // Extract all lines from all attempts (using filtered quality attempts)
  const allLines: Array<{
    text: string;
    confidence: number;
    y: number;
    source: string;
  }> = [];

  for (const attempt of qualityAttempts) {
    if (attempt.structure?.lines) {
      for (const line of attempt.structure.lines) {
        allLines.push({
          text: line.text,
          confidence: line.confidence,
          y: line.y,
          source: attempt.variantName,
        });
      }
    } else {
      // No structure, split by lines
      const lines = attempt.text.split("\n");
      lines.forEach((text, idx) => {
        if (text.trim()) {
          allLines.push({
            text: text.trim(),
            confidence: attempt.confidence,
            y: idx * 30,
            source: attempt.variantName,
          });
        }
      });
    }
  }

  // Group lines by position (Y-coordinate)
  const lineGroups = groupLinesByPosition(allLines);

  devLog("Grouped into", lineGroups.length, "line positions");

  // For each position, pick the best line using confidence voting
  const mergedLines: Array<{ text: string; confidence: number; y: number; sources: string[] }> = [];

  for (const group of lineGroups) {
    const best = selectBestLine(group);
    mergedLines.push(best);
  }

  // Sort by Y position
  mergedLines.sort((a, b) => a.y - b.y);

  // Combine into final text
  const finalText = mergedLines.map(l => l.text).join("\n");
  
  // FIX: Calculate average confidence correctly (was summing instead of averaging)
  const totalConfidence = mergedLines.reduce((sum, l) => sum + l.confidence, 0);
  const avgConfidence = mergedLines.length > 0 ? totalConfidence / mergedLines.length : 0;
  
  const sourcesUsed = [...new Set(mergedLines.flatMap(l => l.sources))];

  devLog("Merged result:", {
    lines: mergedLines.length,
    avgConfidence: avgConfidence.toFixed(1),
    sources: sourcesUsed,
    textLength: finalText.length,
  });
  
  // DEBUG: Log the actual merged text
  devLog("Final merged text:", finalText);

  // Reconstruct structure
  const structure: OCRStructure = {
    words: [], // We don't have word-level data after merging
    lines: mergedLines.map(l => ({
      text: l.text,
      confidence: l.confidence,
      y: l.y,
      x: 0,
      width: 100,
      words: [],
    })),
    blocks: [mergedLines.map(l => ({
      text: l.text,
      confidence: l.confidence,
      y: l.y,
      x: 0,
      width: 100,
      words: [],
    }))],
    rawText: finalText,
  };

  return {
    text: finalText,
    structure,
    confidence: avgConfidence,
    sourcesUsed,
  };
}

/**
 * Group lines by Y-coordinate (same visual position)
 */
function groupLinesByPosition(
  lines: Array<{ text: string; confidence: number; y: number; source: string }>
): Array<Array<{ text: string; confidence: number; y: number; source: string }>> {
  if (lines.length === 0) return [];

  // Sort by Y
  const sorted = [...lines].sort((a, b) => a.y - b.y);

  const groups: Array<Array<{ text: string; confidence: number; y: number; source: string }>> = [];
  let currentGroup: Array<{ text: string; confidence: number; y: number; source: string }> = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const line = sorted[i];
    
    // If Y is within 25px, consider it the same line
    if (Math.abs(line.y - currentY) < 25) {
      currentGroup.push(line);
    } else {
      groups.push(currentGroup);
      currentGroup = [line];
      currentY = line.y;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Select best line from a group using confidence voting and similarity
 */
function selectBestLine(
  group: Array<{ text: string; confidence: number; y: number; source: string }>
): { text: string; confidence: number; y: number; sources: string[] } {
  if (group.length === 1) {
    return {
      text: group[0].text,
      confidence: group[0].confidence,
      y: group[0].y,
      sources: [group[0].source],
    };
  }

  // Calculate similarity scores between all pairs
  const candidates = group.map(line => {
    let score = line.confidence;
    
    // Boost score if other lines are similar (voting mechanism)
    for (const other of group) {
      if (other !== line) {
        const similarity = calculateSimilarity(line.text, other.text);
        score += similarity * other.confidence * 0.5; // Weight by other's confidence
      }
    }

    return {
      line,
      score,
    };
  });

  // Sort by score
  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0].line;
  const avgY = group.reduce((sum, l) => sum + l.y, 0) / group.length;
  const sources = group.map(l => l.source);

  // Try to improve the best line by borrowing good parts from others
  const improved = improveLineWithVoting(group);

  // Normalize and cap confidence at 100%
  const normalizedConfidence = Math.min(100, candidates[0].score / group.length);
  
  return {
    text: improved.text,
    confidence: normalizedConfidence,
    y: avgY,
    sources,
  };
}

/**
 * Improve a line by voting on each word/character from multiple sources
 */
function improveLineWithVoting(
  group: Array<{ text: string; confidence: number; y: number; source: string }>
): { text: string } {
  if (group.length === 1) {
    return { text: group[0].text };
  }

  // Split each line into words
  const wordLists = group.map(line => ({
    words: line.text.split(/\s+/).filter(w => w.length > 0),
    confidence: line.confidence,
  }));

  // Find the longest word list
  const maxWords = Math.max(...wordLists.map(wl => wl.words.length));

  // Vote on each word position
  const finalWords: string[] = [];

  for (let i = 0; i < maxWords; i++) {
    const wordsAtPosition = wordLists
      .filter(wl => i < wl.words.length)
      .map(wl => ({
        word: wl.words[i],
        confidence: wl.confidence,
      }));

    if (wordsAtPosition.length === 0) continue;

    // Pick word with highest confidence, or most common if tied
    const bestWord = selectBestWord(wordsAtPosition);
    finalWords.push(bestWord);
  }

  return { text: finalWords.join(" ") };
}

/**
 * Select best word from candidates using confidence and frequency
 */
function selectBestWord(
  candidates: Array<{ word: string; confidence: number }>
): string {
  if (candidates.length === 1) return candidates[0].word;

  // Group by word (normalized)
  const wordGroups = new Map<string, { word: string; totalConfidence: number; count: number }>();

  for (const candidate of candidates) {
    const normalized = candidate.word.toLowerCase().trim();
    const existing = wordGroups.get(normalized);
    
    if (existing) {
      existing.totalConfidence += candidate.confidence;
      existing.count++;
      // Keep the version with better casing/formatting
      if (candidate.word.length > existing.word.length || 
          (candidate.word.length === existing.word.length && candidate.confidence > existing.totalConfidence / existing.count)) {
        existing.word = candidate.word;
      }
    } else {
      wordGroups.set(normalized, {
        word: candidate.word,
        totalConfidence: candidate.confidence,
        count: 1,
      });
    }
  }

  // Pick word with highest total confidence
  let bestWord = candidates[0].word;
  let bestScore = 0;

  for (const [_, group] of wordGroups) {
    const score = group.totalConfidence * group.count; // Weight by frequency
    if (score > bestScore) {
      bestScore = score;
      bestWord = group.word;
    }
  }

  return bestWord;
}

/**
 * Calculate text similarity (0-100)
 */
function calculateSimilarity(text1: string, text2: string): number {
  const s1 = text1.toLowerCase().trim();
  const s2 = text2.toLowerCase().trim();

  if (s1 === s2) return 100;

  // Levenshtein distance
  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  
  if (maxLen === 0) return 100;

  const similarity = (1 - distance / maxLen) * 100;
  return Math.max(0, Math.min(100, similarity));
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

