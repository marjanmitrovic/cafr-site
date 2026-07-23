# UČFR – nastavení kontaktních údajů organizace

Přidána administrátorská správa veřejných kontaktních údajů organizace.

## Nová databázová tabulka

- `SiteSettings`

Obsahuje:

- email organizace
- telefon
- adresu
- ID datové schránky

## Nové API ruty

Veřejná ruta:

- `GET /api/site-settings`

Admin ruty:

- `GET /api/admin/site-settings`
- `PATCH /api/admin/site-settings`

## Frontend

Ve footeru webu se nyní zobrazují údaje z databáze.

V administraci přibyla sekce:

- `Kontaktní údaje organizace`

Admin může měnit:

- email organizace
- telefon
- adresu
- datovou schránku

Po `db:push` a `db:seed` se vytvoří výchozí záznam.
