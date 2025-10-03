// src/lib/forum-ranks.ts - Automatic rank system based on post count

export interface ForumRank {
  name: string;
  minPosts: number;
  color: string; // Tailwind color classes
  icon?: string; // Optional emoji or icon
}

/**
 * Forum rank tiers based on post count
 * These are displayed automatically alongside user roles
 */
export const FORUM_RANKS: ForumRank[] = [
  { name: 'Newbie', minPosts: 0, color: 'bg-gray-500/20 text-gray-400' },
  { name: 'Member', minPosts: 10, color: 'bg-blue-500/20 text-blue-400' },
  { name: 'Regular', minPosts: 50, color: 'bg-green-500/20 text-green-400' },
  { name: 'Veteran', minPosts: 100, color: 'bg-cyan-500/20 text-cyan-400' },
  { name: 'Elder', minPosts: 250, color: 'bg-purple-500/20 text-purple-400' },
  { name: 'Legend', minPosts: 500, color: 'bg-purple-500/20 text-purple-400' },
  { name: 'Hero', minPosts: 1000, color: 'bg-violet-500/20 text-violet-400' },
  { name: 'Champion', minPosts: 2500, color: 'bg-pink-500/20 text-pink-400' },
];

/**
 * Get the appropriate rank based on post count
 */
export function getRankForPostCount(postCount: number): ForumRank {
  // Start from highest rank and work down to find the first match
  for (let i = FORUM_RANKS.length - 1; i >= 0; i--) {
    if (postCount >= FORUM_RANKS[i].minPosts) {
      return FORUM_RANKS[i];
    }
  }
  return FORUM_RANKS[0]; // Default to lowest rank
}

/**
 * Get HTML for rank badge
 */
export function getRankBadgeHTML(postCount: number): string {
  const rank = getRankForPostCount(postCount);
  return `<span class="inline-block px-2 py-0.5 ${rank.color} text-xs font-semibold rounded">${rank.name.toUpperCase()}</span>`;
}

/**
 * Get small rank badge HTML (for thread lists)
 */
export function getSmallRankBadgeHTML(postCount: number): string {
  const rank = getRankForPostCount(postCount);
  return `<span class="px-1.5 py-0.5 ${rank.color} text-xs font-semibold rounded">${rank.name.toUpperCase()}</span>`;
}
