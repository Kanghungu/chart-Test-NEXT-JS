-- CreateEnum
CREATE TYPE "public"."SignalTone" AS ENUM ('UP', 'DOWN', 'NEUTRAL');

-- CreateTable
CREATE TABLE "public"."MarketSignal" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tone" "public"."SignalTone" NOT NULL,
    "source" TEXT NOT NULL,
    "signalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Briefing" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT,
    "summary" TEXT NOT NULL,
    "marketView" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketSignal_externalId_key" ON "public"."MarketSignal"("externalId");

-- CreateIndex
CREATE INDEX "MarketSignal_signalDate_tone_idx" ON "public"."MarketSignal"("signalDate", "tone");

-- CreateIndex
CREATE UNIQUE INDEX "Briefing_externalId_key" ON "public"."Briefing"("externalId");

-- CreateIndex
CREATE INDEX "Briefing_publishedAt_idx" ON "public"."Briefing"("publishedAt");
