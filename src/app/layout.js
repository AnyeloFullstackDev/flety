import "./globals.css";

export const metadata = {
  title: "Flety Bot Pro",
  description: "Logística Inteligente en Tiempo Real",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
