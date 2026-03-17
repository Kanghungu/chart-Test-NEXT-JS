# TradingView 클론 프로젝트

> 실시간 암호화폐/주식 시세, 뉴스, 차트, 종합 마켓 오버뷰를 제공하는 Next.js 기반 웹앱

---

## 주요 기능

- **실시간 시세 요약**: 비트코인, 이더리움, 솔라나, 도지코인, 테슬라, 애플, 엔비디아 등 주요 자산의 실시간 가격 제공
- **뉴스 요약 및 전체 보기**: 암호화폐/주식 뉴스 요약 및 전체 뉴스 페이지 제공
- **TradingView 차트**: 주요 코인(3종)의 실시간 차트(볼린저밴드 포함) 표시
- **반응형 UI**: Tailwind CSS 기반의 반응형 디자인

## 기술 스택

- Next.js 15 (App Router)
- React 19
- TypeScript & JavaScript 혼합
- Tailwind CSS
- Prisma ORM & PostgreSQL
- Framer Motion (애니메이션)

## 폴더 구조

```
├── app/
│   ├── page.js           # 메인 홈 (시세, 뉴스, 차트 이동)
│   ├── chart/page.js     # TradingView 차트 3종
│   ├── crypto-news/      # 전체 Crypto 뉴스
│   ├── stock-news/       # 전체 Stock 뉴스
│   └── api/              # 마켓/뉴스 API 라우트
├── components/           # UI 컴포넌트 (시세, 뉴스, 차트 등)
├── prisma/schema.prisma  # DB 스키마
├── public/               # 정적 파일
```

## 실행 방법

1. 패키지 설치
	 ```bash
	 npm install
	 ```
2. 개발 서버 실행
	 ```bash
	 npm run dev
	 ```
3. 브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 환경 변수

- `.env` 파일에 아래 환경변수 필요:
	- `FINNHUB_API_KEY` (마켓 시세 API)
	- `DATABASE_URL` (PostgreSQL 연결)

## 데이터베이스

- Prisma + PostgreSQL 사용
- `prisma/schema.prisma` 참고
- 마이그레이션 예시:
	```bash
	npx prisma migrate dev
	```

## 주요 페이지/컴포넌트

- **/ (홈)**: 시세 요약, 뉴스 요약, 차트 이동 버튼
- **/chart**: TradingView 차트 3종
- **/crypto-news, /stock-news**: 전체 뉴스 목록
- **components/MarketOverview**: 실시간 시세 요약
- **components/NewsList, NewsTitle**: 뉴스 요약/전체 보기
- **components/TradingViewChart**: 실시간 차트 위젯

## 기타

- Tailwind CSS, ESLint, PostCSS, Turbopack 등 최신 Next.js 생태계 도구 사용
- Vercel 등으로 배포 가능

---
자세한 구현 및 커스텀은 각 폴더/파일 참고
