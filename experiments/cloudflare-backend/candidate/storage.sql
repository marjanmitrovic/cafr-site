CREATE TABLE IF NOT EXISTS "UcfrStoredFile" (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  mime text NOT NULL,
  content bytea NOT NULL,
  "sizeBytes" integer NOT NULL CHECK ("sizeBytes" BETWEEN 1 AND 8388608),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK (octet_length(content) = "sizeBytes")
);
