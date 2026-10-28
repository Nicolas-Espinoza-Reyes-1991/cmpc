-- Manual migration: Prisma cannot express these (see the note in schema.prisma).

-- pg_trgm is a trusted extension (PostgreSQL 13+): the database owner can create it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Partial matches on the title (ILIKE '%text%') use this index instead of a full scan.
CREATE INDEX "books_title_trgm_idx" ON "books" USING GIN ("title" gin_trgm_ops);

-- No two active books with the same title (any case), author and publisher.
-- Deleted books are ignored, so a deleted book can be registered again.
CREATE UNIQUE INDEX "books_active_title_author_publisher_key"
  ON "books" (lower("title"), "author_id", "publisher_id")
  WHERE "deleted_at" IS NULL;
