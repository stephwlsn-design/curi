/** Client-side Grow+ labels — catalog loaded from GET /api/grow/catalog */

export const GROW_PLATFORM_META = {
  instagram: { label: 'Instagram', className: 'bg-curi-pink/15 text-curi-pink' },
  facebook: { label: 'Facebook', className: 'bg-curi-blue/15 text-curi-blue' },
  youtube: { label: 'YouTube', className: 'bg-red-500/15 text-red-500' },
  tiktok: { label: 'TikTok', className: 'bg-theme-subtle/10 text-theme-text' },
  linkedin: { label: 'LinkedIn', className: 'bg-[#0A66C2]/15 text-[#0A66C2]' },
  twitter: { label: 'X', className: 'bg-theme-subtle/10 text-theme-text' },
  pinterest: { label: 'Pinterest', className: 'bg-red-400/15 text-red-400' },
  threads: { label: 'Threads', className: 'bg-theme-subtle/10 text-theme-text' },
};

export const formatGrowPrice = (usd, inr) => {
  if (usd == null) return `From ₹${(inr || 0).toLocaleString('en-IN')}+`;
  return `$${usd} · ₹${(inr || 0).toLocaleString('en-IN')}`;
};
