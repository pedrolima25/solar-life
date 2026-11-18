import type { MetadataRoute } from "next";

/** Permite "Adicionar à tela inicial" no celular, abrindo como aplicativo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Solar Life",
    short_name: "Solar Life",
    description: "Gestão de energia solar e serviços elétricos",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b1120",
    theme_color: "#0b1120",
    icons: [{ src: "/logo-solar-life.png", sizes: "245x230", type: "image/png", purpose: "any" }],
  };
}
