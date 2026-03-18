import "./globals.css";

export const metadata = {
  title: "GUGU CHART",
  description: "Real-time chart and news dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100">
        <header style={{ padding: "1rem", background: "#000000" }}>
          <h1 className="text-3xl font-bold text-center">GUGU CHART</h1>
        </header>
        <main>{children}</main>
        <footer style={{ padding: "1rem", background: "#000000" }} className="text-center text-gray-300">
          2025.09.01 ~ 2025.10.15 Hungu Blog
        </footer>
      </body>
    </html>
  );
}
