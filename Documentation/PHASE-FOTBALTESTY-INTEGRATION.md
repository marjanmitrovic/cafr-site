# PHASE: Integrace FotbalTesty

Integrovaný původní projekt `fotbaltesty.22web.org` do ČAFR platformy.

## Zdroj

Importované ze ZIP souboru:

- `FotbalTesty-InfinityFree-SQL-safe(1).zip`
- SQL tabulky: `questions`, `answers`, `category`

PHP verze obsahovala pouze jednoduchý testovací soubor a nebyla potřeba pro import.

## Co je integrováno

- import otázek do stávající tabulky `Question`
- import odpovědí do `QuestionOption`
- samostatné kategorie `FotbalTesty – ...`
- samostatný test `fotbaltesty`
- veřejný testovací režim na hlavní stránce
- výsledky se ukládají do běžné historie člena
- dashboard odkazuje na spuštění testů

## Počty

- importováno: 818 otázek s odpověďmi
- aktivních pro testování: 525 otázek
- neaktivní/staré otázky zůstávají v databázi jako neaktivní

## Nové API chování

`GET /api/questions?source=fotbaltesty&count=20`

vrací pouze aktivní otázky importované z FotbalTesty.

`POST /api/attempts` s `mode: "fotbaltesty"` ukládá pokus pod test `fotbaltesty`.

## Spuštění

Po rozbalení nové verze:

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Seed importuje otázky automaticky ze souboru:

```text
server/data/fotbaltesty.json
```
