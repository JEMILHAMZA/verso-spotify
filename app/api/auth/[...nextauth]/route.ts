// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from 'next-auth';
import SpotifyProvider from 'next-auth/providers/spotify';

// Define the scopes required for Spotify Web API and Web Playback SDK
const scopes = [
  'user-read-email',
  'user-read-private',
  'user-library-read',
  'user-top-read',
  'user-read-playback-state', // Required for Web Playback SDK
  'user-modify-playback-state', // Required for Web Playback SDK (play, pause, next, prev)
  'user-read-currently-playing', // Required for Web Playback SDK
  'app-remote-control', // Recommended for Web Playback SDK
  'streaming', // Essential for Web Playback SDK
  'playlist-read-private',
  'playlist-read-collaborative',
].join(',');

export const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: `https://accounts.spotify.com/authorize?scope=${scopes}`,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        return {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at, // Spotify returns expiry in seconds
          user,
        };
      }

      // Return previous token if the access token has not expired yet
      // expires_at is in seconds since epoch, Date.now() is in milliseconds
      if (token.expiresAt && Date.now() < (token.expiresAt as number) * 1000) {
        return token;
      }

      // Access token has expired, try to refresh it
      try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken as string,
          }),
        });

        const refreshedTokens = await response.json();

        if (!response.ok) {
          throw refreshedTokens;
        }

        return {
          ...token,
          accessToken: refreshedTokens.access_token,
          // Spotify returns expires_in in seconds, convert to epoch time
          expiresAt: Math.floor(Date.now() / 1000) + refreshedTokens.expires_in,
          refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fallback to old refresh token if new one isn't provided
        };
      } catch (error) {
        console.error('Error refreshing access token', error);
        // If refresh fails, indicate an error
        return { ...token, error: 'RefreshAccessTokenError' };
      }
    },
    async session({ session, token }) {
      // Add access token and error to the session object
      session.accessToken = token.accessToken;
      session.error = token.error as 'RefreshAccessTokenError' | null;
      session.user = token.user; // Include user data from the JWT token

      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

// Extend next-auth JWT types if needed for better type safety
declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    error?: 'RefreshAccessTokenError' | null;
  }
}