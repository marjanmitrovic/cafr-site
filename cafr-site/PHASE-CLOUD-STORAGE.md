# Phase: Cloud storage for uploaded files

This version supports two upload modes:

- `FILE_STORAGE="local"` — local development, files are saved into `public/uploads`.
- `FILE_STORAGE="cloudinary"` — production mode, uploaded documents and evidence files are sent to Cloudinary.

No new npm packages are required. The backend uses Node 22 built-in `fetch`, `FormData`, and `Blob`.

## Environment variables

```env
FILE_STORAGE="cloudinary"
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_UPLOAD_PRESET="your_unsigned_upload_preset"
CLOUDINARY_FOLDER="cafr"
```

For local development use:

```env
FILE_STORAGE="local"
```

## What is stored in Cloudinary

- admin document uploads
- incident attachments
- legal request attachments

The app still stores metadata in PostgreSQL through Prisma. Only file binaries are moved to cloud storage.

## Production reason

Render/Vercel/Railway deployments should not depend on local uploaded files, because local upload folders may disappear during redeploys or instance changes. Cloud storage keeps uploaded evidence and documents outside the app container.
