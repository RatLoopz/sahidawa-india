import type { Metadata } from 'next';
import NetworkStatus from '@/components/NetworkStatus';
import './globals.css';

export const metadata: Metadata = {
  title: 'SahiDawa',
  description: "India's Medicine Verifier",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <NetworkStatus />
        {children}
      </body>
    </html>
  );
}