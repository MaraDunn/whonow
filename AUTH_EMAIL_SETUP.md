# Auth Verification Email Setup

If users reach the "Check your email" screen after sign-up but **never receive the verification email**, the cause is almost always Supabase’s **default email provider**.

## Why verification emails don’t arrive

Supabase’s built-in email is for **demo only** and has strict limits:

1. **Team-only delivery** – Without custom SMTP, Auth sends emails **only to addresses that are members of your Supabase organization** (Dashboard → Organization → Team). Any other address never gets the email.
2. **Very low rate limit** – About **2 messages per hour** for the default provider.
3. **No delivery guarantee** – No SLA; messages can be dropped or go to spam.

So: sign-up succeeds, the app shows "Check your email", but Supabase never delivers to normal user addresses unless you configure your own SMTP.

## Fix: Configure custom SMTP

To have verification (and password reset) emails actually delivered to all users:

1. **Pick an SMTP provider** (create an account if needed). Examples:
   - [Resend](https://resend.com/docs/send-with-supabase-smtp) (simple, good for apps)
   - [Brevo](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)
   - [SendGrid](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/getting-started-smtp)
   - [Postmark](https://postmarkapp.com/developer/user-guide/send-email-with-smtp)
   - [AWS SES](https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html)
   - For **testing only** (no real delivery): [Mailtrap](https://mailtrap.io/)

2. **Get SMTP credentials** from the provider (host, port, username, password) and a **From** address (e.g. `no-reply@yourdomain.com`).

3. **Configure in Supabase**
   - Open **[Supabase Dashboard](https://supabase.com/dashboard)** → your project.
   - Go to **Authentication** → **Providers** → **Email** and ensure **Confirm email** is **ON** (so verification is required).
   - Go to **Authentication** (left sidebar) → **SMTP** (or open `https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/smtp`).
   - Enable **Custom SMTP** and fill in:
     - **Sender email** (e.g. `no-reply@yourdomain.com`)
     - **Sender name** (e.g. "WhoNow")
     - **Host**, **Port**, **Username**, **Password** from your provider.
   - Save. Auth will then send verification (and other auth) emails through your SMTP to **all** user addresses.

4. **Redirect URLs** (so the verification link works)
   - **Authentication** → **URL Configuration** → **Redirect URLs**.
   - Add every URL where users land after clicking the email link, e.g.:
     - `https://your-production-domain.com/auth`
     - `http://localhost:5173/auth` (for local dev)
   - **Desktop (Tauri) app:** If users sign up from the desktop app, the link in the email must open in a **browser** and go to your **web** app URL (not `tauri://localhost`). Set **VITE_APP_URL** to your deployed web URL (e.g. `https://app.whonow.com`) when building the desktop app, and add that `/auth` URL to Redirect URLs. Then the verification link will land on the web app, show “Email verified! Redirecting…”, and redirect into the app.

After this, new sign-ups should receive the verification email. Existing unverified users can use **Resend verification email** on the "Check your email" screen.

## Auth succeeds in logs but I never get the email

If **Auth logs show the request completing successfully** but the verification email never arrives, the failure is happening **after** Supabase creates the user — either when handing off to your SMTP (Zoho) or when the recipient’s server receives the message.

Work through these in order:

### 1. Check Zoho (or your SMTP provider) side

- **Zoho Mail:** Check **Sent** for the verification email. If it’s there, Zoho sent it; the issue is delivery (receiver rejected or spammed it).
- **Zoho ZeptoMail:** In the dashboard, check **Sending** / **Logs** or **Delivery** for that send. See if the message was accepted and delivered, bounced, or deferred.
- If Zoho shows **bounce** or **rejected**, the recipient server is refusing the message (often due to SPF/DKIM/DMARC — see below).
- If there’s **no record** of the send in Zoho, Supabase may not be reaching Zoho (e.g. wrong SMTP config). Re-check Supabase **Authentication → SMTP** (host, port, username, password, sender).

### 2. Fix domain authentication (DMARC / SPF / DKIM)

You mentioned Zoho says your domain is **not DMARC compliant**. Many receiving servers **reject or spam** messages that fail DMARC/SPF/DKIM, so the email never lands in the inbox.

- In **Zoho** (Mail or ZeptoMail), add the **SPF** and **DKIM** DNS records they give you for the domain you send from.
- Add a **DMARC** record for that domain (e.g. `_dmarc.yourdomain.com`) so receiving servers know how to treat your mail.
- After DNS propagates, Zoho should report the domain as DMARC compliant. Verification emails are then much more likely to be delivered instead of rejected or spammed.

### 3. Check spam and try another address

- Check the **spam/junk** folder and allowlist the sender address.
- Try **Resend verification email** to a different address (e.g. a Gmail account) to see if delivery is recipient-specific.

### 4. Repeated sign-up does not send email

If the Auth log shows **`action`: `user_repeated_signup`**, the email is **already registered**. Supabase does **not** send a verification email on repeated sign-up (to prevent abuse), so nothing is sent to Zoho. Use **Resend verification email** in the app, or sign up with a **new email** to test. To confirm the existing user without the link: **Authentication → Users** → find user → confirm email.

### 5. Supabase Auth logs

- In **Logs → Auth Logs**, look for any **second** log line around the same time (e.g. an email/SMTP send event or error). Sometimes “auth success” is logged when the user is created, and a separate log indicates whether the email was sent or failed. If the log shows **`user_repeated_signup`**, no email is sent for that request (see above).

---

## Still not receiving after enabling SMTP?

Work through these in order:

### 1. Check Auth logs (most important)

- **Dashboard** → **Logs** → **Auth Logs**.
- Sign up again (or use “Resend verification email”) and watch the logs.
- Look for **errors** when the email is sent (e.g. “SMTP error”, “authentication failed”, “connection refused”). The message there usually points to the fix (wrong host, port, username, password, or sender).

### 2. Verify SMTP settings (Zoho)

If you use **Zoho Mail**:

- **Host:** `smtp.zoho.com`
- **Port:** `465` (SSL) or `587` (TLS)
- **Username:** your full Zoho email (e.g. `no-reply@yourdomain.com`)
- **Password:** your Zoho account password or an [App Password](https://www.zoho.com/mail/help/zoho-mail-smtp-config.html)
- **Sender email:** must be this same Zoho address (or another mailbox on the same domain). The domain must be added and verified in Zoho.

If you use **Zoho ZeptoMail** (transactional):

- **Host:** `smtp.zeptomail.com`
- **Port:** `465` or `587`
- **Username / Password:** from ZeptoMail dashboard → **Sending** → **SMTP**
- **Sender email:** use a From address you’ve set up in ZeptoMail (verified domain).

### 3. Confirm email is ON

- **Authentication** → **Providers** → **Email**.
- Ensure **Confirm email** is **ON**. If it’s OFF, Supabase won’t send a verification email.

### 4. Check spam and resend

- Check the inbox **spam/junk** folder and allowlist the sender address.
- On the app’s “Check your email” screen, use **Resend verification email** and check logs again.

### 5. Provider-side issues

- In **Zoho** (Mail or ZeptoMail), check for bounces, blocks, or suppression lists.
- Ensure the **sender address** you use in Supabase is allowed/verified in Zoho for sending.

## If emails still don’t arrive (summary)

1. **Auth logs** – Dashboard → **Logs** → **Auth Logs** for SMTP/email errors.
2. **Spam** – Check spam/junk and allowlist the sender.
3. **Provider logs** – In your SMTP provider’s dashboard, check bounces, blocks, or suppression lists.

## References

- [Supabase: Not receiving auth emails](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project)
- [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
