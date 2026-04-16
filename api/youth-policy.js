/**
 * Vercel Serverless Function: 온통청년 청년정책 API 프록시
 * 경로: /api/youth-policy
 * 
 * 쿼리 파라미터:
 *   - zipCd: 지역코드 (예: 11000=서울)
 *   - pageNum: 페이지 번호 (기본 1)
 *   - pageSize: 페이지 크기 (기본 100)
 *   - lclsfNm: 대분류 필터 (옵션)
 */
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const API_KEY = process.env.YOUTH_POLICY_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'YOUTH_POLICY_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  const {
    zipCd = '',
    pageNum = 1,
    pageSize = 100,
    lclsfNm = '',
    query = '',
  } = req.query;

  const params = new URLSearchParams({
    apiKeyNm: API_KEY,
    pageNum: String(pageNum),
    pageSize: String(pageSize),
    rtnType: 'json',
  });

  if (zipCd) params.set('zipCd', String(zipCd));
  if (lclsfNm) params.set('lclsfNm', lclsfNm);
  if (query) params.set('query', query);

  const apiUrl = `https://www.youthcenter.go.kr/go/ythip/getPlcy?${params.toString()}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BokJumeoni/1.0)',
        'Accept': 'application/json',
      },
      // Vercel 함수 타임아웃 내에서 처리
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `외부 API 오류: HTTP ${response.status}`,
        url: apiUrl.replace(API_KEY, '***'),
      });
    }

    const data = await response.json();

    // 응답 캐시 (10분) - CDN 캐싱으로 API 과호출 방지
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    return res.status(200).json(data);

  } catch (err) {
    console.error('[youth-policy API Error]', err.message);
    return res.status(503).json({
      error: '청년정책 API 요청 실패: ' + err.message,
    });
  }
}
