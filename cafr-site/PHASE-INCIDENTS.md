# ČAFR – Incident system

Nova faza dodaje trajno čuvanje incidenata u PostgreSQL bazi.

## Funkcije
- prijavljeni i odobreni član prijavljuje incident iz dashboarda
- član vidi istoriju svojih prijava i status obrade
- administrator vidi sve incidente i kontakt člana
- administrator menja status: NEW, IN_REVIEW, CONTACTED, RESOLVED, CLOSED
- prioriteti: NORMAL, HIGH, CRITICAL
- projekat više ne zavisi od dotenv paketa
- package-lock.json nije uključen da ne prenese interni registry

## Posle raspakivanja
```bash
npm config set registry https://registry.npmjs.org/
npm install --no-audit --no-fund
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```
