declare namespace Spotify {
  interface Track {
    id: string;
    name: string;
    album?: {
      name?: string;
      images?: { url: string }[];
    };
    artists?: { name?: string }[];
    uri?: string;
    // Add other properties as needed
  }

  interface PlaybackState {
    paused: boolean;
    track_window: {
      current_track: Track;
      previous_tracks?: Track[];
      next_tracks?: Track[];
    };
    disallows?: {
      playing_restrictions?: {
        reason?: string;
      };
    };
    // Add other properties as needed
  }

  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    togglePlay(): void;
    nextTrack(): void;
    previousTrack(): void;
    addListener(event: string, callback: (...args: any[]) => void): void;
    removeListener(event: string, callback?: (...args: any[]) => void): void;
    // Add other methods/properties as needed
  }
}
