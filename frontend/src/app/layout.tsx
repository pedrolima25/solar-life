import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1120" };

export const metadata: Metadata = {
  // Endereço público do site (usado na prévia dos links no WhatsApp). Ex.: https://app.solarlife.com.br
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Solar Life — Gestão de Energia Solar e Serviços Elétricos",
  description: "Sistema de gestão para empresas de energia solar, manutenção e serviços elétricos.",
  appleWebApp: { capable: true, title: "Solar Life", statusBarStyle: "black-translucent" },
};

const themeScript = `try{if(localStorage.getItem('theme')!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
