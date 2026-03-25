const {
  PrismaClient,
  AssetType,
  EventImpact,
  NewsCategory,
  SignalTone
} = require("@prisma/client");

const prisma = new PrismaClient();

async function upsertAssets() {
  const assets = [
    { symbol: "BTC", name: "Bitcoin", type: AssetType.CRYPTO, market: "CRYPTO" },
    { symbol: "ETH", name: "Ethereum", type: AssetType.CRYPTO, market: "CRYPTO" },
    { symbol: "SOL", name: "Solana", type: AssetType.CRYPTO, market: "CRYPTO" },
    { symbol: "NVDA", name: "NVIDIA", type: AssetType.STOCK, market: "NASDAQ" },
    { symbol: "AAPL", name: "Apple", type: AssetType.STOCK, market: "NASDAQ" },
    { symbol: "TSLA", name: "Tesla", type: AssetType.STOCK, market: "NASDAQ" },
    { symbol: "S&P 500", name: "S&P 500", type: AssetType.INDEX, market: "US" },
    { symbol: "NASDAQ", name: "NASDAQ Composite", type: AssetType.INDEX, market: "US" }
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      update: asset,
      create: asset
    });
  }

  const savedAssets = await prisma.asset.findMany({
    where: { symbol: { in: assets.map((asset) => asset.symbol) } }
  });

  return new Map(savedAssets.map((asset) => [asset.symbol, asset]));
}

async function upsertWatchlist(assetBySymbol) {
  const watchlist = [
    { symbol: "BTC", groupLabel: "crypto", sortOrder: 1, isPinned: true, note: "Core crypto benchmark" },
    { symbol: "ETH", groupLabel: "crypto", sortOrder: 2, isPinned: false, note: "Layer 1 leader" },
    { symbol: "SOL", groupLabel: "crypto", sortOrder: 3, isPinned: false, note: "High-beta alt" },
    { symbol: "NVDA", groupLabel: "stock", sortOrder: 1, isPinned: true, note: "AI semiconductor leader" },
    { symbol: "AAPL", groupLabel: "stock", sortOrder: 2, isPinned: false, note: "Mega-cap defensive tech" },
    { symbol: "TSLA", groupLabel: "stock", sortOrder: 3, isPinned: false, note: "High volatility growth stock" }
  ];

  for (const entry of watchlist) {
    const asset = assetBySymbol.get(entry.symbol);
    if (!asset) continue;

    await prisma.watchlistEntry.upsert({
      where: {
        assetId_groupLabel: {
          assetId: asset.id,
          groupLabel: entry.groupLabel
        }
      },
      update: {
        sortOrder: entry.sortOrder,
        isPinned: entry.isPinned,
        note: entry.note
      },
      create: {
        assetId: asset.id,
        groupLabel: entry.groupLabel,
        sortOrder: entry.sortOrder,
        isPinned: entry.isPinned,
        note: entry.note
      }
    });
  }
}

async function createSnapshot(assetBySymbol) {
  return prisma.marketSnapshot.create({
    data: {
      label: "seeded-home",
      capturedAt: new Date(),
      fearGreedValue: 62,
      fearGreedClassification: "Greed",
      cryptoVolumeUsd: 138000000000,
      warnings: [],
      items: {
        create: [
          { assetId: assetBySymbol.get("BTC").id, price: 87250.15, changePercent: 3.41, volume: 42000000000 },
          { assetId: assetBySymbol.get("ETH").id, price: 4620.3, changePercent: 2.28, volume: 19000000000 },
          { assetId: assetBySymbol.get("SOL").id, price: 184.44, changePercent: 4.92, volume: 8300000000 },
          { assetId: assetBySymbol.get("NVDA").id, price: 131.42, changePercent: 1.96, volume: 28600000 },
          { assetId: assetBySymbol.get("AAPL").id, price: 224.73, changePercent: -0.84, volume: 51200000 },
          { assetId: assetBySymbol.get("TSLA").id, price: 209.17, changePercent: -1.73, volume: 76800000 },
          { assetId: assetBySymbol.get("S&P 500").id, price: 5824.17, changePercent: 0.62, volume: null },
          { assetId: assetBySymbol.get("NASDAQ").id, price: 18420.54, changePercent: 0.94, volume: null }
        ]
      }
    }
  });
}

async function seedNews(snapshotId) {
  await prisma.newsArticle.createMany({
    data: [
      {
        externalId: `seed-stock-${snapshotId}`,
        source: "seed",
        category: NewsCategory.STOCK,
        title: "AI demand keeps semiconductor leaders in focus",
        summary: "Large-cap chip names continued to attract risk appetite as AI infrastructure spending stayed firm.",
        url: `https://example.com/news/${snapshotId}/stock`,
        language: "en",
        publishedAt: new Date()
      },
      {
        externalId: `seed-crypto-${snapshotId}`,
        source: "seed",
        category: NewsCategory.CRYPTO,
        title: "Bitcoin and Ethereum extend risk-on move",
        summary: "Crypto majors outperformed as traders rotated back into momentum assets ahead of macro events.",
        url: `https://example.com/news/${snapshotId}/crypto`,
        language: "en",
        publishedAt: new Date()
      },
      {
        externalId: `seed-macro-${snapshotId}`,
        source: "seed",
        category: NewsCategory.MACRO,
        title: "Markets position for fresh inflation data",
        summary: "Index traders are watching incoming inflation and Fed commentary for the next rate path signal.",
        url: `https://example.com/news/${snapshotId}/macro`,
        language: "en",
        publishedAt: new Date()
      }
    ],
    skipDuplicates: true
  });
}

async function seedEvents(snapshotId) {
  await prisma.economicEvent.createMany({
    data: [
      {
        externalId: `seed-event-fed-${snapshotId}`,
        title: "FOMC member speech",
        country: "United States",
        countryCode: "US",
        impact: EventImpact.HIGH,
        startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        displayTime: "Tomorrow 22:00",
        source: "seed"
      },
      {
        externalId: `seed-event-cpi-${snapshotId}`,
        title: "US CPI release",
        country: "United States",
        countryCode: "US",
        impact: EventImpact.HIGH,
        startsAt: new Date(Date.now() + 1000 * 60 * 60 * 48),
        displayTime: "In 2 days 21:30",
        source: "seed"
      },
      {
        externalId: `seed-event-kr-${snapshotId}`,
        title: "Korea export trend report",
        country: "South Korea",
        countryCode: "KR",
        impact: EventImpact.MEDIUM,
        startsAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
        displayTime: "In 3 days 09:00",
        source: "seed"
      }
    ],
    skipDuplicates: true
  });
}

async function seedSignals(snapshotId) {
  await prisma.marketSignal.createMany({
    data: [
      {
        externalId: "seed-signal-sol-up",
        title: "SOL momentum expansion",
        summary: "Solana is showing stronger upside acceleration than BTC and ETH in the latest seeded snapshot.",
        tone: SignalTone.UP,
        source: "seed",
        signalDate: new Date()
      },
      {
        externalId: "seed-signal-tsla-down",
        title: "Tesla remains under pressure",
        summary: "Tesla trails the broader tech tape and still looks weaker than the NASDAQ composite in this sample set.",
        tone: SignalTone.DOWN,
        source: "seed",
        signalDate: new Date()
      },
      {
        externalId: "seed-signal-macro-neutral",
        title: "Macro tone still constructive",
        summary: "Index gains and a mid-range fear and greed reading suggest a balanced but positive backdrop.",
        tone: SignalTone.NEUTRAL,
        source: "seed",
        signalDate: new Date()
      }
    ],
    skipDuplicates: true
  });
}

async function seedBriefings(snapshotId) {
  await prisma.briefing.createMany({
    data: [
      {
        externalId: "seed-briefing-morning",
        title: "Morning market briefing",
        prompt: "Summarize the current cross-asset tone.",
        summary: "Crypto remains the strongest pocket of momentum while US equities are positive but more selective.",
        marketView: "Risk appetite is positive, but leadership is concentrated in semiconductors and large-cap crypto.",
        publishedAt: new Date()
      },
      {
        externalId: "seed-briefing-macro-prep",
        title: "Macro event prep",
        prompt: "What should traders watch this week?",
        summary: "Inflation data and Fed commentary are the two most important catalysts in the next 48 hours.",
        marketView: "Stay alert around CPI timing because it can quickly reprice both growth stocks and crypto beta.",
        publishedAt: new Date(Date.now() - 1000 * 60 * 60)
      }
    ],
    skipDuplicates: true
  });
}

async function main() {
  const assetBySymbol = await upsertAssets();

  await upsertWatchlist(assetBySymbol);

  const snapshot = await createSnapshot(assetBySymbol);

  await Promise.all([
    seedNews(snapshot.id),
    seedEvents(snapshot.id),
    seedSignals(snapshot.id),
    seedBriefings(snapshot.id)
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
