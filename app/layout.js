import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "My Next App",
  description: "나만의 거래소 블로그",
};

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: "1rem", background: "#000000" }}>
          <h1>나만의 거래소 블로그</h1>
        </header>
        <main>{children}</main>
        <footer style={{ padding: "1rem", background: "#000000" }}>
          © 2025 My Blog
        </footer>
      </body>
    </html>
  );
}
