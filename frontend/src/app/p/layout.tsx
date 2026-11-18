import type { Metadata } from "next";

// Prévia que aparece quando o link é colado no WhatsApp
export const metadata: Metadata = {
  title: "Sua proposta de energia solar — Solar Life",
  description: "Veja quanto você vai economizar na conta de luz com energia solar.",
  openGraph: {
    title: "Sua proposta de energia solar ☀️",
    description: "Veja quanto você vai economizar na conta de luz com energia solar.",
    images: [{ url: "/logo-solar-life.png", width: 245, height: 230 }],
    type: "website",
    locale: "pt_BR",
  },
  robots: { index: false, follow: false }, // não aparece no Google
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
