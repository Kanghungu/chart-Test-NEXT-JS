import "./globals.css";

export const metadata = {
  title: "Project Chart",
  description: "나만의 거래소 블로그",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: "1rem", background: "#000000" }}>
          <h1 className="text-3xl font-bold text-center">GUGU CHART</h1>
        </header>
        <main>{children}</main>
        <footer style={{ padding: "1rem", background: "#000000" }}>
          © 2025.09.01 ~ 2025.10.15 Hungu Blog
        </footer>
      </body>
    </html>
  );
}
