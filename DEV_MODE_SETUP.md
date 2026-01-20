# Development Mode Setup

This document explains how to test all features locally without affecting your production waitlist build.

## How It Works

Development mode automatically bypasses waitlist restrictions when:
1. Running on `localhost`, `127.0.0.1`, or `0.0.0.0`
2. `VITE_DEV_MODE=true` is set in your `.env` file
3. Running in Vite dev mode (`import.meta.env.DEV`)

## Setup

### Option 1: Automatic (Recommended)
Just run your dev server on localhost - it will automatically detect development mode:
```bash
npm run dev
# or
bun dev
```

### Option 2: Explicit Flag
Add to your `.env` or `.env.local` file:
```bash
VITE_DEV_MODE=true
```

## What Gets Bypassed

In development mode, the following waitlist restrictions are bypassed:
- ✅ Sign-ins are allowed
- ✅ Sign-ups are allowed  
- ✅ All routes are accessible (including `/app`)
- ✅ Full app functionality is available

## Production Safety

- Production builds will **NOT** have `VITE_DEV_MODE=true` (unless you explicitly set it)
- Production builds running on production domains will **NOT** be detected as dev mode
- Your published waitlist build remains secure

## Testing

1. Set `VITE_APP_LAUNCH_MODE=waitlist` in your `.env` (or keep it as is)
2. Run `npm run dev` (or `bun dev`)
3. Navigate to `http://localhost:5173` (or your dev port)
4. You should be able to:
   - Sign in with existing accounts
   - Sign up new accounts
   - Access `/app` route
   - Test all features normally

## Console Logs

When running in dev mode, you'll see console logs like:
```
[LaunchMode] VITE_APP_LAUNCH_MODE: waitlist
[LaunchMode] LAUNCH_MODE: waitlist
[LaunchMode] IS_WAITLIST_MODE: true
[LaunchMode] isDevelopmentMode: true
[LaunchMode] IS_WAITLIST_MODE_EFFECTIVE: false
```

The key indicator is `IS_WAITLIST_MODE_EFFECTIVE: false` - this means waitlist restrictions are bypassed.
