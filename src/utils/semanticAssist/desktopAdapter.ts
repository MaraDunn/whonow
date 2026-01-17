/**
 * Desktop Semantic Assist Adapter
 * Uses local LLM (Ollama/llama.cpp) for semantic enhancement
 * Strict JSON schema validation, confidence gating
 */

import { SearchQuery } from "@/types/searchQuery";

let ollamaAvailable: boolean | null = null;
let ollamaCheckPromise: Promise<boolean> | null = null;

/**
 * Check if Ollama is available
 */
async function checkOllamaAvailable(): Promise<boolean> {
  if (ollamaAvailable !== null) return ollamaAvailable;
  if (ollamaCheckPromise) return ollamaCheckPromise;

  ollamaCheckPromise = (async () => {
    try {
      // Check if Ollama is running locally
      const response = await fetch("http://localhost:11434/api/tags", {
        method: "GET",
        signal: AbortSignal.timeout(1000), // 1 second timeout
      });

      if (response.ok) {
        ollamaAvailable = true;
        return true;
      }
    } catch (error) {
      // Ollama not available or not running
      ollamaAvailable = false;
      return false;
    } finally {
      ollamaCheckPromise = null;
    }

    ollamaAvailable = false;
    return false;
  })();

  return ollamaCheckPromise;
}

/**
 * Call local LLM with strict JSON schema constraint
 */
async function callLocalLLM(
  query: string,
  deterministicQuery: SearchQuery
): Promise<SearchQuery | null> {
  try {
    const isAvailable = await checkOllamaAvailable();
    if (!isAvailable) {
      return null; // Ollama not available
    }

    // Prepare prompt with strict JSON schema requirement
    const prompt = `You are a search query parser. Parse the following natural language query into a structured search query.

Original query: "${query}"

Deterministic parse result:
${JSON.stringify(deterministicQuery, null, 2)}

Your task:
1. Refine the query understanding if needed
2. Fill in missing fields ONLY if you're confident
3. NEVER override fields that are already set in the deterministic parse
4. Return ONLY valid JSON matching this exact schema:
{
  "intent": "search_contacts" | "list_recent" | "relationship_lookup",
  "filters": {
    "name": string (optional),
    "company": string (optional),
    "job_title": string (optional),
    "introduced_by": string (optional),
    "relationship_type": "met" | "worked_with" | "client" | "vendor" (optional),
    "date_range": { "from": "ISO date", "to": "ISO date" } (optional),
    "location": string (optional),
    "tags": string[] (optional)
  },
  "semantic_hint": string (optional, for ranking only),
  "confidence": number (0.0-1.0),
  "explanation": string
}

Return ONLY the JSON object, no other text.`;

    // Call Ollama API
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "phi3:mini", // Use small model (3B) - adjust based on available models
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for deterministic output
          top_p: 0.9,
        },
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const responseText = data.response || "";

    // Extract JSON from response (handle cases where LLM adds extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate schema
    if (!validateSearchQuery(parsed)) {
      return null;
    }

    // Ensure confidence is valid
    if (parsed.confidence < 0 || parsed.confidence > 1) {
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
    }

    return parsed as SearchQuery;
  } catch (error) {
    console.warn("Local LLM call failed:", error);
    return null;
  }
}

/**
 * Validate SearchQuery schema
 */
function validateSearchQuery(obj: any): obj is SearchQuery {
  if (!obj || typeof obj !== "object") return false;
  if (!["search_contacts", "list_recent", "relationship_lookup"].includes(obj.intent))
    return false;
  if (!obj.filters || typeof obj.filters !== "object") return false;
  if (typeof obj.confidence !== "number" || obj.confidence < 0 || obj.confidence > 1)
    return false;
  if (typeof obj.explanation !== "string") return false;

  // Validate filters
  const filters = obj.filters;
  if (filters.name !== undefined && typeof filters.name !== "string") return false;
  if (filters.company !== undefined && typeof filters.company !== "string")
    return false;
  if (filters.job_title !== undefined && typeof filters.job_title !== "string")
    return false;
  if (filters.introduced_by !== undefined && typeof filters.introduced_by !== "string")
    return false;
  if (
    filters.relationship_type !== undefined &&
    !["met", "worked_with", "client", "vendor"].includes(filters.relationship_type)
  )
    return false;
  if (filters.date_range !== undefined) {
    if (
      !filters.date_range.from ||
      !filters.date_range.to ||
      typeof filters.date_range.from !== "string" ||
      typeof filters.date_range.to !== "string"
    )
      return false;
  }
  if (filters.location !== undefined && typeof filters.location !== "string")
    return false;
  if (filters.tags !== undefined && !Array.isArray(filters.tags)) return false;

  return true;
}

/**
 * Semantic assist for desktop platform
 * Uses local LLM to refine query understanding
 */
export async function semanticAssistDesktop(
  query: string,
  deterministicQuery: SearchQuery
): Promise<SearchQuery | null> {
  try {
    const enhanced = await callLocalLLM(query, deterministicQuery);
    if (!enhanced) {
      return null; // Fallback to deterministic
    }

    // Additional validation: ensure confidence improved or stayed same
    if (enhanced.confidence < deterministicQuery.confidence) {
      return null; // Reject if confidence decreased
    }

    return enhanced;
  } catch (error) {
    console.warn("Desktop semantic assist failed:", error);
    return null; // Fallback to deterministic
  }
}
