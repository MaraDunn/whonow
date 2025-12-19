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
    const contactContext = contacts?.map((c: any) => 
      `${c.name} (${c.role} at ${c.company}): ${c.description || ''} - Tags: ${c.tags?.join(', ') || 'none'}`
    ).join('\n') || '';

    const systemPrompt = `You are a search query interpreter for a contacts app. Your job is to understand natural language questions and extract:
1. The intent (what the user is looking for)
2. Keywords to match against contact names, roles, companies, descriptions, and tags

Available contacts:
${contactContext}

Respond with JSON only, no other text. Format:
{
  "isQuestion": true/false,
  "intent": "brief description of what user is looking for",
  "keywords": ["keyword1", "keyword2"],
  "matchingContactNames": ["name1", "name2"] // Names of contacts that match the query
}

Examples:
- "Who handles marketing?" → {"isQuestion": true, "intent": "find marketing contact", "keywords": ["marketing"], "matchingContactNames": ["Sarah Johnson"]}
- "Find someone for React" → {"isQuestion": true, "intent": "find React developer", "keywords": ["react", "frontend", "developer"], "matchingContactNames": ["Michael Chen"]}
- "Who can help with design?" → {"isQuestion": true, "intent": "find designer", "keywords": ["design", "ui", "ux"], "matchingContactNames": ["Emily Davis"]}`;

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
