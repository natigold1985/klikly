export function getYouTubeEmbedUrl(url = '') {
  const trimmed = url.trim();
  if (!trimmed) return '';

  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];

  const match = patterns.map((pattern) => trimmed.match(pattern)).find(Boolean);
  const videoId = match?.[1];
  return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
}