# UČFR – Document uploads

This phase adds direct document upload from the admin panel without adding npm upload dependencies.

## Added

- Admin can upload PDF, DOC, DOCX, PNG and JPG files.
- Uploaded files are stored in `public/uploads/documents`.
- Existing URL-based document links still work.
- Maximum upload size is 8 MB.
- Member dashboard reads published documents through existing visibility rules.
- No `qrcode`, `multer` or additional npm package is required.

## API

- `POST /api/admin/documents/upload`

Body is JSON with:

- `titleCs`
- `titleEn`
- `descriptionCs`
- `descriptionEn`
- `category`
- `visibility`
- `status`
- `fileName`
- `fileData` as data URL

The server stores the file and creates a `Document` database record with URL like:

`/uploads/documents/<stored-file-name>`
