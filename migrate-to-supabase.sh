#!/bin/bash

# Migration Helper Script for Lovable Cloud to Supabase
# This script helps you prepare for migration

echo "=========================================="
echo "Supabase Migration Helper"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

echo "📋 Current Configuration:"
echo "----------------------------"
grep "VITE_SUPABASE" .env
echo ""

echo "📁 Migration Files Found:"
echo "----------------------------"
ls -1 supabase/migrations/ | wc -l | xargs echo "Total migrations:"
echo ""

echo "🔧 Edge Functions Found:"
echo "----------------------------"
ls -1 supabase/functions/ | grep -v "^_" | wc -l | xargs echo "Total functions:"
ls -1 supabase/functions/ | grep -v "^_"
echo ""

echo "📝 Next Steps:"
echo "----------------------------"
echo "1. Create a new Supabase project at https://supabase.com/dashboard"
echo "2. Get your new project credentials (URL, anon key, project ID)"
echo "3. Run migrations in the Supabase SQL Editor (see MIGRATION_GUIDE.md)"
echo "4. Update .env file with new credentials"
echo "5. Deploy Edge Functions to your new project"
echo "6. Test your application"
echo ""
echo "For detailed instructions, see MIGRATION_GUIDE.md"
echo ""

