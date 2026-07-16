# FotbalTesty fix

Fixed empty question handling in frontend and added a clear API error if FotbalTesty questions are not present in the database.

After unpacking run:

```bash
npm run db:generate
npm run db:push
npm run db:seed
curl "http://localhost:3001/api/questions?source=fotbaltesty&count=5"
```

The API should return an array of questions.
