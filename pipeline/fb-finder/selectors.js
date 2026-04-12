/**
 * Facebook DOM selectors with ordered fallback arrays.
 * FB changes their DOM frequently, so each selector has multiple options
 * tried in order until one matches.
 */

export const SELECTORS = {
  FEED_CONTAINER: [
    'div[role="feed"]',
    'div[role="main"]',
    '[data-pagelet="GroupFeed"]',
  ],

  POST_CONTAINER: [
    'div[role="article"]',
    '[data-pagelet*="FeedUnit"]',
  ],

  POST_TEXT: [
    'div[data-ad-preview="message"]',
    'div[dir="auto"][style]',
    'div[dir="auto"]',
  ],

  COMMENT_CONTAINER: [
    // Comments are nested articles within post articles
    'div[role="article"] div[role="article"]',
    'ul[role="list"] li div[role="article"]',
  ],

  COMMENT_TEXT: [
    'div[dir="auto"] span',
    'div[dir="auto"]',
  ],

  COMMENTER_LINK: [
    'a[href*="/profile.php"]',
    'a[href*="facebook.com/"][role="link"]',
    'a[href*="facebook.com/"]:not([href*="/groups/"])',
  ],

  VIEW_MORE_COMMENTS: [
    'span:has-text("View more comments")',
    'span:has-text("View previous comments")',
    'div[role="button"]:has-text("View more comments")',
  ],

  POST_TIMESTAMP: [
    'a[role="link"] span[id] > span',
    'abbr[data-utime]',
    'a[href*="/posts/"] span',
    'a[aria-label*="ago"]',
    'span[id]:has(> span)',
  ],

  GROUP_SEARCH_RESULT: [
    'div[role="article"]',
    'div[role="listitem"]',
  ],

  GROUP_NAME_IN_RESULT: [
    'a[role="presentation"] span',
    'a[href*="/groups/"] span strong',
    'a[href*="/groups/"] span',
  ],

  GROUP_MEMBER_COUNT: [
    'span:has-text("members")',
    'span:has-text("member")',
  ],
};

/**
 * Extract Facebook user ID from a profile URL.
 * Handles both numeric IDs (?id=12345) and vanity URLs (facebook.com/john.doe).
 */
export const FB_USER_ID_PATTERNS = [
  /[?&]id=(\d+)/,                           // profile.php?id=12345
  /facebook\.com\/profile\.php\?id=(\d+)/,   // full profile.php URL
  /facebook\.com\/([a-zA-Z0-9.]{5,})(?:[/?#]|$)/,  // vanity URL
];

/**
 * Try each selector in the fallback array, return the first match.
 */
export async function trySelectors(page, selectorArray, options = {}) {
  const { timeout = 5000, all = false } = options;
  for (const selector of selectorArray) {
    try {
      if (all) {
        const elements = await page.$$(selector);
        if (elements.length > 0) return elements;
      } else {
        const element = await page.waitForSelector(selector, { timeout });
        if (element) return element;
      }
    } catch {
      // Try next selector
    }
  }
  return all ? [] : null;
}

/**
 * Extract FB user ID or vanity name from a profile URL.
 */
export function extractFbUserId(profileUrl) {
  if (!profileUrl) return null;
  for (const pattern of FB_USER_ID_PATTERNS) {
    const match = profileUrl.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Parse relative timestamps from FB ("2h", "1d", "3w", "Just now", "Yesterday").
 * Returns a Date or null if unparseable.
 */
export function parseRelativeTimestamp(text) {
  if (!text) return null;
  const now = new Date();
  const cleaned = text.trim().toLowerCase();

  if (cleaned === "just now" || cleaned === "now") return now;
  if (cleaned === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }

  const match = cleaned.match(/^(\d+)\s*(m|min|h|hr|d|w|mo|y)/);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const unit = match[2];
  const d = new Date(now);

  switch (unit) {
    case "m":
    case "min":
      d.setMinutes(d.getMinutes() - num);
      break;
    case "h":
    case "hr":
      d.setHours(d.getHours() - num);
      break;
    case "d":
      d.setDate(d.getDate() - num);
      break;
    case "w":
      d.setDate(d.getDate() - num * 7);
      break;
    case "mo":
      d.setMonth(d.getMonth() - num);
      break;
    case "y":
      d.setFullYear(d.getFullYear() - num);
      break;
    default:
      return null;
  }
  return d;
}
