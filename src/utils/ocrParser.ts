/**
 * OCR output parser utilities
 * Parses Tesseract TSV output to extract structured information
 */

export interface OCRWord {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  blockNum: number;
  parNum: number;
  lineNum: number;
  wordNum: number;
}

export interface OCRLine {
  words: OCRWord[];
  text: string;
  confidence: number;
  y: number; // Average Y position
}

export interface OCRStructure {
  words: OCRWord[];
  lines: OCRLine[];
  blocks: OCRLine[][]; // Lines grouped by block
  rawText: string;
}

/**
 * Parse Tesseract TSV output
 * TSV format: level page_num block_num par_num line_num word_num left top width height conf text
 */
export function parseTSVOutput(tsvData: string): OCRStructure {
  const lines = tsvData.split("\n").filter((line) => line.trim());
  const words: OCRWord[] = [];
  
  // Skip header line (if present)
  let startIndex = 0;
  if (lines.length > 0 && lines[0].includes("level")) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split("\t");
    if (parts.length < 12) continue;

    const level = parseInt(parts[0], 10);
    // Only process word-level entries (level 5)
    if (level !== 5) continue;

    const blockNum = parseInt(parts[2], 10) || 0;
    const parNum = parseInt(parts[3], 10) || 0;
    const lineNum = parseInt(parts[4], 10) || 0;
    const wordNum = parseInt(parts[5], 10) || 0;
    const left = parseInt(parts[6], 10) || 0;
    const top = parseInt(parts[7], 10) || 0;
    const width = parseInt(parts[8], 10) || 0;
    const height = parseInt(parts[9], 10) || 0;
    const conf = parseFloat(parts[10]) || 0;
    const text = (parts[11] || "").trim();

    // Filter out low-confidence words and empty text
    if (text && conf > 0) {
      words.push({
        text,
        confidence: conf,
        x: left,
        y: top,
        width,
        height,
        blockNum,
        parNum,
        lineNum,
        wordNum,
      });
    }
  }

  // Group words into lines based on Y-coordinate proximity
  const ocrLines = groupWordsIntoLines(words);
  
  // Group lines into blocks based on block numbers and proximity
  const blocks = groupLinesIntoBlocks(ocrLines);

  // Extract raw text
  const rawText = words
    .filter((w) => w.confidence >= 60) // Only include words with decent confidence
    .map((w) => w.text)
    .join(" ");

  return {
    words,
    lines: ocrLines,
    blocks,
    rawText,
  };
}

/**
 * Group words into lines based on Y-coordinate proximity
 */
function groupWordsIntoLines(words: OCRWord[]): OCRLine[] {
  if (words.length === 0) return [];

  // Sort words by Y coordinate, then by X coordinate
  const sortedWords = [...words].sort((a, b) => {
    if (Math.abs(a.y - b.y) < 10) {
      // Same line, sort by X
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  const lines: OCRLine[] = [];
  let currentLine: OCRWord[] = [];
  let currentY = sortedWords[0]?.y ?? 0;

  for (const word of sortedWords) {
    // If Y coordinate is significantly different, start new line
    if (Math.abs(word.y - currentY) > 15) {
      if (currentLine.length > 0) {
        lines.push(createOCRLine(currentLine));
      }
      currentLine = [word];
      currentY = word.y;
    } else {
      currentLine.push(word);
      // Update average Y for current line
      currentY = (currentY + word.y) / 2;
    }
  }

  // Add last line
  if (currentLine.length > 0) {
    lines.push(createOCRLine(currentLine));
  }

  return lines;
}

/**
 * Create OCRLine from words
 */
function createOCRLine(words: OCRWord[]): OCRLine {
  const text = words.map((w) => w.text).join(" ");
  const avgConfidence =
    words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
  const avgY = words.reduce((sum, w) => sum + w.y, 0) / words.length;

  return {
    words,
    text,
    confidence: avgConfidence,
    y: avgY,
  };
}

/**
 * Group lines into blocks (paragraphs/regions)
 */
function groupLinesIntoBlocks(lines: OCRLine[]): OCRLine[][] {
  if (lines.length === 0) return [];

  // Group by block numbers if available, otherwise by Y-coordinate gaps
  const blocks: OCRLine[][] = [];
  const blockMap = new Map<number, OCRLine[]>();

  for (const line of lines) {
    if (line.words.length > 0) {
      const blockNum = line.words[0].blockNum;
      if (!blockMap.has(blockNum)) {
        blockMap.set(blockNum, []);
      }
      blockMap.get(blockNum)!.push(line);
    }
  }

  // If we have block numbers, use them; otherwise group by Y gaps
  if (blockMap.size > 1) {
    return Array.from(blockMap.values());
  }

  // Fallback: group by significant Y-coordinate gaps
  const sortedLines = [...lines].sort((a, b) => a.y - b.y);
  const result: OCRLine[][] = [];
  let currentBlock: OCRLine[] = [];
  let prevY = sortedLines[0]?.y ?? 0;

  for (const line of sortedLines) {
    // If gap is more than 1.5x average line height, start new block
    const avgHeight =
      line.words.reduce((sum, w) => sum + w.height, 0) / line.words.length;
    if (line.y - prevY > avgHeight * 1.5 && currentBlock.length > 0) {
      result.push(currentBlock);
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
    prevY = line.y;
  }

  if (currentBlock.length > 0) {
    result.push(currentBlock);
  }

  return result.length > 0 ? result : [lines];
}

/**
 * Extract text regions based on Y position
 * Returns top, middle, bottom regions
 */
export function extractTextRegions(
  structure: OCRStructure
): {
  top: OCRLine[];
  middle: OCRLine[];
  bottom: OCRLine[];
} {
  const lines = structure.lines;
  if (lines.length === 0) {
    return { top: [], middle: [], bottom: [] };
  }

  // Sort by Y position
  const sortedLines = [...lines].sort((a, b) => a.y - b.y);
  const totalLines = sortedLines.length;

  // Define regions (approximately top 1/3, middle 1/3, bottom 1/3)
  const topEnd = Math.ceil(totalLines / 3);
  const middleEnd = Math.ceil((totalLines * 2) / 3);

  return {
    top: sortedLines.slice(0, topEnd),
    middle: sortedLines.slice(topEnd, middleEnd),
    bottom: sortedLines.slice(middleEnd),
  };
}

