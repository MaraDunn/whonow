/**
 * Browser Console Script to Check Contact Timestamps
 * 
 * Copy and paste this entire script into your browser console while on the WhoNow app
 * Then run: checkContactTimestamp("Mitchel Dunn")
 */

async function checkContactTimestamp(contactName = "Mitchel Dunn") {
  console.log(`🔍 Checking contact: "${contactName}"\n`);

  // Get Supabase client from the app (assuming it's available globally or via window)
  // If not, you'll need to import it or access it differently
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  
  // Get credentials from environment (you may need to adjust this)
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || window.__SUPABASE_URL__;
  const supabaseKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || window.__SUPABASE_KEY__;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Could not find Supabase credentials');
    console.log('💡 Try running this in the browser console after the app loads');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Find the contact
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, name, created_at, updated_at, deleted_at')
      .ilike('name', `%${contactName}%`)
      .is('deleted_at', null);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (!contacts || contacts.length === 0) {
      console.log(`❌ No contact found matching "${contactName}"`);
      return;
    }

    const contact = contacts[0];
    console.log(`✅ Found contact: ${contact.name}`);
    console.log(`   ID: ${contact.id}`);
    console.log(`   created_at: ${contact.created_at || 'NULL/MISSING'}`);
    console.log(`   updated_at: ${contact.updated_at || 'NULL/MISSING'}\n`);

    if (!contact.created_at) {
      console.log('⚠️  Contact is missing created_at timestamp!');
      console.log('💡 Run: node backfill-contact-timestamps.js');
      return;
    }

    // Check if it's today
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const createdAt = new Date(contact.created_at);
    const isToday = createdAt >= todayStart && createdAt <= todayEnd;

    console.log('📅 Date Analysis:');
    console.log(`   Contact created_at: ${createdAt.toISOString()}`);
    console.log(`   Contact created_at (local): ${createdAt.toLocaleString()}`);
    console.log(`   Today start: ${todayStart.toISOString()}`);
    console.log(`   Today start (local): ${todayStart.toLocaleString()}`);
    console.log(`   Today end: ${todayEnd.toISOString()}`);
    console.log(`   Today end (local): ${todayEnd.toLocaleString()}`);
    console.log(`   Is today: ${isToday ? '✅ YES' : '❌ NO'}\n`);

    if (!isToday) {
      const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`   Contact was created ${daysDiff} day(s) ago`);
    }

    // Test the search query parsing
    console.log('\n🔍 Testing Search Query Parsing:');
    const testQuery = "Who did I meet today?";
    console.log(`   Query: "${testQuery}"`);
    
    // Import the parser (you may need to adjust the import path)
    try {
      const { parseSearchQuery } = await import('/src/utils/searchQueryParser.ts');
      const parsed = parseSearchQuery(testQuery);
      console.log(`   Time Range: ${parsed.timeRange ? `${parsed.timeRange.start.toISOString()} to ${parsed.timeRange.end.toISOString()}` : 'None'}`);
      
      if (parsed.timeRange) {
        const { start, end } = parsed.timeRange;
        const matches = createdAt >= start && createdAt <= end;
        console.log(`   Contact matches range: ${matches ? '✅ YES' : '❌ NO'}`);
        
        if (!matches) {
          console.log(`   Contact time: ${createdAt.getTime()}`);
          console.log(`   Range start: ${start.getTime()}`);
          console.log(`   Range end: ${end.getTime()}`);
          console.log(`   Before start: ${createdAt < start}`);
          console.log(`   After end: ${createdAt > end}`);
        }
      }
    } catch (importError) {
      console.log('   Could not import parser (this is OK for browser check)');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.checkContactTimestamp = checkContactTimestamp;
}

console.log('✅ Script loaded! Run: checkContactTimestamp("Mitchel Dunn")');





