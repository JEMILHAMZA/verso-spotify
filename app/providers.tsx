// app/providers.tsx
"use client"; // This directive marks this file as a Client Component

import { SessionProvider } from 'next-auth/react';
import React from 'react';

// Extend the NextAuth session type to include accessToken and error
// This is important for TypeScript to recognize these properties on the client side
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

export default function Providers({ children, session }: { children: React.ReactNode; session?: any }) {
  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  );
}