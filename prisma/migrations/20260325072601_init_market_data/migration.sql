-- CreateEnum
CREATE TYPE "public"."AssetType" AS ENUM ('CRYPTO', 'STOCK', 'INDEX', 'ETF', 'FOREX', 'COMMODITY');

-- CreateEnum
CREATE TYPE "public"."NewsCategory" AS ENUM ('CRYPTO', 'STOCK', 'MACRO');

-- CreateEnum
CREATE TYPE "public"."EventImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "public"."Asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."AssetType" NOT NULL,
    "market" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WatchlistEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "groupLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketSnapshot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'global',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fearGreedValue" INTEGER,
    "fearGreedClassification" TEXT,
    "cryptoVolumeUsd" DECIMAL(20,2),
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketSnapshotAsset" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "price" DECIMAL(20,8),
    "changePercent" DECIMAL(10,4),
    "volume" DECIMAL(20,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshotAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NewsArticle" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "source" TEXT NOT NULL,
    "category" "public"."NewsCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "language" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EconomicEvent" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT,
    "impact" "public"."EventImpact" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "displayTime" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "public"."Asset"("symbol");

-- CreateIndex
CREATE INDEX "Asset_type_isActive_idx" ON "public"."Asset"("type", "isActive");

-- CreateIndex
CREATE INDEX "WatchlistEntry_groupLabel_sortOrder_idx" ON "public"."WatchlistEntry"("groupLabel", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistEntry_assetId_groupLabel_key" ON "public"."WatchlistEntry"("assetId", "groupLabel");

-- CreateIndex
CREATE INDEX "MarketSnapshot_capturedAt_idx" ON "public"."MarketSnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "MarketSnapshot_label_capturedAt_idx" ON "public"."MarketSnapshot"("label", "capturedAt");

-- CreateIndex
CREATE INDEX "MarketSnapshotAsset_assetId_createdAt_idx" ON "public"."MarketSnapshotAsset"("assetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSnapshotAsset_snapshotId_assetId_key" ON "public"."MarketSnapshotAsset"("snapshotId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_externalId_key" ON "public"."NewsArticle"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_url_key" ON "public"."NewsArticle"("url");

-- CreateIndex
CREATE INDEX "NewsArticle_category_publishedAt_idx" ON "public"."NewsArticle"("category", "publishedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_source_publishedAt_idx" ON "public"."NewsArticle"("source", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicEvent_externalId_key" ON "public"."EconomicEvent"("externalId");

-- CreateIndex
CREATE INDEX "EconomicEvent_startsAt_impact_idx" ON "public"."EconomicEvent"("startsAt", "impact");

-- CreateIndex
CREATE INDEX "EconomicEvent_country_startsAt_idx" ON "public"."EconomicEvent"("country", "startsAt");

-- AddForeignKey
ALTER TABLE "public"."WatchlistEntry" ADD CONSTRAINT "WatchlistEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketSnapshotAsset" ADD CONSTRAINT "MarketSnapshotAsset_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "public"."MarketSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketSnapshotAsset" ADD CONSTRAINT "MarketSnapshotAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
