// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Providers from './providers'; // Client component for SessionProvider
import { getServerSession } from 'next-auth'; // For server-side session in RSC
import { authOptions } from './api/auth/[...nextauth]/route'; // Ensure correct path to authOptions

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Spotify Next Player',
  description: 'A music player app using Next.js and Spotify Web Playback SDK',
};

// Extend the NextAuth session type for TypeScript in the server
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: 'RefreshAccessTokenError' | null;
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}


export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch session on the server for initial hydration of next-auth's client SessionProvider
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <head>
        {/* You can put the SDK script here too, but body is also common for external scripts */}
      </head>
      <body className={`${inter.className} antialiased`}>
        {/* Providers (e.g., NextAuth SessionProvider) must be a client component */}
        <Providers session={session}> {/* Pass initial session for hydration */}
          {children}
        </Providers>
        {/* Spotify Web Playback SDK script */}
        {/* It's often safer to load this after the main app content has rendered,
            or dynamically within a client component that specifically uses it.
            For global availability, placing it here is common.
            The `async` and `defer` attributes are important.
        */}
        <script src="https://sdk.scdn.co/spotify-player.js" async defer></script>
      </body>
    </html>
  );
}