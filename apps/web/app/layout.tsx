import '../app/[locale]/globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}