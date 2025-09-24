// components/SpotifyPlayer.tsx
"use client"; // This component must be a Client Component

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import {
  PlayIcon,
  PauseIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/solid';
import { spotifyApi } from '../utils/spotifyApi'; // Your Axios instance for Spotify API

// Extend the Window interface to include Spotify type
declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: (() => void) | undefined; // Make it optional
  }
}

interface SpotifyPlayerProps {
  selectedPlaylistId: string | null;
  onTrackChange: (track: Spotify.Track | null) => void;
  onPlaybackStateChange: (state: Spotify.PlaybackState | null) => void;
}

const SpotifyPlayer: React.FC<SpotifyPlayerProps> = ({
  selectedPlaylistId,
  onTrackChange,
  onPlaybackStateChange,
}) => {
  const { data: session, status } = useSession();
  const [player, setPlayer] = useState<Spotify.Player | undefined>(undefined);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<Spotify.Track | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(true);

  // Ref to keep track of the current token for SDK initialization and callbacks
  const accessTokenRef = useRef<string | null>(null);
  // Ref to prevent multiple SDK initializations
  const playerInitialized = useRef(false);

  useEffect(() => {
    if (session?.accessToken) {
      accessTokenRef.current = session.accessToken;
    } else {
      accessTokenRef.current = null;
    }
  }, [session?.accessToken]);

  // --- SDK Initialization ---
  useEffect(() => {
    // Only attempt to initialize if authenticated, SDK script is loaded, and not already initialized
    if (status !== 'authenticated' || !accessTokenRef.current || playerInitialized.current) {
      if (player && status !== 'authenticated') {
        player.disconnect();
        setPlayer(undefined);
        setPlayerLoading(false);
      }
      return;
    }

    // Function to handle SDK readiness
    const initializeSpotifyPlayer = () => {
      if (!accessTokenRef.current || !window.Spotify || playerInitialized.current) {
        return;
      }

      setPlayerLoading(true);
      setPlaybackError(null); // Clear previous errors

      // Disconnect any old player instance if it exists
      if (player) {
        player.disconnect();
        setPlayer(undefined);
      }

      const playerInstance = new window.Spotify.Player({
        name: 'Next.js Spotify Player',
        getOAuthToken: (cb: (token: string) => void) => {
          // Provide the latest access token to the SDK
          if (accessTokenRef.current) {
            cb(accessTokenRef.current);
          } else {
            console.error('No access token available for Spotify Player. Forcing re-login.');
            setPlaybackError('Authentication required to initialize player.');
            signOut();
          }
        },
        volume: 0.5,
      });

  playerInstance.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('Ready with Device ID', device_id);
        setDeviceId(device_id);
        setPlayer(playerInstance);
        setPlayerLoading(false);
        playerInitialized.current = true; // Mark as initialized
      });

  playerInstance.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('Device ID has gone offline', device_id);
        setDeviceId(null);
        setPlayerLoading(false);
        setPlaybackError('Spotify device is offline or unavailable. Ensure Spotify is running.');
      });

  playerInstance.addListener('player_state_changed', (state: Spotify.PlaybackState) => {
        if (!state) return;
        setIsPaused(state.paused);
        setCurrentTrack(state.track_window.current_track);
        onTrackChange(state.track_window.current_track);
        onPlaybackStateChange(state);

  if (state.disallows?.playing_restrictions && state.disallows.playing_restrictions.reason === 'PREMIUM_REQUIRED') {
            setPlaybackError('Spotify Premium required for playback.');
        } else {
            // Clear premium error if it was previously set and state changes
            if (playbackError === 'Spotify Premium required for playback.') {
                setPlaybackError(null);
            }
        }
      });

  playerInstance.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('Failed to initialize player', message);
        setPlaybackError(`Initialization Error: ${message}.`);
        setPlayerLoading(false);
        playerInitialized.current = false; // Allow re-initialization attempt
      });
  playerInstance.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('Authentication error', message);
        setPlaybackError(`Authentication Error: ${message}. Please re-login.`);
        setPlayerLoading(false);
        playerInitialized.current = false;
        signOut();
      });
  playerInstance.addListener('account_error', ({ message }: { message: string }) => {
        console.error('Account error', message);
        setPlaybackError(`Account Error: ${message}.`);
        setPlayerLoading(false);
        playerInitialized.current = false;
      });
  playerInstance.addListener('playback_error', ({ message }: { message: string }) => {
        console.error('Playback error', message);
        setPlaybackError(`Playback Error: ${message}.`);
        setPlayerLoading(false);
      });

      playerInstance.connect();
    };

    // Set up the global callback for SDK readiness
    if (window.Spotify && !window.onSpotifyWebPlaybackSDKReady) {
      window.onSpotifyWebPlaybackSDKReady = initializeSpotifyPlayer;
    }

    // If SDK is already loaded (e.g., fast refresh or script loaded before component)
    // and the global callback hasn't fired yet (or needs to be re-triggered for new token)
    if (window.Spotify && accessTokenRef.current && !playerInitialized.current) {
        initializeSpotifyPlayer();
    }

    // Cleanup function
    return () => {
      if (player) {
        player.disconnect();
        setPlayer(undefined);
      }
      setDeviceId(null);
      setCurrentTrack(null);
      onTrackChange(null);
      onPlaybackStateChange(null);
      playerInitialized.current = false; // Reset for potential re-initialization
      // Clean up the global event handler to avoid multiple assignments
      if (window.onSpotifyWebPlaybackSDKReady === initializeSpotifyPlayer) {
          window.onSpotifyWebPlaybackSDKReady = undefined;
      }
    };
  }, [status, session?.accessToken, signOut, player]); // Re-run if auth status or token changes or player instance changes

  // --- Fetch Tracks for Selected Playlist ---
  useEffect(() => {
    const fetchPlaylistTracks = async () => {
      if (!selectedPlaylistId || !session?.accessToken) {
        setTracks([]);
        return;
      }
      setIsLoadingTracks(true);
      setPlaybackError(null); // Clear previous errors

      try {
        const response = await spotifyApi.get(`/playlists/${selectedPlaylistId}/tracks`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
          params: {
            limit: 50, // Fetch a reasonable number of tracks
          },
        });
        // Filter out null tracks (e.g., local files in Spotify)
        setTracks(response.data.items.map((item: any) => item.track).filter(Boolean));
      } catch (error: any) {
        console.error('Error fetching playlist tracks', error.response?.data || error.message);
        setPlaybackError('Failed to load playlist tracks. Please try again.');
        if (error.response?.status === 401) {
          signOut(); // Token expired or invalid
        }
      } finally {
        setIsLoadingTracks(false);
      }
    };
    fetchPlaylistTracks();
  }, [selectedPlaylistId, session?.accessToken, signOut]);


  // --- Playback Controls ---
  const playTrack = async (trackUri: string) => {
    if (!player || !deviceId || !session?.accessToken) {
      setPlaybackError('Player not ready or not authenticated.');
      return;
    }
    if (playbackError === 'Spotify Premium required for playback.') {
        return; // Do not attempt to play if premium is required
    }

    try {
      // Step 1: Transfer playback to the Web Playback SDK device
      // This is crucial to ensure the SDK can control the playback.
      await spotifyApi.put(
        '/me/player',
        {
          device_ids: [deviceId],
          play: true, // Start playing on this device
        },
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Step 2: Start playing the specific track on the active device
      await spotifyApi.put(
        `/me/player/play?device_id=${deviceId}`,
        {
          uris: [trackUri],
        },
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error: any) {
      console.error('Error playing track', error.response?.data || error.message);
      setPlaybackError(`Failed to play track: ${error.response?.data?.error?.message || error.message}.`);
      if (error.response?.status === 401) {
        signOut();
      }
    }
  };

  const togglePlayPause = () => {
    player?.togglePlay();
  };

  const skipNext = () => {
    player?.nextTrack();
  };

  const skipPrevious = () => {
    player?.previousTrack();
  };

  // --- Render Logic ---
  if (status !== 'authenticated') {
    return (
      <div className="bg-gray-800 text-white p-4 text-center rounded-lg shadow-lg">
        <p className="text-lg">Please log in to Spotify to use the player.</p>
      </div>
    );
  }

  if (playerLoading) {
    return (
      <div className="bg-gray-800 text-white p-4 text-center rounded-lg shadow-lg">
        <p className="text-lg animate-pulse">Initializing Spotify Player...</p>
        <p className="text-sm text-gray-400 mt-2">
          Make sure to have Spotify open in another tab or application for faster connection.
        </p>
      </div>
    );
  }

  if (!player || !deviceId) {
    return (
      <div className="bg-gray-800 text-white p-4 text-center rounded-lg shadow-lg">
        <p className="text-lg text-red-400">Spotify Player connection failed or device not ready.</p>
        {playbackError && <p className="text-sm text-red-300 mt-2">{playbackError}</p>}
        <p className="text-sm text-gray-400 mt-2">
          Please refresh the page or ensure Spotify is open and you have a Premium account.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 text-white p-6 rounded-lg shadow-xl w-full max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-green-400">Spotify Web Player</h2>

      {playbackError && (
        <div className="bg-red-700 p-3 rounded-md mb-4">
          <p className="text-red-100 font-medium">{playbackError}</p>
          {playbackError === 'Spotify Premium required for playback.' && (
              <p className="text-sm text-red-200 mt-1">Full playback features are only available with a Spotify Premium account.</p>
          )}
        </div>
      )}

      {/* Current Track Display */}
      {currentTrack ? (
        <div className="flex items-center space-x-4 mb-6 bg-gray-700 p-3 rounded-md">
          <Image
            src={currentTrack.album?.images?.[0]?.url || 'https://via.placeholder.com/64'}
            alt="Album Art"
            width={80}
            height={80}
            className="rounded-lg shadow-md"
          />
          <div className="flex-grow">
            <p className="text-xl font-semibold text-white truncate">{currentTrack.name}</p>
            <p className="text-md text-gray-300 truncate">{currentTrack.artists?.[0]?.name || 'Unknown Artist'}</p>
            <p className="text-sm text-gray-400 truncate">{currentTrack.album?.name || 'Unknown Album'}</p>
          </div>
        </div>
      ) : (
        <div className="mb-6 bg-gray-700 p-3 rounded-md text-center">
          <p className="text-gray-300">No track currently playing.</p>
          <p className="text-sm text-gray-400">Select a playlist and click a track to start.</p>
        </div>
      )}

      {/* Playback Controls */}
      <div className="flex justify-center items-center space-x-6 mb-8">
        <button
          onClick={skipPrevious}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous track"
          disabled={playbackError === 'Spotify Premium required for playback.'}
        >
          <ChevronDoubleLeftIcon className="h-7 w-7 text-white" />
        </button>
        <button
          onClick={togglePlayPause}
          className="p-4 rounded-full bg-green-500 hover:bg-green-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isPaused ? 'Play' : 'Pause'}
          disabled={playbackError === 'Spotify Premium required for playback.'}
        >
          {isPaused ? (
            <PlayIcon className="h-9 w-9 text-white" />
          ) : (
            <PauseIcon className="h-9 w-9 text-white" />
          )}
        </button>
        <button
          onClick={skipNext}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next track"
          disabled={playbackError === 'Spotify Premium required for playback.'}
        >
          <ChevronDoubleRightIcon className="h-7 w-7 text-white" />
        </button>
      </div>

      {/* Playlist Tracks List */}
      <h3 className="text-xl font-bold mb-3 text-green-300">Playlist Tracks</h3>
      {isLoadingTracks ? (
        <div className="text-center text-gray-400 py-4 animate-pulse">Loading tracks...</div>
      ) : tracks.length === 0 ? (
        <div className="text-center text-gray-400 py-4">
          {selectedPlaylistId ? 'No playable tracks found in this playlist.' : 'Please select a playlist.'}
        </div>
      ) : (
        <ul className="mt-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
          {tracks.map((track) => (
            <li
              key={track.id}
              className={`flex items-center space-x-3 py-3 px-2 rounded-md mb-2 cursor-pointer
                ${currentTrack?.id === track.id ? 'bg-green-700' : 'bg-gray-700 hover:bg-gray-600'}
                transition-colors duration-200`}
              onClick={() => playTrack(track.uri)}
            >
              <Image
                src={track.album?.images?.[2]?.url || 'https://via.placeholder.com/32'}
                alt="Album Art"
                width={40}
                height={40}
                className="rounded-md"
              />
              <div className="flex-grow">
                <p className="text-sm font-medium text-white truncate">{track.name}</p>
                <p className="text-xs text-gray-300 truncate">{track.artists?.[0]?.name || 'Unknown Artist'}</p>
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
    </div>
  );
};

export default SpotifyPlayer;