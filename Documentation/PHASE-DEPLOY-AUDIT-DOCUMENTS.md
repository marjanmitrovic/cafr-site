# ČAFR deploy audit + document admin upload

## Added / confirmed

- Admin document library includes a visible upload form for PDF, DOC, DOCX, PNG and JPG/JPEG.
- Admin can create a document by file upload or by direct URL.
- Admin can edit existing document metadata.
- Admin can replace an existing document file.
- Admin can set document visibility: PUBLIC, MEMBERS, APPROVED_MEMBERS, ADMIN_ONLY.
- Admin can set document status: DRAFT, PUBLISHED, ARCHIVED.
- Member document API returns only documents allowed for the logged-in user.

## Security fix before deploy

- `/api/results/:userId` now requires authentication.
- Normal members can only read their own results.
- ADMIN, BOARD and QUESTION_EDITOR can read other users' results.

## Static checks performed

```bash
node --check server/server.js
node --check src/main.js
node --check src/dashboard.js
node --check src/reset.js
node --check src/verify.js
node --check prisma/seed.js
```

Result: OK.

## Runtime checks still required locally / on Render

These require real `.env` values and external services:

- Neon database connection
- Prisma db push and seed
- Resend email sending
- Cloudinary upload
- Render production deployment
- Real admin login and browser upload flow
