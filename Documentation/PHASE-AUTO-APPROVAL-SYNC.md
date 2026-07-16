# Automatsko osvežavanje statusa članstva

Dashboard sada poziva `GET /api/auth/me` pri svakom otvaranju, vraćanju na karticu, fokusiranju prozora i svakih 30 sekundi.

Kada administrator promeni status sa `PENDING` na `APPROVED`, član ne mora da se odjavljuje. Dashboard automatski osvežava podatke i otključava članske funkcije.

Dodato je i dugme **Obnovit stav** za ručnu proveru.
