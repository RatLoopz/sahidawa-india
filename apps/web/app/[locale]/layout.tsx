import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import SupabaseProvider from '@/components/providers/SupabaseProvider'

export const metadata: Metadata = {
  title: 'SahiDawa',
  description: 'India\'s First Open-Source Citizen Medicine Verifier & Rural Health Bridge',
};

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <SupabaseProvider>
        {children}
      </SupabaseProvider>
    </NextIntlClientProvider>
  );
}