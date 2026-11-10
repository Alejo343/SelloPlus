import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Las pruebas de punta a punta pegan al servidor de desarrollo por 127.0.0.1.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
