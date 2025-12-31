import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input } = await req.json();
    
    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Input text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Parsing contact input:", input.substring(0, 100));

    const systemPrompt = `You are a contact information parser. Extract structured contact details from the given text.
    
Return a JSON object with these fields (use null for fields that cannot be determined):
- name: string (required - the person's full name)
- email: string | null (email address)
- phone: string | null (phone number)
- company: string | null (company/organization name)
- role: string | null (job title/position)
- description: string | null (any additional context about what they do or how you know them)
- suggestedKeywords: string[] (3-5 relevant searchable keywords extracted from the role, company, and description)

Be intelligent about parsing:
- "John Smith john@acme.com Marketing Manager at Acme Inc" → name: "John Smith", email: "john@acme.com", role: "Marketing Manager", company: "Acme Inc"
- "Sarah - handles our PR" → name: "Sarah", description: "handles our PR", suggestedKeywords: ["pr", "communications"]
- Phone formats: +1 (555) 123-4567, 555-123-4567, etc.

Always return valid JSON, nothing else.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    console.log("AI response:", content);

    // Parse the JSON from the response
    let parsed;
    try {
      // Clean up the response - remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleanContent);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", e);
      // Fallback: just use the name from the input
      parsed = {
        name: input.split(/[\s,@]/)[0] || input,
        email: null,
        phone: null,
        company: null,
        role: null,
        description: null,
        suggestedKeywords: []
      };
    }

    // Ensure required fields
    if (!parsed.name) {
      parsed.name = input.split(/[\s,@]/)[0] || input;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        parsed 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in parse-contact-input");
    return new Response(
      JSON.stringify({ error: "Failed to parse contact information" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
