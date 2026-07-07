import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk' });

export const metadata = {
  title: 'Taste Cartography — Movies that match your mood',
  description: 'A movie recommender with emotional intelligence. Discover films by mood, track your library, and find where to stream in your region.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${grotesk.variable} font-sans antialiased bg-[#0a0a0f] text-zinc-100`}>{children}</body>
    </html>
  );
}
