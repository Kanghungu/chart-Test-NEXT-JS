import "./globals.css";
import styles from "./layout.module.css";
import HeaderBar from "@/components/layout/HeaderBar";
import FooterBar from "@/components/layout/FooterBar";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";

export const metadata = {
  title: "Market Pulse Korea",
  description: "실시간 시세, 뉴스, 시그널을 한눈에 보는 투자 대시보드"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        {/* Preconnect for faster font fetch */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        {/* Pretendard Variable — dynamic subset (KR + Latin, ~200KB vs 1MB full) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* JetBrains Mono for tabular numerics (prices, clocks) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
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
