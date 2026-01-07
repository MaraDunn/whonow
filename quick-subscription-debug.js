// Quick Subscription Debug Script
// Run this in your browser console (F12) when logged into your app

(async function debugSubscription() {
  console.log('=== SUBSCRIPTION DEBUG START ===\n');
  
  try {
    // 1. Check if supabase is available
    if (typeof supabase === 'undefined') {
      console.error('❌ Supabase client not found. Make sure you are on your app page.');
      return;
    }

    // 2. Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      console.error('❌ Not logged in:', sessionError);
      return;
    }

    const session = sessionData.session;
    const token = session.access_token;
    const userId = session.user.id;
    const userEmail = session.user.email;

    console.log('✅ User Info:');
    console.log('  - Email:', userEmail);
    console.log('  - User ID:', userId.substring(0, 8) + '...');
    console.log('');

    // 3. Check database subscription
    console.log('📊 Checking Database...');
    const { data: dbSub, error: dbError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (dbError) {
      console.error('❌ Database error:', dbError.message);
    } else if (!dbSub) {
      console.warn('⚠️  No subscription record in database');
    } else {
      console.log('✅ Database subscription:');
      console.log('  - Tier:', dbSub.tier);
      console.log('  - Status:', dbSub.status);
      console.log('  - Stripe Subscription ID:', dbSub.stripe_subscription_id);
      console.log('  - Stripe Customer ID:', dbSub.stripe_customer_id);
      console.log('  - Seats Limit:', dbSub.employee_seats_limit);
      console.log('  - Updated At:', dbSub.updated_at);
    }
    console.log('');

    // 4. Call check-subscription function
    console.log('🔍 Calling check-subscription function...');
    const { data: funcData, error: funcError } = await supabase.functions.invoke('check-subscription', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (funcError) {
      console.error('❌ Function error:', funcError);
    } else {
      console.log('✅ Function response:');
      console.log('  - Subscribed:', funcData.subscribed);
      console.log('  - Tier:', funcData.tier);
      console.log('  - Product/Price ID:', funcData.product_id);
      console.log('  - Seats Limit:', funcData.seats_limit);
      console.log('  - Subscription End:', funcData.subscription_end);
      if (funcData.error) {
        console.warn('  ⚠️  Error:', funcData.error);
      }
    }
    console.log('');

    // 5. Summary and recommendations
    console.log('📋 SUMMARY:');
    if (dbSub && funcData) {
      if (dbSub.tier === funcData.tier) {
        if (funcData.tier === 'business') {
          console.log('✅ Subscription is correctly set to BUSINESS tier!');
        } else {
          console.warn(`⚠️  Both show tier as: ${funcData.tier}`);
          console.log('\n🔧 NEXT STEPS:');
          console.log('1. Check your Stripe subscription status (should be "Active")');
          console.log('2. Copy your Stripe Price ID from the subscription');
          console.log('3. Share the Price ID to verify it\'s mapped correctly');
          console.log('\nYour current Price ID from function:', funcData.product_id);
        }
      } else {
        console.warn('⚠️  Mismatch detected!');
        console.log('  Database says:', dbSub.tier);
        console.log('  Function says:', funcData.tier);
      }
    }

    console.log('\n=== DEBUG COMPLETE ===');
    console.log('\nTo share these results, copy everything above.');

    // Return data for further inspection
    return {
      database: dbSub,
      function: funcData,
      user: { id: userId, email: userEmail }
    };

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
})();

