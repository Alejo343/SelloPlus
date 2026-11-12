import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Sello Fiel',
  description: 'Tu tarjeta de sellos digital',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
