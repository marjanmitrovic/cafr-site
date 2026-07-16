# Phase: Attachments for incidents and legal support

Added secure evidence uploads without new npm packages.

## Member dashboard

Members can attach up to 5 files when submitting:

- incident reports
- legal support requests

Allowed file types:

- PDF
- DOC / DOCX
- PNG / JPG
- TXT

Each file may be up to 8 MB.

## Storage

Files are stored locally in:

```text
public/uploads/evidence/incidents
public/uploads/evidence/legal
```

They are served through:

```text
/uploads/evidence/...
```

## Database

New Prisma models:

- `IncidentAttachment`
- `LegalRequestAttachment`

Attachments are linked to their incident or legal request and are deleted when the parent record is deleted.

## Admin panel

Administrators can see and open attached evidence files directly from:

- incident management
- legal request management

## Notes

This implementation avoids `multer` and other upload dependencies. Files are sent as base64 data URLs through the existing JSON API. For production, a future phase can move uploads to S3-compatible object storage.
