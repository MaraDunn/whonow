import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, contacts } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build context from contacts for better matching
    const contactContext = contacts?.map((c: any, i: number) => 
      `[${i + 1}] ${c.name} | Role: ${c.role || 'N/A'} | Company: ${c.company || 'N/A'} | Description: ${c.description || 'N/A'} | Tags: ${c.tags?.join(', ') || 'none'}`
    ).join('\n') || '';

    const systemPrompt = `You are a PRECISE search assistant for a contacts directory. Your job is to find ONLY contacts that DIRECTLY match the user's query.

CONTACTS DATABASE:
${contactContext}

CRITICAL MATCHING RULES:
1. **STRICT COMPANY MATCHING**: If a company name is mentioned, ONLY return contacts who work at that EXACT company. "Precision Manufacturing" means ONLY contacts where Company = "Precision Manufacturing".

2. **STRICT ROLE/FUNCTION MATCHING**: If a role or function is mentioned (sales, HR, engineering, contracts), ONLY return contacts whose Role or Description EXPLICITLY mentions that function.

3. **NO ASSUMPTIONS**: Do NOT assume someone handles something unless their Role or Description explicitly says so. A "Sales Manager" handles sales. A "Software Engineer" does NOT handle sales contracts.

4. **FEWER IS BETTER**: Return MAXIMUM 10 contacts. If unsure, return FEWER matches with high confidence rather than many loose matches.

5. **VERIFY EACH MATCH**: Before including a contact, verify:
   - Does their company MATCH if a company was specified?
   - Does their role/description ACTUALLY mention the requested function?

6. **EMPTY IS OK**: If no contacts clearly match, return an empty array. This is better than returning wrong matches.

RESPOND WITH ONLY THIS JSON (no markdown, no extra text):
{
  "isQuestion": true,
  "intent": "brief description of what user seeks",
  "keywords": ["only_the_most_specific_terms"],
  "matchingContactNames": ["Exact Name 1", "Exact Name 2"],
  "confidence": "high|medium|low",
  "companyFilter": "exact company name if mentioned, or null",
  "roleFilter": "exact role/function if mentioned, or null"
}

EXAMPLES:
- "who handles sales contracts at Precision Manufacturing" → ONLY contacts at Precision Manufacturing with sales/contracts in their role/description
- "who makes art decisions" → ONLY contacts with Art Director, Creative Director, or similar in their role
- "HR contacts" → ONLY contacts with HR in their role/description

Return EXACT names as they appear in the database. Maximum 10 matches.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', content);

    // Parse the JSON response
    let parsed;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Return a fallback that treats it as a regular search
      parsed = {
        isQuestion: false,
        intent: '',
        keywords: query.toLowerCase().split(' ').filter(Boolean),
        matchingContactNames: []
      };
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-search-query:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
