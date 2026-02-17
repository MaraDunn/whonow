/**
 * Shared utility for parsing contacts from PDF files.
 * Extracts text client-side using PDF.js, then parses via parse-contact-pdf edge function.
 */
import { supabase } from "@/integrations/supabase/client";
import { devLog } from "@/lib/devLog";

const PDFJS_VERSION = "3.11.174";

interface PDFJSLib {
  getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<any> };
  GlobalWorkerOptions: { workerSrc: string };
}

export interface ParsedContactFromPdf {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
}

async function loadPDFJS(): Promise<PDFJSLib> {
  if (typeof window === "undefined") {
    throw new Error("Window is not available");
  }
  const globalWindow = window as any;
  if (globalWindow.pdfjsLib && globalWindow.pdfjsLib.getDocument) {
    return globalWindow.pdfjsLib;
  }

  const unpkgUrl = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.js`;
  const workerUrl = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
  devLog("[pdfContactParser] Loading PDF.js from:", unpkgUrl);

  const script = document.createElement("script");
  script.src = unpkgUrl;
  script.async = true;
  script.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("PDF.js script load timeout")), 30000);
    script.onload = () => {
      clearTimeout(timeout);
      const pdfjsLib = globalWindow.pdfjsLib || globalWindow.pdfjs || (window as any).pdfjs;
      if (pdfjsLib?.getDocument) {
        if (pdfjsLib.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        resolve();
      } else {
        reject(new Error("PDF.js library loaded but getDocument not found"));
      }
    };
    script.onerror = () => reject(new Error(`Failed to load PDF.js from ${unpkgUrl}`));
    document.head.appendChild(script);
  });

  const pdfjsLib = globalWindow.pdfjsLib || globalWindow.pdfjs || (window as any).pdfjs;
  if (!pdfjsLib?.getDocument) throw new Error("PDF.js library not available after loading");
  return pdfjsLib;
}

async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await loadPDFJS();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  devLog("[pdfContactParser] PDF loaded:", pdf.numPages, "page(s)");

  const textParts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    if (textContent.items.length === 0) continue;

    const items = textContent.items as Array<{ str: string; transform: number[]; hasEOL?: boolean; width?: number }>;
    const sortedItems = items
      .filter((item) => item.str?.trim())
      .map((item) => ({
        text: item.str.trim(),
        y: (item.transform || [])[5] || 0,
        x: (item.transform || [])[4] || 0,
        width: item.width || 0,
      }))
      .sort((a, b) => {
        const yTolerance = 3;
        if (Math.abs(a.y - b.y) > yTolerance) return b.y - a.y;
        return a.x - b.x;
      });

    const itemsByLine = new Map<number, Array<{ text: string; x: number; width?: number }>>();
    for (const item of sortedItems) {
      const yTolerance = 3;
      let lineY: number | null = null;
      for (const y of itemsByLine.keys()) {
        if (Math.abs(item.y - y) <= yTolerance) {
          lineY = y;
          break;
        }
      }
      if (lineY === null) lineY = item.y;
      if (!itemsByLine.has(lineY)) itemsByLine.set(lineY, []);
      itemsByLine.get(lineY)!.push({ text: item.text, x: item.x, width: item.width });
    }

    const sampleLines = Array.from(itemsByLine.values()).slice(0, 20);
    const columnStarts = new Map<number, number>();
    for (const lineItems of sampleLines) {
      lineItems.sort((a, b) => a.x - b.x);
      for (let i = 1; i < lineItems.length; i++) {
        const prev = lineItems[i - 1];
        const curr = lineItems[i];
        const gap = curr.x - (prev.x + (prev.width || prev.text.length * 5));
        if (gap > 20) {
          const boundary = Math.round((prev.x + (prev.width || prev.text.length * 5) + curr.x) / 2);
          columnStarts.set(boundary, (columnStarts.get(boundary) || 0) + 1);
        }
      }
    }
    const threshold = Math.ceil(sampleLines.length * 0.3);
    const columnBoundaries = Array.from(columnStarts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([b]) => b)
      .sort((a, b) => a - b);

    const lines: string[] = [];
    let currentLine: Array<{ text: string; x: number; width?: number }> = [];
    let currentY: number | null = null;

    const flushLine = (lineItems: Array<{ text: string; x: number; width?: number }>) => {
      lineItems.sort((a, b) => a.x - b.x);
      let lineText = "";
      let lastColumnEnd = 0;
      for (let i = 0; i < lineItems.length; i++) {
        const curr = lineItems[i];
        const next = lineItems[i + 1];
        if (columnBoundaries.length > 0) {
          const itemEnd = curr.x + (curr.width || curr.text.length * 5);
          const crossedBoundary = columnBoundaries.some((b) => curr.x > b && lastColumnEnd < b);
          if (crossedBoundary && lineText.length > 0) lineText += "  ";
          lastColumnEnd = itemEnd;
        }
        lineText += curr.text;
        if (next) {
          const gap = next.x - (curr.x + (curr.width || curr.text.length * 5));
          if (gap > 10) lineText += gap > 20 && columnBoundaries.length > 0 ? "  " : " ";
          else if (curr.text && next.text && /[a-z0-9]/.test(curr.text.slice(-1)) && /[A-Z]/.test(next.text[0])) lineText += " ";
        }
      }
      lineText = lineText.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([a-zA-Z])([:(])/g, "$1 $2").replace(/([:(])([a-zA-Z])/g, "$1 $2");
      const trimmed = lineText.trim();
      if (trimmed) lines.push(trimmed);
    };

    for (const item of sortedItems) {
      const yTolerance = 3;
      if (currentY === null || Math.abs(item.y - currentY) > yTolerance) {
        if (currentLine.length > 0) {
          flushLine(currentLine);
        }
        currentLine = [{ text: item.text, x: item.x, width: item.width }];
        currentY = item.y;
      } else {
        currentLine.push({ text: item.text, x: item.x, width: item.width });
      }
    }
    if (currentLine.length > 0) flushLine(currentLine);

    let pageText = lines.join("\n");
    if (pageText.length < 50 && textContent.items.length > 10) {
      const simpleText = textContent.items
        .map((item: { str?: string }) => item.str || "")
        .filter((s: string) => s.trim())
        .join(" ");
      if (simpleText.length > pageText.length) pageText = simpleText;
    }
    if (pageText) textParts.push(pageText);
  }

  const extractedText = textParts.join("\n\n");
  if (!extractedText?.trim()) {
    throw new Error("No text could be extracted from the PDF. The PDF might be image-based (scanned).");
  }
  return extractedText;
}

/**
 * Parse a PDF file and return contacts. Uses client-side PDF.js for text extraction,
 * then the parse-contact-pdf edge function for contact parsing.
 */
export async function parsePdfFile(file: File): Promise<ParsedContactFromPdf[]> {
  if (file.type !== "application/pdf") {
    throw new Error("File must be a PDF");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File size must be less than 10MB");
  }

  const arrayBuffer = await file.arrayBuffer();
  const extractedText = await extractTextFromPdf(arrayBuffer);
  devLog("[pdfContactParser] Extracted text length:", extractedText.length);

  const { data, error: fnError } = await supabase.functions.invoke("parse-contact-pdf", {
    body: { extractedText, mimeType: file.type },
  });

  if (fnError) throw new Error(fnError.message || "Failed to parse document");
  if (!data?.success) throw new Error(data?.error || "Failed to parse contacts");
  if (!data.contacts?.length) throw new Error("No valid contacts found in the file.");

  return data.contacts.map(
    (c: { name: string; email?: string; phone?: string; company?: string; role?: string }) => ({
      name: c.name || "",
      email: c.email || "",
      phone: c.phone || "",
      company: c.company || "",
      role: c.role || "",
    })
  );
}
