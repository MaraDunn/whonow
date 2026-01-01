import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Format name with proper capitalization
function formatName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  
  const lowerParticles = new Set(['von', 'van', 'de', 'del', 'della', 'der', 'di', 'du', 'la', 'le', 'lo']);
  const specialPrefixes: Record<string, string> = { 'mc': 'Mc', 'mac': 'Mac', "o'": "O'" };
  
  return trimmed.split(/\s+/).map((word, wordIndex) => {
    if (word.includes('-')) {
      return word.split('-').map((part, i) => capitalizeWord(part, wordIndex === 0 && i === 0, lowerParticles, specialPrefixes)).join('-');
    }
    return capitalizeWord(word, wordIndex === 0, lowerParticles, specialPrefixes);
  }).join(' ');
}

function capitalizeWord(word: string, isFirst: boolean, lowerParticles: Set<string>, specialPrefixes: Record<string, string>): string {
  if (!word) return '';
  const lower = word.toLowerCase();
  if (!isFirst && lowerParticles.has(lower)) return lower;
  for (const [prefix, replacement] of Object.entries(specialPrefixes)) {
    if (lower.startsWith(prefix) && lower.length > prefix.length) {
      const rest = lower.slice(prefix.length);
      return replacement + rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase();
    }
  }
  const apostropheIndex = word.indexOf("'");
  if (apostropheIndex > 0 && apostropheIndex < word.length - 1) {
    const before = word.slice(0, apostropheIndex);
    const after = word.slice(apostropheIndex + 1);
    return before.charAt(0).toUpperCase() + before.slice(1).toLowerCase() + "'" + after.charAt(0).toUpperCase() + after.slice(1).toLowerCase();
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// Format phone number into readable format
function formatPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';
  
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length >= 8 && (hasPlus || digits.length > 10)) {
    let countryCode: string;
    let rest: string;
    if (digits.length <= 11) {
      countryCode = digits.slice(0, digits.length > 10 ? digits.length - 10 : 1);
      rest = digits.slice(countryCode.length);
    } else {
      countryCode = digits.slice(0, Math.min(3, digits.length - 9));
      rest = digits.slice(countryCode.length);
    }
    const groups: string[] = [];
    for (let i = 0; i < rest.length; i += 3) {
      groups.push(rest.slice(i, Math.min(i + 3, rest.length)));
    }
    return `+${countryCode} ${groups.join(' ')}`;
  }
  return trimmed;
}

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
      
      if (!Array.isArray(contacts)) {
        contacts = [contacts];
      }
      
      contacts = contacts.filter(c => c && c.name && typeof c.name === 'string' && c.name.trim());
      
      // Apply formatting to name and phone for each contact
      contacts = contacts.map(c => ({
        name: formatName(c.name?.trim() || ''),
        email: c.email?.trim() || null,
        phone: formatPhoneNumber(c.phone?.trim() || ''),
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
