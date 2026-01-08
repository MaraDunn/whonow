# Custom Branding Feature Setup

This document describes the custom branding feature implementation for Business tier organizations.

## Overview

The custom branding feature allows Business tier organizations to:
- Upload a custom logo
- Upload a custom favicon
- Set primary and secondary brand colors
- Have their branding automatically applied throughout the application

## Implementation Details

### Database Changes

A migration has been added (`20260108125822_add_custom_branding.sql`) that adds the following fields to the `companies` table:
- `logo_url` - URL to the custom logo
- `favicon_url` - URL to the custom favicon
- `primary_color` - Primary brand color (hex code)
- `secondary_color` - Secondary brand color (hex code)

### Storage Setup

**Important:** After running the migration, you need to create a storage bucket in Supabase:

1. Go to **Storage** in your Supabase dashboard
2. Click **"New bucket"**
3. Name: `branding`
4. Make it **public** (or set up RLS policies to allow authenticated users to upload)
5. Set up storage policies:
   - Allow authenticated users to upload files
   - Allow public read access (so logos can be displayed)

### Components Created

1. **`useBranding` hook** (`src/hooks/useBranding.ts`)
   - Fetches branding assets for the current organization
   - Returns custom branding if available (business tier), otherwise defaults to WhoNow branding

2. **`useBrandingUpload` hook** (`src/hooks/useBrandingUpload.ts`)
   - Handles uploading logos and favicons to Supabase storage
   - Validates file types and sizes
   - Provides delete functionality

3. **`BrandingSettings` component** (`src/components/BrandingSettings.tsx`)
   - Admin interface for uploading branding assets
   - Only visible to Business tier admins
   - Includes logo upload, favicon upload, and color picker

### Components Updated

1. **`WhoNowLogo` component** - Now uses custom branding when available
2. **`OrganizationManagement` component** - Includes the BrandingSettings component
3. **`Footer` component** - Uses dynamic company name from branding

### Feature Access

The `custom_branding` feature has been added to the subscription system:
- Only available for **Business** tier organizations
- Controlled via `FEATURE_ACCESS` in `src/types/subscription.ts`
- Protected by `FeatureGate` component

## Usage

### For Admins

1. Navigate to **Settings** → **Organization**
2. Scroll to the **Custom Branding** section
3. Upload your logo (PNG, JPEG, SVG, or WebP, max 5MB)
4. Upload your favicon (PNG, ICO, or SVG, max 1MB)
5. Set your brand colors using the color picker or hex input
6. Click **Save Colors** to apply color changes

### For Developers

To use branding in your components:

```tsx
import { useBranding } from "@/hooks/useBranding";

function MyComponent() {
  const branding = useBranding();
  
  return (
    <img src={branding.logo} alt={branding.companyName} />
  );
}
```

The `useBranding` hook automatically:
- Checks if the user's organization has custom branding (Business tier)
- Returns custom assets if available
- Falls back to default WhoNow branding if not

## File Requirements

### Logo
- **Formats:** PNG, JPEG, SVG, WebP
- **Max size:** 5MB
- **Recommended:** Transparent PNG, 200x50px

### Favicon
- **Formats:** PNG, ICO, SVG
- **Max size:** 1MB
- **Recommended:** 32x32px or 16x16px

### Colors
- **Format:** Hex color codes (e.g., `#FF5733`)
- **Usage:** Applied throughout the application for theming

## Notes

- Branding only applies when users are logged in and part of a Business tier organization
- Landing pages and public areas will always show WhoNow branding
- The branding system is designed to be simple, consistent, and straightforward
- All branding assets are stored in Supabase storage for fast CDN delivery

