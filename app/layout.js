import "./globals.css";
import Link from "next/link";
import styles from "./layout.module.css";

export const metadata = {
  title: "Market Pulse Korea",
  description:
    "\uC2E4\uC2DC\uAC04 \uC2DC\uC138, \uB274\uC2A4, \uC2DC\uADF8\uB110\uC744 \uD55C\uB208\uC5D0 \uBCF4\uB294 \uD22C\uC790 \uB300\uC2DC\uBCF4\uB4DC"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={styles.body}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.brand}>
              <Link href="/" className={styles.brandLink}>
                Market Pulse Korea
              </Link>
              <p className={styles.brandDescription}>
                {"\uC2E4\uC2DC\uAC04 \uAC00\uACA9 \u00B7 \uB274\uC2A4 \u00B7 \uC2DC\uADF8\uB110 \uB300\uC2DC\uBCF4\uB4DC"}
              </p>
            </div>

            <div className={styles.nav}>
              <Link href="/" className={styles.navLink}>
                {"\uD648"}
              </Link>
              <Link href="/chart" className={styles.navLink}>
                {"\uCC28\uD2B8"}
              </Link>
              <span className={styles.liveBadge}>LIVE</span>
            </div>
          </div>
        </header>

        <main className={styles.main}>{children}</main>

        <footer className={styles.footer}>2025.09.01 ~ 2025.10.15 Hungu Blog</footer>
      </body>
    </html>
  );
}
