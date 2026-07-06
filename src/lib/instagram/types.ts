export interface DiscoveredMedia {
  sourceUrl: string;
  author?: string;
  caption?: string;
  mediaType?: string;
  likeCount?: number;
  commentCount?: number;
  timestamp?: string; // ISO
}

export interface IgAuth {
  igUserId: string;
  accessToken: string;
  username?: string;
}

export interface InstagramAdapter {
  name: string;
  /** Public media of another Business/Creator account via official business_discovery. */
  businessDiscovery(auth: IgAuth, username: string): Promise<DiscoveredMedia[]>;
  /** Top public media for a hashtag via official Hashtag Search API. */
  hashtagTopMedia(auth: IgAuth, hashtag: string): Promise<DiscoveredMedia[]>;
  /** Publish a carousel via the official Content Publishing API. Images must be public URLs. */
  publishCarousel(auth: IgAuth, imageUrls: string[], caption: string): Promise<{ id: string }>;
}
