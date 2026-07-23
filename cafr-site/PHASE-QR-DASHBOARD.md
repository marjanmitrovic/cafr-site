# UČFR – QR verification and member dashboard

Added:
- public `verify.html?member=<USER_ID>` card verification page;
- public API `GET /api/members/verify/:id`;
- member `dashboard.html` protected by the saved JWT;
- profile, card, test results and documents views;
- editable member profile;
- QR codes that contain only the public verification URL;
- no `qrcode` npm dependency is required.
