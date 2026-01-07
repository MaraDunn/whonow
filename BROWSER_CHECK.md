# Browser Console Check for Contact Timestamps

Since Node.js isn't available in the shell, you can run this check directly in your browser console.

## Quick Check Script

Open your browser's developer console (F12 or Cmd+Option+I) and paste this:

```javascript
// Quick check for contact timestamps
(async function() {
  const contactName = "Mitchel Dunn";
  console.log(`🔍 Checking: "${contactName}"\n`);
  
  // Access the app's contacts (adjust based on your app structure)
  // Option 1: If contacts are in React state, you might need to access them differently
  // Option 2: Query directly from Supabase
  
  // Get Supabase client - you'll need to get this from your app
  // Check the Network tab to find your Supabase URL and key, or:
  
  // If you can access the app's Supabase instance:
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  
  // You'll need to get these from your .env file or app config:
  const supabaseUrl = 'YOUR_SUPABASE_URL'; // Replace with actual URL
  const supabaseKey = 'YOUR_SUPABASE_KEY'; // Replace with actual key
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, name, created_at, updated_at')
    .ilike('name', `%${contactName}%`)
    .is('deleted_at', null);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  if (!contacts || contacts.length === 0) {
    console.log(`❌ No contact found`);
    return;
  }
  
  const contact = contacts[0];
  console.log(`✅ Found: ${contact.name}`);
  console.log(`   created_at: ${contact.created_at || 'MISSING'}`);
  
  if (contact.created_at) {
    const createdAt = new Date(contact.created_at);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    const isToday = createdAt >= todayStart && createdAt <= todayEnd;
    console.log(`   Is today: ${isToday ? '✅' : '❌'}`);
    console.log(`   Created: ${createdAt.toLocaleString()}`);
  } else {
    console.log('⚠️  Missing timestamp! Run backfill script.');
  }
})();
```

## Easier Alternative: Check in React DevTools

1. Open React DevTools
2. Find the component that renders contacts
3. Check the `contacts` array in the component's props/state
4. Look for "Mitchel Dunn" and check if it has a `createdAt` property

## Or: Add Temporary Debug Logging

Add this to your search component temporarily to see what's happening:

```typescript
// In your search component, add:
console.log('Contacts:', contacts.map(c => ({
  name: c.name,
  createdAt: c.createdAt,
  hasCreatedAt: !!c.createdAt
})));

console.log('Parsed query:', parsedQuery);
console.log('Time range:', parsedQuery.timeRange);
```

This will show you:
- Which contacts have `createdAt`
- What time range is being used
- Why contacts might not be matching





