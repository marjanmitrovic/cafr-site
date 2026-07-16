# Resend SDK integration

The project now uses the official Resend SDK:

```js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
```

In `.env`, replace `re_xxxxxxxxx` with the real Resend API key.

For local testing, use:

```env
EMAIL_FROM="ČAFR <onboarding@resend.dev>"
ADMIN_NOTIFY_EMAIL="marjan.posao@gmail.com"
EMAIL_DISABLED="false"
```

A development-only route is available:

```bash
curl http://localhost:3001/api/test-email
```

The route is disabled when `NODE_ENV=production`.
