import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import './globals.css';

export const metadata: Metadata = {
  title: 'SahiDawa — Verify Your Medicine',
  description:
    "India's first open-source medicine verification platform. Scan, verify, and trust your medicines.",
  openGraph: {
    title: 'SahiDawa — Verify Your Medicine',
    description:
      "India's first open-source medicine verification platform. Scan, verify, and trust your medicines.",
    url: 'https://sahidawa.in',
    siteName: 'SahiDawa',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SahiDawa — Verify Your Medicine',
    description:
      "India's first open-source medicine verification platform. Scan, verify, and trust your medicines.",
  },
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
