# Digital member QR card

The member card now generates a unique QR code in the browser.

The QR payload contains:
- type: CAFR_MEMBER_CARD
- version
- member ID
- card number
- member name
- membership status

No email address or password is stored in the QR code.

Install and run:

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

The next recommended phase is a public `/verify-member/:id` verification endpoint and page, so scanning a card can confirm the current status directly from the database.
