import { YOUTUBE_CONFIG } from '../config/api';

export interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  duration: number;
}

// This is a utility function, we are not exporting it
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

export async function searchYouTubeVideos(query: string): Promise<YouTubeVideo[]> {
  const apiKey = YOUTUBE_CONFIG.API_KEY;
  
  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }

  // Search for videos
  const searchResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/search?` +
    `part=snippet&` +
    `q=${encodeURIComponent(query)}&` +
    `type=video&` +
    `videoCategoryId=10&` + // Music category
    `videoEmbeddable=true&` + // ✅ DODAJ OVO!
    `maxResults=20&` +
    `key=${apiKey}`
  );

  if (!searchResponse.ok) {
    throw new Error('Failed to search YouTube videos');
  }

  const searchData = await searchResponse.json();
  const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

  // Get video details including duration
  const detailsResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${apiKey}`
  );

  if (!detailsResponse.ok) {
    throw new Error('Failed to get video details');
  }

  const detailsData = await detailsResponse.json();
  
  console.log('YouTube search successful, found', detailsData.items.length, 'videos');
  
  // LOG FIRST RESULT TO SEE THUMBNAIL STRUCTURE
  if (detailsData.items.length > 0) {
    console.log('First video sample:', {
      title: detailsData.items[0].snippet.title,
      thumbnails: detailsData.items[0].snippet.thumbnails,
      thumbnail: detailsData.items[0].snippet.thumbnails?.medium?.url || 
                 detailsData.items[0].snippet.thumbnails?.default?.url ||
                 detailsData.items[0].snippet.thumbnails?.high?.url
    });
  }

  return detailsData.items.map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url || 
                  item.snippet.thumbnails?.default?.url ||
                  item.snippet.thumbnails?.high?.url ||
                  '', // FALLBACK to empty string if no thumbnail
    duration: parseDuration(item.contentDetails.duration),
  }));
}

export function formatDuration(seconds: number): string {
  if (seconds === 0) return '--:--';

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
