// Type definitions for Blockchain Beats

export interface SongMetadata {
  id: string;
  title: string;
  artist: string;
  artistAddress: string;
  genre: string;
  price: number;
  description: string;
  hash: string;
  fileSize: number;
  artFilename: string | null;
  filename: string;
  createdAt: string;
}

export interface ArtistProfile {
  address: string;
  name: string;
  bio: string;
  totalEarned: number;
  totalWithdrawn: number;
  songs: string[];
}

export interface LabelProfile {
  owner: string;
  name: string;
  description: string;
  brandingUri: string;
  subscriptionExpires: number;
  artists: string[];
}

export interface ReferralStats {
  code: string;
  totalReferred: number;
  bonusesEarned: number;
}

export interface PurchaseEvent {
  buyer: string;
  song: string;
  amount: number;
  timestamp: number;
}

export interface PlatformStats {
  totalSongs: number;
  totalArtists: number;
  totalLabels: number;
  totalVolume: number;
}