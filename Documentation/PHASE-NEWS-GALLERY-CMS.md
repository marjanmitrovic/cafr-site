# PHASE: News CMS and media gallery

Added:

- `NewsArticle` Prisma model
- `GalleryMedia` Prisma model
- public `/api/news`
- public `/api/gallery`
- admin `/api/admin/news`
- admin `/api/admin/gallery`
- admin upload of news images
- admin upload of gallery images and videos
- Cloudinary/local storage support through existing storage layer
- public homepage news loaded from database
- public homepage media gallery loaded from database
- legal pages restored: privacy, terms, cookies

Limits:

- news images: max 8 MB
- gallery files: max 25 MB
- allowed gallery files: PNG, JPG, WEBP, GIF, MP4, WEBM, MOV

Deployment note:

Run:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

`db:push` creates the new tables.
