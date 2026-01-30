# Slack integration setup

## Error: `invalid_team_for_non_distributed_app`

This error appears when:

- Your Slack app is **not** configured for public distribution, and
- The user has multiple Slack workspaces in the same browser, or the OAuth flow ends up on a different workspace than expected.

### Fix

1. Open [Slack API – Your Apps](https://api.slack.com/apps) and select your app.
2. In the left sidebar, go to **Manage Distribution**.
3. Turn on **Public Distribution** (or **Activate Public Distribution**).
4. Complete any required steps (e.g. review checklist, approval).
5. Retry connecting Slack in WhoNow.

### Alternative workaround

If you cannot enable public distribution (e.g. internal-only app):

- Ask the user to connect Slack in an **incognito/private** window with only the intended workspace signed in, or  
- Have the user sign out of other Slack workspaces in the same browser, then connect again.

The app will continue to show a user-friendly message when this error occurs so users know what to do.
