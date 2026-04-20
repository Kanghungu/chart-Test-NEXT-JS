-- Align older production data with the current Prisma schema.
-- Safe on fresh databases because all mutating statements are conditional.

ALTER TABLE "public"."MarketSnapshot"
ADD COLUMN IF NOT EXISTS "koreaTradingValue" DECIMAL(20,2);

DROP TYPE IF EXISTS "public"."AssetType_new";
CREATE TYPE "public"."AssetType_new" AS ENUM (
  'KOREA_STOCK',
  'US_STOCK',
  'INDEX',
  'ETF',
  'FOREX',
  'COMMODITY'
);

ALTER TABLE "public"."Asset"
ALTER COLUMN "type" TYPE TEXT USING "type"::text;

UPDATE "public"."Asset"
SET "type" = CASE
  WHEN COALESCE("market", '') = 'KRX'
    OR COALESCE("currency", '') = 'KRW'
    OR "symbol" ~ '^[0-9]{6}$'
    THEN 'KOREA_STOCK'
  ELSE 'US_STOCK'
END
WHERE "type" = 'STOCK';

DELETE FROM "public"."Asset"
WHERE "type" = 'CRYPTO';

ALTER TABLE "public"."Asset"
ALTER COLUMN "type" TYPE "public"."AssetType_new"
USING "type"::"public"."AssetType_new";

ALTER TYPE "public"."AssetType" RENAME TO "AssetType_old";
ALTER TYPE "public"."AssetType_new" RENAME TO "AssetType";
DROP TYPE "public"."AssetType_old";

DROP TYPE IF EXISTS "public"."NewsCategory_new";
CREATE TYPE "public"."NewsCategory_new" AS ENUM (
  'KOREA_STOCK',
  'US_STOCK',
  'MACRO'
);

ALTER TABLE "public"."NewsArticle"
ALTER COLUMN "category" TYPE TEXT USING "category"::text;

UPDATE "public"."NewsArticle"
SET "category" = CASE
  WHEN COALESCE("language", '') = 'ko'
    OR COALESCE("url", '') ILIKE '%naver%'
    THEN 'KOREA_STOCK'
  ELSE 'US_STOCK'
END
WHERE "category" = 'STOCK';

DELETE FROM "public"."NewsArticle"
WHERE "category" = 'CRYPTO';

ALTER TABLE "public"."NewsArticle"
ALTER COLUMN "category" TYPE "public"."NewsCategory_new"
USING "category"::"public"."NewsCategory_new";

ALTER TYPE "public"."NewsCategory" RENAME TO "NewsCategory_old";
ALTER TYPE "public"."NewsCategory_new" RENAME TO "NewsCategory";
DROP TYPE "public"."NewsCategory_old";
