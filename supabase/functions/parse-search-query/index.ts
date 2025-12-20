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

    const systemPrompt = `You are an intelligent search assistant for a contacts directory. Analyze the user's query and find the BEST matching contacts.

CONTACTS DATABASE:
${contactContext}

YOUR TASK:
1. Understand what the user is looking for (role, skill, department, responsibility, etc.)
2. Match against ALL contact fields: name, role, company, description, and tags
3. Use semantic understanding - "art decisions" matches "Art Director", "handles HR" matches "HR Manager"
4. Include related/synonymous terms when matching

RESPOND WITH ONLY THIS JSON (no markdown, no extra text):
{
  "isQuestion": true,
  "intent": "brief description of what user seeks",
  "keywords": ["primary_keyword", "related_term1", "related_term2"],
  "matchingContactNames": ["Exact Name 1", "Exact Name 2"],
  "confidence": "high|medium|low"
}

MATCHING RULES:
- If query asks about a DEPARTMENT/FUNCTION (HR, marketing, art, engineering), match people in that area
- If query asks about DECISIONS/AUTHORITY, look for managers, directors, leads, or descriptions mentioning authority
- Match partial terms: "art" matches "Art Director", "Artist", "Art Department"
- Use descriptions carefully - they often contain the most relevant context
- Return empty matchingContactNames array if no good matches exist
- Always return the EXACT name as it appears in the database`;

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
