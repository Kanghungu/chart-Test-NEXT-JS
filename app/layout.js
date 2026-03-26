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
