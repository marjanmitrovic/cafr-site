# PHASE - článek a aktualizované stanovy

Tato verze integruje článek Jana Markese "Fotbal bez vesnice: tichý rozklad hry, která držela Česko pohromadě" jako veřejný tematický podklad v sekci Aktuality a v knihovně dokumentů.

## Změny

- Přidána aktualita k tématu úpadku vesnického / grassroots fotbalu.
- Aktualita vysvětluje souvislost s postavením rozhodčích: méně klubů, dobrovolníků a důvěry znamená horší prostředí i pro rozhodčí.
- Přidán externí veřejný dokument v seed datech: `medium-fotbal-bez-vesnice`.
- Nahrazeny stanovy novým souborem `Stanovy_CAFR_aktualizovane.pdf`.
- Starý odkaz `Stanovy_CAFR_navrh.pdf` zůstává zachován jako kompatibilní kopie, aby se nerozbily starší odkazy.
- Veřejná sekce Dokumenty nyní odkazuje na aktualizované stanovy.
- Seed dokumentu `default-stanovy-cafr` nyní ukazuje na `/documents/Stanovy_CAFR_aktualizovane.pdf`.

## Spuštění

```bash
npm install --no-audit --no-fund
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Po spuštění zkontrolovat:

- hlavní stránka -> Aktuality
- hlavní stránka -> Dokumenty
- dashboard -> Dokumenty
- admin panel -> Knihovna dokumentů
