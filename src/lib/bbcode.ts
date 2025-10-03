// src/lib/bbcode.ts - BBCode parser for forum posts
import DOMPurify from 'isomorphic-dompurify';

/**
 * Parse BBCode to HTML
 * Supports: [b], [i], [u], [quote], [code], [url], [img]
 */
export function parseBBCode(text: string): string {
  if (!text) return '';
  
  let html = text;
  
  // Escape HTML first to prevent XSS
  html = escapeHtml(html);
  
  // [b]bold[/b]
  html = html.replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>');
  
  // [i]italic[/i]
  html = html.replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>');
  
  // [u]underline[/u]
  html = html.replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>');
  
  // [quote]text[/quote] or [quote=username]text[/quote]
  html = html.replace(/\[quote=["']?([^"\]]+)["']?\](.*?)\[\/quote\]/gis, 
    '<blockquote class="border-l-4 border-sky-400 pl-4 py-2 my-3 bg-neutral-800/50"><div class="text-xs text-sky-400 mb-1">Quote from $1:</div><div class="text-gray-300">$2</div></blockquote>');
  html = html.replace(/\[quote\](.*?)\[\/quote\]/gis, 
    '<blockquote class="border-l-4 border-gray-500 pl-4 py-2 my-3 bg-neutral-800/50 text-gray-300">$1</blockquote>');
  
  // [code]code[/code]
  html = html.replace(/\[code\](.*?)\[\/code\]/gis, 
    '<pre class="bg-neutral-800 border border-neutral-700 rounded p-3 my-3 overflow-x-auto"><code class="text-sm text-gray-300 font-mono">$1</code></pre>');
  
  // [url=link]text[/url] or [url]link[/url]
  html = html.replace(/\[url=["']?([^"\]]+)["']?\](.*?)\[\/url\]/gi, 
    '<a href="$1" class="text-sky-400 hover:text-sky-300 underline" target="_blank" rel="noopener noreferrer">$2</a>');
  html = html.replace(/\[url\](.*?)\[\/url\]/gi, 
    '<a href="$1" class="text-sky-400 hover:text-sky-300 underline" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // [img]url[/img]
  html = html.replace(/\[img\](.*?)\[\/img\]/gi, 
    '<img src="$1" alt="User image" class="max-w-full h-auto rounded my-3 border border-neutral-700" loading="lazy" />');
  
  // Convert newlines to <br> tags
  html = html.replace(/\n/g, '<br>');
  
  // Sanitize the final HTML to prevent XSS
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'u', 'blockquote', 'pre', 'code', 'a', 'img', 'br', 'div'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel', 'loading']
  });
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Strip BBCode tags for preview/plain text
 */
export function stripBBCode(text: string): string {
  return text
    .replace(/\[quote=["']?[^"\]]+["']?\](.*?)\[\/quote\]/gis, '$1')
    .replace(/\[quote\](.*?)\[\/quote\]/gis, '$1')
    .replace(/\[code\](.*?)\[\/code\]/gis, '$1')
    .replace(/\[url=["']?[^"\]]+["']?\](.*?)\[\/url\]/gi, '$1')
    .replace(/\[url\](.*?)\[\/url\]/gi, '$1')
    .replace(/\[img\].*?\[\/img\]/gi, '[Image]')
    .replace(/\[b\](.*?)\[\/b\]/gi, '$1')
    .replace(/\[i\](.*?)\[\/i\]/gi, '$1')
    .replace(/\[u\](.*?)\[\/u\]/gi, '$1');
}
