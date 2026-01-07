#!/bin/bash

# Test Edge Function Deployment
# This script tests if your check-subscription function is working

echo "================================"
echo "Testing check-subscription function"
echo "================================"
echo ""

# Get your Supabase URL and check if function exists
SUPABASE_URL="https://yinicwvgwdjlkwjegrun.supabase.co"

echo "1. Testing if function endpoint exists..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
  "${SUPABASE_URL}/functions/v1/check-subscription"

echo ""
echo "2. Checking function logs in Supabase Dashboard:"
echo "   Go to: Supabase Dashboard → Edge Functions → check-subscription → Logs"
echo ""
echo "3. Look for the most recent deployment:"
echo "   Go to: Supabase Dashboard → Edge Functions → check-subscription"
echo "   Check 'Last deployed' timestamp - should be very recent"
echo ""

echo "================================"
echo "Next Steps:"
echo "================================"
echo "1. If HTTP Status is 401/403: Function exists but needs auth token (expected)"
echo "2. If HTTP Status is 404: Function not deployed or wrong URL"
echo "3. If HTTP Status is 500: Function deployed but crashing"
echo ""
echo "Check the Supabase Dashboard logs for detailed error messages!"

