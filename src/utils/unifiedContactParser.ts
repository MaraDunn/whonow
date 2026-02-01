/**
 * Unified Contact Parser
 * Tries LLM parsing first, falls back to deterministic parsing
 * Provides the best of both worlds: intelligent extraction with reliable fallback
 */

import { ParsedContactData } from "./contactTextParser";
import { parseContactText } from "./contactTextParser";
import { parseContactWithLLM } from "./contactLLMParser";
import { devLog } from "@/lib/devLog";

/**
 * Parse contact text with LLM-first approach
 * Tries LLM parsing first, falls back to deterministic if LLM fails or is unavailable
 * 
 * @param input - Freeform text input containing contact information
 * @returns Parsed contact data
 */
export async function parseContactUnified(
  input: string
): Promise<ParsedContactData> {
  const trimmedInput = input.trim();
  
  if (!trimmedInput) {
    return {
      name: "",
      email: null,
      phone: null,
      company: null,
      role: null,
      description: null,
      suggestedKeywords: [],
    };
  }

  try {
    // Try LLM parsing first
    const llmResult = await parseContactWithLLM(trimmedInput);
    
    if (llmResult) {
      devLog("[Unified Contact Parser] ✓ Using LLM parsing result");
      return llmResult;
    }
  } catch (error) {
    console.warn("[Unified Contact Parser] LLM parsing failed, falling back to deterministic:", error);
  }

  // Fallback to deterministic parsing
  // This is expected in many browser environments due to CORS/network restrictions
  // The deterministic parser works well for most contact formats
  devLog("[Unified Contact Parser] Using deterministic parsing (LLM not available)");
  return parseContactText(trimmedInput);
}
