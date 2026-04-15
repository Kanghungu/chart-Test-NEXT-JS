# Market Pulse Korea

Next.js based market dashboard focused on Korean stocks, US stocks, charts, news, and macro context.

## Features

- Real-time market overview for KOSPI, KOSDAQ, S&P 500, and NASDAQ
- Separate news flows for Korean stocks and US stocks
- TradingView chart dashboard for Korea, US, and macro symbols
- Watchlist and signal screens tuned for Korea and US equities
- Prisma + PostgreSQL backed dashboard data

## Stack

- Next.js 15
- React 19
- TypeScript and JavaScript
- Prisma ORM
- PostgreSQL
- Framer Motion

## App Structure

```text
app/
  page.js
  chart/
  korea-news/
  stock-news/
  watchlist/
  signals/
  briefing/
  calendar/
  api/
components/
prisma/
public/
```

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

- `DATABASE_URL`
- `DIRECT_URL`
- `OPENAI_API_KEY`

## Database

Run migrations and generate the Prisma client:

```bash
npx prisma migrate dev
npx prisma generate
```
