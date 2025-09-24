// app/page.tsx
import { getServerSession } from "next-auth"; // For server-side session fetching
import { authOptions } from './api/auth/[...nextauth]/route'; // Correct path to authOptions
import ClientHomePage from './client-home-page'; // This will be your "use client" component

export default async function HomePage() {
  // Fetch session server-side for initial render if desired
  // This reduces initial load time for authenticated content by hydrating the client
  const session = await getServerSession(authOptions);

  // Pass the initial session data to the client component
  // The client component will then use useSession, which will hydrate from this data
  return <ClientHomePage initialSession={session} />;
}
