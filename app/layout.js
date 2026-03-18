import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Market Pulse Korea",
  description: "실시간 시세, 뉴스, 시그널을 한눈에 보는 투자 대시보드",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100">
        <header className="border-b border-slate-800 bg-black/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4">
            <div className="flex flex-col">
              <Link href="/" className="text-2xl font-extrabold tracking-tight text-white">
                Market Pulse Korea
              </Link>
              <p className="text-xs text-slate-400">실시간 가격 · 뉴스 · 시그널 대시보드</p>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/"
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                홈
              </Link>
              <Link
                href="/chart"
                className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                차트
              </Link>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                LIVE
              </span>
            </div>
          </div>
        </header>
        <main>{children}</main>
        <footer style={{ padding: "1rem", background: "#000000" }} className="text-center text-gray-300">
          2025.09.01 ~ 2025.10.15 Hungu Blog
        </footer>
      </body>
    </html>
  );
}
