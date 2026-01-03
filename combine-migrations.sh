#!/bin/bash

# Script to combine all Supabase migrations into a single SQL file
# This makes it easier to run all migrations at once in the Supabase SQL Editor

MIGRATIONS_DIR="supabase/migrations"
OUTPUT_FILE="combined-migrations.sql"

echo "🔄 Combining Supabase migrations..."
echo ""

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "❌ Error: Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Create output file with header
cat > "$OUTPUT_FILE" << 'EOF'
-- ============================================
-- Combined Supabase Migrations
-- ============================================
-- This file contains all migrations combined in chronological order
-- Generated: $(date)
-- 
-- Instructions:
-- 1. Copy the entire contents of this file
-- 2. Go to your Supabase Dashboard → SQL Editor
-- 3. Paste and click "Run"
-- ============================================

EOF

# Add timestamp to header
sed -i '' "s/\$(date)/$(date)/" "$OUTPUT_FILE" 2>/dev/null || sed -i "s/\$(date)/$(date)/" "$OUTPUT_FILE" 2>/dev/null || echo "-- Generated: $(date)" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "-- ============================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Counter for tracking
count=0
total=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')

# Process each migration file in sorted order
for migration_file in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
    if [ -f "$migration_file" ]; then
        count=$((count + 1))
        filename=$(basename "$migration_file")
        
        echo "  [$count/$total] Processing: $filename"
        
        # Add separator and comment
        echo "" >> "$OUTPUT_FILE"
        echo "-- ============================================" >> "$OUTPUT_FILE"
        echo "-- Migration $count: $filename" >> "$OUTPUT_FILE"
        echo "-- ============================================" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        # Append migration content
        cat "$migration_file" >> "$OUTPUT_FILE"
        
        # Add separator after migration
        echo "" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
done

# Add footer
cat >> "$OUTPUT_FILE" << 'EOF'
-- ============================================
-- End of Migrations
-- ============================================
EOF

echo ""
echo "✅ Successfully combined $count migrations into: $OUTPUT_FILE"
echo ""
echo "📋 Next steps:"
echo "   1. Review the file: cat $OUTPUT_FILE"
echo "   2. Copy the contents"
echo "   3. Go to Supabase Dashboard → SQL Editor"
echo "   4. Paste and run"
echo ""

