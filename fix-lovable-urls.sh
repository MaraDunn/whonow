#!/bin/bash

# Script to replace Lovable URLs with your app URL
# Usage: ./fix-lovable-urls.sh [your-app-url]

LOVABLE_URL="https://4bf33c78-836d-463a-a955-3c63d9df84b3.lovableproject.com"
NEW_URL="${1:-http://localhost:8080}"

echo "🔧 Replacing Lovable URLs..."
echo "   Old: $LOVABLE_URL"
echo "   New: $NEW_URL"
echo ""

# Update slack-integration function
if [ -f "supabase/functions/slack-integration/index.ts" ]; then
  echo "✅ Updating supabase/functions/slack-integration/index.ts"
  sed -i '' "s|$LOVABLE_URL|$NEW_URL|g" supabase/functions/slack-integration/index.ts
else
  echo "⚠️  File not found: supabase/functions/slack-integration/index.ts"
fi

# Update security.ts
if [ -f "supabase/functions/_shared/security.ts" ]; then
  echo "✅ Updating supabase/functions/_shared/security.ts"
  sed -i '' "s|$LOVABLE_URL|$NEW_URL|g" supabase/functions/_shared/security.ts
else
  echo "⚠️  File not found: supabase/functions/_shared/security.ts"
fi

echo ""
echo "✅ Done! URLs updated."
echo ""
echo "📋 Next steps:"
echo "   1. Review the changes in the files above"
echo "   2. Set APP_URL environment variable in Supabase Dashboard"
echo "   3. Test your integrations"
echo ""

