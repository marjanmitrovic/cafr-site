# Fáze: Email obavěštení

Přidán email systém bez nových npm balíčků. Používá Resend HTTP API přes vestavěný `fetch` v Node 22.

## Nové proměnné v `.env`

```env
RESEND_API_KEY=""
EMAIL_FROM="ČAFR <no-reply@cafr.cz>"
ADMIN_NOTIFY_EMAIL="admin@cafr.cz"
EMAIL_DISABLED="false"
NODE_ENV="development"
```

Bez `RESEND_API_KEY` se emaily neodesílají, ale zapisují se jako `SKIPPED` do `EmailLog` a aplikace dál funguje.

## Emaily

- potvrzení registrace členovi
- upozornění adminovi na novou přihlášku
- reset hesla
- změna statusu členství
- nový incident adminovi
- aktualizace incidentu členovi
- nový právní dotaz adminovi
- odpověď / aktualizace právního dotazu členovi
- změna stavu členského příspěvku
- potvrzení přihlášení na seminář

## Admin kontrola

`GET /api/admin/email-logs` vrací posledních 200 email logů.
