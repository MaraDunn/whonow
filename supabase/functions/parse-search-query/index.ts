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

    const systemPrompt = `You are a PRECISE search assistant for a contacts directory. Your job is to find ONLY the most accurate matches.

CONTACTS DATABASE:
${contactContext}

CRITICAL RULES - FOLLOW EXACTLY:
1. MAXIMUM 5 contacts per query - NEVER return more than 5
2. ONLY return contacts where the search criteria is EXPLICITLY visible in their data
3. If a COMPANY NAME is mentioned, contacts MUST be from that EXACT company - no exceptions
4. If a ROLE/FUNCTION is mentioned, the contact MUST have that exact role or function in their role/description
5. Prefer 1-3 HIGHLY accurate matches over 5 loosely related ones
6. When confidence is low, return EMPTY matchingContactNames array - do NOT guess
7. NEVER match based on tangential or weak relationships

VALIDATION BEFORE INCLUDING A CONTACT:
- Company query? → Verify contact.company MATCHES the company name
- Role query? → Verify contact.role or contact.description CONTAINS the role
- Function query (HR, Sales, etc.)? → Verify role/description EXPLICITLY mentions that function
- If you cannot find explicit evidence, DO NOT include the contact

RESPOND WITH ONLY THIS JSON (no markdown, no extra text):
{
  "isQuestion": true,
  "intent": "brief description of what user seeks",
  "keywords": ["exact_keyword_from_query"],
  "matchingContactNames": ["Exact Name 1", "Exact Name 2"],
  "confidence": "high|medium|low"
}

CONFIDENCE LEVELS:
- "high": All returned contacts have EXPLICIT matches to the query criteria
- "medium": Most contacts have clear matches, some have strong implied matches
- "low": Matches are uncertain or based on weak associations - USE EMPTY ARRAY INSTEAD

Always return the EXACT name as it appears in the database.`;

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
