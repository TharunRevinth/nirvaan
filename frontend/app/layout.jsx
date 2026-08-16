import './globals.css';

export const metadata = {
  title: 'Indian Oil PSUs Blockchain E-Tendering System',
  description: 'Permissioned Consortium Blockchain E-Tendering System for Indian Oil Sector',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
