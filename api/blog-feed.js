/**
 * Vercel Serverless Function: 사복노트 티스토리 블로그 새 글 목록
 * 경로: /api/blog-feed  (복주머니 첫 화면 '블로그 새 글'에 씁니다)
 *
 * 블로그 RSS를 읽어 '복지정보안내' 글만 골라 돌려줍니다.
 * 브라우저에서 RSS를 바로 읽으면 CORS에 막혀서 여기서 대신 읽어요.
 * 30분 동안 캐시하므로 블로그에 새 글이 올라가면 늦어도 30분 뒤에 보여요.
 *
 * 쿼리 파라미터:
 *   - limit: 가져올 글 수 (기본 6, 최대 10)
 */
const RSS_URL = 'https://10000nanzip.tistory.com/rss';
const CATEGORY = '복지정보안내';

// RSS 제목은 두 번 이스케이프돼 있어요 (&amp;middot; → &middot; → ·)
function decode(text) {
  let s = String(text || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/&middot;/g, '·')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&amp;/g, '&');
  }
  return s;
}

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : '';
}

export function parseFeed(xml, limit = 6) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items
    .filter(block => decode(pick(block, 'category')).trim() === CATEGORY)
    .slice(0, limit)
    .map(block => {
      const body = decode(pick(block, 'description'));
      const text = body.replace(/<[^>]+>/g, ' ').replace(/\[##_[\s\S]*?_##\]/g, ' ').replace(/\s+/g, ' ').trim();
      return {
        title: decode(pick(block, 'title')).trim(),
        url: decode(pick(block, 'link')).trim(),
        date: new Date(pick(block, 'pubDate')).toISOString(),
        desc: text.slice(0, 90),
      };
    })
    .filter(post => post.title && post.url.startsWith('https://10000nanzip.tistory.com/'));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 10);
  try {
    const r = await fetch(RSS_URL, { headers: { 'User-Agent': 'bokjumoney-blog-feed' } });
    if (!r.ok) throw new Error(`RSS ${r.status}`);
    const posts = parseFeed(await r.text(), limit);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({ posts });
  } catch (err) {
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(502).json({ posts: [], error: String(err.message || err) });
  }
}
