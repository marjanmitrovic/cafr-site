# Incident workflow

This build fixes the invalid Prisma relation on `Test.incidents` and adds:

- incident processing history (`IncidentEvent`)
- administrator notes visible to the member
- status-change history with timestamps
- admin filtering by status and urgency
- one save action for status and note

After replacing the project, run:

```bash
npm install --no-audit --no-fund
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```
