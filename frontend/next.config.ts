import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite abrir o modo de desenvolvimento pelo celular na rede local (ex.: http://192.168.100.10:3000)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
