"""
필터링 로직 검증 스크립트
사용자가 선택한 조건 기반으로 서울 청년정책 필터링 결과 확인
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import urllib.request, urllib.parse, json, os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
API_KEY = os.getenv('YOUTH_POLICY_API_KEY', '')

BASE_URL = "https://www.youthcenter.go.kr/go/ythip/getPlcy"

# 매핑 테이블
SEOUL_DISTRICT_ZIP = {
    '강남구': '11680', '강동구': '11740', '강북구': '11305',
    '강서구': '11500', '관악구': '11620', '광진구': '11215',
    '구로구': '11530', '금천구': '11545', '노원구': '11350',
    '도봉구': '11320', '동대문구': '11230', '동작구': '11590',
    '마포구': '11440', '서대문구': '11410', '서초구': '11650',
    '성동구': '11200', '성북구': '11290', '송파구': '11710',
    '양천구': '11470', '영등포구': '11560', '용산구': '11170',
    '은평구': '11380', '종로구': '11110', '중구': '11140', '중랑구': '11260'
}

USER_CAT_TO_LCLSF = {
    '취업':     ['일자리'],
    '주거':     ['주거'],
    '교육':     ['교육'],
    '의료':     ['복지·문화'],
    '생활지원': ['복지·문화', '금융', '참여·권리', '참여·기반'],
    '육아':     ['복지·문화'],
}

AGE_RANGE = {
    '10대이하': (14,19), '20대': (20,29), '30대': (30,39),
    '40대': (40,49), '50대': (50,59), '60대이상': (60,99)
}

def match(policy, ua):
    today = "20260416"
    end = (policy.get('bizPrdEndYmd') or '').replace('-','').replace('.','')[:8]
    if end and end < today:
        return False, "마감기한 초과"

    if policy.get('sprtTrgtAgeLmtYn') == 'Y' and ua.get('age'):
        mn = int(policy.get('sprtTrgtMinAge') or 0)
        mx = int(policy.get('sprtTrgtMaxAge') or 99)
        amin, amax = AGE_RANGE.get(ua['age'], (0,99))
        if amax < mn or amin > mx:
            return False, f"연령 불일치 (정책:{mn}~{mx}, 사용자:{amin}~{amax})"

    sub = ua.get('subRegion')
    if sub:
        city_zip = '11000'
        dist_zip = SEOUL_DISTRICT_ZIP.get(sub)
        pz = (policy.get('zipCd') or '').replace(' ','')
        if pz and dist_zip:
            if city_zip not in pz and dist_zip not in pz:
                return False, f"구 불일치 (정책zipCd:{pz[:30]}, 구:{dist_zip})"

    cats = ua.get('category', [])
    if isinstance(cats, str): cats = [cats]
    if cats and '전체' not in cats:
        lclsf = policy.get('lclsfNm') or ''
        matched = any(
            any(l in lclsf for l in USER_CAT_TO_LCLSF.get(c, []))
            for c in cats
        )
        if not matched:
            return False, f"카테고리 불일치 (정책:{lclsf}, 선택:{cats})"

    return True, "통과"

# 테스트 시나리오: 20대, 강남구, 취업 관심
user_answers = {
    'age': '20대',
    'region': 'seoul',
    'subRegion': '강남구',
    'category': ['취업'],
}

city_zip = '11000'
dist_zip = SEOUL_DISTRICT_ZIP.get(user_answers['subRegion'], '')
zip_param = f"{city_zip},{dist_zip}" if dist_zip else city_zip

print(f"=== 테스트: {user_answers} ===")
print(f"API zipCd 파라미터: {zip_param}\n")

params = urllib.parse.urlencode({'apiKeyNm': API_KEY, 'pageNum': 1, 'pageSize': 50, 'rtnType': 'json', 'zipCd': zip_param})
req = urllib.request.Request(f"{BASE_URL}?{params}", headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=15) as r:
    data = json.loads(r.read().decode('utf-8'))

policies = data['result']['youthPolicyList']
total = len(policies)
passed = [(p, r) for p in policies for ok, r in [match(p, user_answers)] if ok]
failed = [(p, r) for p in policies for ok, r in [match(p, user_answers)] if not ok]

print(f"API 응답: {total}건")
print(f"필터 통과: {len(passed)}건")
print(f"필터 제외: {len(failed)}건")

print(f"\n✅ 통과된 정책 (최대 10개):")
for p, _ in passed[:10]:
    print(f"  [{p.get('lclsfNm')}] {p.get('plcyNm')} | 마감:{p.get('bizPrdEndYmd')} | zipCd:{(p.get('zipCd') or '')[:30]}")

print(f"\n❌ 제외 이유 분포:")
from collections import Counter
reasons = Counter(r for _, r in failed)
for reason, cnt in reasons.most_common():
    print(f"  {reason}: {cnt}건")
