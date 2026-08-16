import './globals.css';

export const metadata = {
  title: 'Government of India | Ministry of Petroleum & Natural Gas - Secure Tender System',
  description: 'Indian Oil PSUs Permissioned Blockchain E-Tendering System (GIGW Compliant)',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100..700;1,100..700&family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body class="bg-background text-on-background font-body-md antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
