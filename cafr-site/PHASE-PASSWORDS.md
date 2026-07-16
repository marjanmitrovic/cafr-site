# Faza: upravljanje lozinkom

Dodato:
- promena lozinke iz članskog profila
- zahtev za zaboravljenu lozinku
- jednokratni reset token sa rokom 30 minuta
- reset.html stranica
- token se u bazi čuva samo kao SHA-256 hash

U razvojnom režimu API vraća reset link direktno na sajtu. Produkcijsko slanje e-maila je sledeća faza.
