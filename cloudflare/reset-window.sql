CREATE TABLE IF NOT EXISTS public."UcfrResetWindow" (
  id text PRIMARY KEY,
  hits integer NOT NULL,
  expires timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "UcfrResetWindow_expires" ON public."UcfrResetWindow" (expires);
