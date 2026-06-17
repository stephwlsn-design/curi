const axios = require('axios');

const PHOTOS_BASE = 'https://api.pexels.com/v1';
const VIDEOS_BASE = 'https://api.pexels.com/videos';

const authHeaders = () => {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) {
    throw new Error('PEXELS_API_KEY is not configured');
  }
  return { Authorization: key };
};

const pickPhoto = (photo) => ({
  id: photo.id,
  type: 'photo',
  url: photo.src?.large2x || photo.src?.large || photo.src?.original,
  thumbnailUrl: photo.src?.medium || photo.src?.small,
  width: photo.width,
  height: photo.height,
  photographer: photo.photographer,
  photographerUrl: photo.photographer_url,
  alt: photo.alt || '',
});

const pickVideoFile = (video) => {
  const mp4 = (video.video_files || [])
    .filter((f) => f.file_type === 'video/mp4' && f.width)
    .sort((a, b) => (b.width || 0) - (a.width || 0));
  return mp4[0] || video.video_files?.[0];
};

const pickVideo = (video) => {
  const file = pickVideoFile(video);
  return {
    id: video.id,
    type: 'video',
    url: file?.link,
    width: file?.width,
    height: file?.height,
    thumbnailUrl: video.image,
    duration: video.duration,
    photographer: video.user?.name,
    photographerUrl: video.user?.url,
  };
};

const searchPhotos = async ({ query, page = 1, perPage = 20 }) => {
  const params = { page, per_page: Math.min(perPage, 40) };
  const path = query?.trim()
    ? `${PHOTOS_BASE}/search`
  : `${PHOTOS_BASE}/curated`;
  if (query?.trim()) params.query = query.trim();

  const { data } = await axios.get(path, { headers: authHeaders(), params, timeout: 12000 });
  return {
    items: (data.photos || []).map(pickPhoto),
    page: data.page,
    perPage: data.per_page,
    total: data.total_results ?? data.photos?.length ?? 0,
    nextPage: data.next_page,
  };
};

const searchVideos = async ({ query, page = 1, perPage = 15 }) => {
  const params = { page, per_page: Math.min(perPage, 40) };
  const path = query?.trim()
    ? `${VIDEOS_BASE}/search`
    : `${VIDEOS_BASE}/popular`;
  if (query?.trim()) params.query = query.trim();

  const { data } = await axios.get(path, { headers: authHeaders(), params, timeout: 12000 });
  return {
    items: (data.videos || []).map(pickVideo).filter((v) => v.url),
    page: data.page,
    perPage: data.per_page,
    total: data.total_results ?? data.videos?.length ?? 0,
    nextPage: data.next_page,
  };
};

module.exports = { searchPhotos, searchVideos, pickPhoto, pickVideo };
