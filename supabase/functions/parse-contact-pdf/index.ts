import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, mimeType } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'No PDF data provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing contact PDF with AI...');

    const systemPrompt = `You are a contact extraction expert. Your task is to extract contact information from the provided document image.

Extract ALL contacts/people you can find in the document. For each contact, extract:
- name (required): The person's full name
- email: Email address if available
- phone: Phone number if available
- company: Company/organization name if available
- role: Job title or role if available

Return a JSON array of contacts. Each contact should have this structure:
{
  "name": "string (required)",
  "email": "string or null",
  "phone": "string or null", 
  "company": "string or null",
  "role": "string or null"
}

Important:
- Extract EVERY contact you can find in the document
- If a field is not available, set it to null
- Clean and format phone numbers consistently
- Make sure names are properly capitalized
- Only return the JSON array, no additional text or markdown`;

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
          { 
            role: 'user', 
            content: [
              {
                type: 'text',
                text: 'Please extract all contacts from this document. Return only a JSON array of contacts.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'application/pdf'};base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI usage limit reached. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log('AI response content:', content);

    // Parse the JSON response
    let contacts = [];
    try {
      // Try to extract JSON from the response (may be wrapped in markdown code blocks)
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      
      contacts = JSON.parse(jsonStr);
      
      // Validate and clean the contacts
      if (!Array.isArray(contacts)) {
        contacts = [contacts];
      }
      
      contacts = contacts.filter(c => c && c.name && typeof c.name === 'string' && c.name.trim());
      contacts = contacts.map(c => ({
        name: c.name?.trim() || '',
        email: c.email?.trim() || null,
        phone: c.phone?.trim() || null,
        company: c.company?.trim() || null,
        role: c.role?.trim() || null,
      }));
      
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not parse contacts from document. Please ensure the PDF contains readable contact information.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully extracted ${contacts.length} contacts`);

    return new Response(
      JSON.stringify({ success: true, contacts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing PDF');
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to parse document' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
