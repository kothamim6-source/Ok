/**
 * Utilities for cleaning, repairing, and decoding Bengali (Bangla) & English
 * text scraped from Blogger, Blogspot RSS/JSONP feeds, meta tags, and WebViews.
 *
 * Handles:
 * 1. Double & single HTML entities (&#2477;, &#x09ac;, &amp;#2477;, &nbsp;, etc.)
 * 2. Unicode escape sequences (\u09ac\u09be\u0982\u09b2\u09be, \\u09ac...)
 * 3. UTF-8 Mojibake (e.g. à¦¬à¦¾à¦‚à¦²à¦¾ -> বাংলা)
 * 4. URL percent-encoding (%E0%A6%AC%E0%A6%BE...)
 * 5. Whitespace and newline normalization
 */

/**
 * Mapping of Windows-1252 special characters (0x80 - 0x9F) back to their original byte values.
 * This fixes cases where Bengali UTF-8 characters were interpreted as Windows-1252 (e.g. à¦¬à¦¾‚à¦²à¦¾ -> বাংলা).
 */
const win1252Map: Record<number, number> = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91,
  0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98,
  0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
};

function win1252ToByte(ch: string): number {
  const code = ch.charCodeAt(0);
  if (win1252Map[code] !== undefined) {
    return win1252Map[code];
  }
  return code & 0xff;
}

/**
 * Fixes Mojibake where UTF-8 Bengali/multibyte characters were decoded as ISO-8859-1 or Windows-1252.
 * Bengali UTF-8 bytes start with 0xE0 0xA6 (à¦) or 0xE0 0xA7 (à§).
 */
export function repairMojibake(text: string): string {
  if (!text) return '';
  // Check for common UTF-8 Mojibake markers for Indic/Bengali/Arabic/extended UTF-8
  if (!text.includes('à¦') && !text.includes('à§') && !text.includes('Ã') && !text.includes('â€') && !text.includes('à')) {
    return text;
  }

  try {
    const bytes = new Uint8Array([...text].map(win1252ToByte));
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    // If decoding succeeded without producing too many replacement characters
    if (decoded && !decoded.includes('\uFFFD')) {
      return decoded;
    }
  } catch (e) {
    // Return original on failure
  }
  return text;
}

/**
 * Decodes Unicode escape sequences like \u09ac\u09be\u0982\u09b2\u09be or \\u09ac...
 */
export function decodeUnicodeEscapes(text: string): string {
  if (!text) return '';
  if (!/\\u[0-9a-fA-F]{4}/i.test(text)) return text;

  return text.replace(/\\u([0-9a-fA-F]{4})/gi, (match, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch (e) {
      return match;
    }
  });
}

/**
 * Decodes all HTML entities (decimal, hex, and named), running multiple passes
 * to handle double-encoded entities such as &amp;#2477;.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  let curr = text;

  for (let pass = 0; pass < 3; pass++) {
    const prev = curr;
    curr = curr
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#039;|&apos;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&bull;/gi, '•')
      .replace(/&ndash;/gi, '–')
      .replace(/&mdash;/gi, '—')
      .replace(/&#(\d+);/g, (match, dec) => {
        try {
          const code = parseInt(dec, 10);
          if (code > 0 && code < 0x10ffff) {
            return String.fromCodePoint(code);
          }
          return match;
        } catch (e) {
          return match;
        }
      })
      .replace(/&#x([0-9a-fA-F]+);/gi, (match, hex) => {
        try {
          const code = parseInt(hex, 16);
          if (code > 0 && code < 0x10ffff) {
            return String.fromCodePoint(code);
          }
          return match;
        } catch (e) {
          return match;
        }
      });

    if (curr === prev) break;
  }

  return curr;
}

/**
 * Decodes URL percent encoding if present (e.g. %E0%A6%AC%E0%A6%BE)
 */
export function decodePercentEncoding(text: string): string {
  if (!text) return '';
  if (!/%[0-9a-fA-F]{2}/.test(text)) return text;

  try {
    return decodeURIComponent(text);
  } catch (e) {
    // If entire string isn't valid URI component, decode matches individually
    return text.replace(/(%[0-9a-fA-F]{2})+/g, (match) => {
      try {
        return decodeURIComponent(match);
      } catch (err) {
        return match;
      }
    });
  }
}

/**
 * Master cleaner and repair function for Blogger titles, captions, and descriptions.
 * Guarantees that Bengali (বাংলা) and English text displays crystal clear without
 * garbled characters or broken entity codes.
 */
export function cleanAndDecodeBloggerText(raw?: string | null): string {
  if (!raw) return '';
  let text = String(raw).trim();
  if (!text) return '';

  // 1. Unescape URL percent encoding if present
  text = decodePercentEncoding(text);

  // 2. Unescape Unicode sequences
  text = decodeUnicodeEscapes(text);

  // 3. Decode HTML entities (handles double-encoded entities like &amp;#2477;)
  text = decodeHtmlEntities(text);

  // 4. Repair Mojibake (e.g. à¦¬à¦¾à¦‚à¦²à¦¾ -> বাংলা)
  text = repairMojibake(text);

  // 5. Run HTML entities once more in case Mojibake repair exposed entities
  if (text.includes('&#') || text.includes('&amp;')) {
    text = decodeHtmlEntities(text);
  }

  // 6. Clean invisible zero-width characters and normalize line endings
  text = text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}
