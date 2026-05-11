import "./globals.css";
import { JetBrains_Mono } from "next/font/google";
import styles from "./layout.module.css";
import HeaderBar from "@/components/layout/HeaderBar";
import FooterBar from "@/components/layout/FooterBar";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";

/* ── JetBrains Mono — next/font으로 최적화 ─────────────────────────────────
   next/font이 실제 사용된 weight만 preload하므로 "preload but not used" 경고 제거
   ─────────────────────────────────────────────────────────────────────────── */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: true,
});

export const metadata = {
  title: "Market Pulse Korea",
  description: "실시간 시세, 뉴스, 시그널을 한눈에 보는 투자 대시보드",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={jetbrainsMono.variable}>
      <head>
        {/* Pretendard Variable — KR 전용, next/font 미지원 → CDN 비동기 로드
            media=print → onload=all 패턴으로 render-blocking 방지 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          media="print"
          onLoad="this.media='all'"
        />
        {/* noscript fallback */}
        <noscript>
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          />
        </noscript>
      </head>
      <body className={styles.body}>
        <LanguageProvider>
          <div className={styles.appShell}>
            <HeaderBar />
            <main className={styles.main}>{children}</main>
            <FooterBar />
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
