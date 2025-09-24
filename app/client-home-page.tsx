// app/client-home-page.tsx
"use client"; // This component must be a Client Component

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import { spotifyApi } from '../utils/spotifyApi';
import SpotifyPlayer from '../components/SpotifyPlayer';
import { ArrowLeftOnRectangleIcon, UserIcon } from '@heroicons/react/24/solid';

interface Playlist {
  id: string;
  name: string;
  description?: string;
  images: { url: string }[];
  tracks: { total: number };
}

// Props can be used to receive initial data from a Server Component
interface ClientHomePageProps {
  initialSession: any; // Type this more specifically if possible
}

export default function ClientHomePage({ initialSession }: ClientHomePageProps) {
  // Use useSession without invalid options
  const { data: session, status } = useSession();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<Spotify.Track | null>(null);
  const [playbackState, setPlaybackState] = useState<Spotify.PlaybackState | null>(null);

  // Fetch Playlists
  useEffect(() => {
    const fetchPlaylists = async () => {
      if (status !== 'authenticated' || !session?.accessToken) {
        setPlaylists([]);
        return;
      }
      setIsLoadingPlaylists(true);
      setApiError(null);

      try {
        const response = await spotifyApi.get('/me/playlists', {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        });
        setPlaylists(response.data.items);
      } catch (error: any) {
        console.error('Error fetching playlists', error.response?.data || error.message);
        setApiError('Failed to load playlists. Please try again.');
        if (error.response?.status === 401) {
          // Check for specific next-auth refresh error
          if (session.error === 'RefreshAccessTokenError') {
              setApiError('Your session has expired. Please log in again.');
              signOut(); // Force re-login
          } else {
              // For other 401 errors, a simple sign out might be enough for next-auth to handle refresh
              signOut();
          }
        }
      } finally {
        setIsLoadingPlaylists(false);
      }
    };

    fetchPlaylists();
  }, [session?.accessToken, status, session?.error, signOut]);


  const handlePlaylistSelect = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
  };

  const handleTrackChange = (track: Spotify.Track | null) => {
    setCurrentPlayingTrack(track);
  };

  const handlePlaybackStateChange = (state: Spotify.PlaybackState | null) => {
    setPlaybackState(state);
  };


  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <header className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <h1 className="text-4xl font-extrabold text-green-400 mb-4 sm:mb-0">Spotify Next Player</h1>
        {status === 'authenticated' && session?.user ? (
          <div className="flex items-center space-x-3 bg-gray-800 p-2 rounded-full shadow-md">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt="User Avatar"
                width={40}
                height={40}
                className="rounded-full"
              />
            )}
            <span className="font-medium text-gray-200 hidden sm:block">{session.user.name || session.user.email}</span>
            <button
              onClick={() => signOut()}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full flex items-center space-x-2 transition-colors duration-200"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn('spotify')}
            className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-full flex items-center space-x-2 shadow-lg transition-colors duration-200"
          >
            <UserIcon className="h-6 w-6" />
            <span>Login with Spotify</span>
          </button>
        )}
      </header>

      {status === 'loading' && (
        <div className="text-center text-lg text-gray-400 animate-pulse mt-10">Loading session...</div>
      )}

      {status === 'authenticated' && (
        <main className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          {/* Playlists Section */}
          <section className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold mb-4 text-green-300">Your Playlists</h2>
            {apiError && (
              <div className="bg-red-700 p-3 rounded-md mb-4 text-red-100 font-medium">
                {apiError}
              </div>
            )}
            {isLoadingPlaylists ? (
              <div className="text-center text-gray-400 py-6 animate-pulse">Loading playlists...</div>
            ) : playlists.length === 0 ? (
              <div className="text-center text-gray-400 py-6">No playlists found.</div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {playlists.map((playlist) => (
                  <li
                    key={playlist.id}
                    className={`bg-gray-700 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer
                      ${selectedPlaylistId === playlist.id ? 'border-2 border-green-500' : 'border border-gray-600'}
                    `}
                    onClick={() => handlePlaylistSelect(playlist.id)}
                  >
                    <Image
                      src={playlist.images[0]?.url || 'https://via.placeholder.com/150'}
                      alt={playlist.name}
                      width={150}
                      height={150}
                      className="w-full h-auto object-cover rounded-t-lg"
                    />
                    <div className="p-3">
                      <h3 className="font-semibold text-lg text-white truncate">{playlist.name}</h3>
                      <p className="text-sm text-gray-400 mt-1">{playlist.tracks.total} tracks</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <style jsx>{`
              /* Custom scrollbar for better aesthetics */
              .custom-scrollbar::-webkit-scrollbar {
                width: 8px;
              }

              .custom-scrollbar::-webkit-scrollbar-track {
                background: #4a5568; /* Tailwind gray-700 */
                border-radius: 10px;
              }

              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #1db954; /* Spotify green */
                border-radius: 10px;
              }

              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #1ed760;
              }
            `}</style>
          </section>

          {/* Player Section */}
          <section>
            <SpotifyPlayer
              selectedPlaylistId={selectedPlaylistId}
              onTrackChange={handleTrackChange}
              onPlaybackStateChange={handlePlaybackStateChange}
            />
          </section>
        </main>
      )}

      {status === 'unauthenticated' && (
        <div className="text-center mt-20 p-8 bg-gray-800 rounded-lg shadow-lg max-w-xl mx-auto">
          <p className="text-xl mb-6 text-gray-300">
            Welcome! To get started, please log in with your Spotify account.
          </p>
          <button
            onClick={() => signIn('spotify')}
            className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-4 rounded-full text-lg shadow-lg transition-colors duration-200"
          >
            Login with Spotify
          </button>
        </div>
      )}
    </div>
  );
}