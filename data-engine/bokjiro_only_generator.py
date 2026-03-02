"""
bokjiro_only_generator.py
복지로 API 데이터만 사용해서 generated_data.js를 새로 만드는 스크립트.
- bokjiro_official_data.json (365개) 사용
- script.js의 data 객체 구조에 맞는 조건 함수 생성
- 복지로 공식 해시태그(lifeArray, trgterIndvdlArray, intrsThemaArray) 사용
"""
import json
import re
import os
import urllib.request, urllib.parse
import xml.etree.ElementTree as ET
import time

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)

API_KEY = '9a318bb9e3744a79987a64668e6e67c3c8e4fd22b7c261aeddc03af627730a09'

# =============================================
# 1. script.js의 answers 구조에 맞는 조건 맵핑
# =============================================

# lifeArray → age 조건
LIFE_TO_AGE = {
    '임신·출산': ["d.age === '20대'", "d.age === '30대'", "d.age === '40대'"],
    '영유아':    ["d.age === '10대이하'"],
    '아동':      ["d.age === '10대이하'"],
    '청소년':    ["d.age === '10대이하'"],
    '청년':      ["d.age === '20대'", "d.age === '30대'"],
    '중장년':    ["d.age === '40대'", "d.age === '50대'"],
    '노년':      ["d.age === '60대이상'"],
}

# trgterIndvdlArray → household 조건
TRGTER_TO_HOUSEHOLD = {
    '장애인':        "d.household.includes('장애인')",
    '저소득':        "(d.income === '100만원미만' || d.income === '100-250만원')",
    '한부모·조손':   "d.household.includes('한부모')",
    '다자녀':        "d.household.includes('다자녀')",
    '다문화·탈북민': "d.household.includes('다문화가족')",
    '국가유공자·보훈': "d.household.includes('보훈대상자')",
    '보훈대상자':  "d.household.includes('보훈대상자')",
}

# 지역명 → region slug
REGION_MAP = {
    '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon',
    '부산': 'busan', '대구': 'daegu', '울산': 'ulsan',
    '대전': 'daejeon', '광주': 'gwangju', '세종': 'sejong',
    '강원': 'gangwon', '충북': 'chungbuk', '충남': 'chungnam',
    '전북': 'jeonbuk', '전남': 'jeonnam', '경북': 'gyeongbuk',
    '경남': 'gyeongnam', '제주': 'jeju',
}

# =============================================
# ★ 핵심: intrsThemaArray → 퀴즈 category 값 매핑
# index.html STEP4 카테고리: 주거 | 취업 | 육아 | 교육 | 의료 | 생활비 | 청년 | 전체
# =============================================
INTRS_TO_CATEGORY = {
    '일자리':    '취업',
    '서민금융':  '생활비',
    '주거':      '주거',
    '교육':      '교육',
    '보육':      '육아',
    '신체건강':  '의료',
    '정신건강':  '의료',
    '생활지원':  '생활비',
    '안전·위기': '생활비',
    '보호·돌봄': '생활비',
    '문화·여가': '생활비',
}

def get_category(intrs_thema):
    """intrsThemaArray에서 퀴즈 category 결정 (우선순위: 첫 번째 매칭)"""
    for key, cat in INTRS_TO_CATEGORY.items():
        if key in intrs_thema:
            return cat
    return '전체'  # 매핑 안 되면 전체 (필터 통과)

def build_condition(item):
    """복지로 데이터에서 script.js 호환 조건 함수 생성"""
    life = item.get('lifeArray', '')
    trgter = item.get('trgterIndvdlArray', '')
    agency = item.get('agency', '')
    name = item.get('name', '')

    age_conds = []
    hh_conds = []
    region_conds = []

    # 생애주기 → 나이 조건
    for life_tag, age_list in LIFE_TO_AGE.items():
        if life_tag in life:
            age_conds.extend(age_list)

    # 가구유형 → household/소득 조건
    for trgter_tag, hh_cond in TRGTER_TO_HOUSEHOLD.items():
        if trgter_tag in trgter:
            hh_conds.append(hh_cond)

    # 지역 조건 (기관명 또는 서비스명에 지역명 포함 시)
    combined_text = agency + ' ' + name
    for region_name, region_slug in REGION_MAP.items():
        if region_name in combined_text:
            region_conds.append(f"d.region === '{region_slug}'")

    # 조건 조합
    parts = []

    # 나이 조건 (OR)
    if age_conds:
        unique_ages = list(dict.fromkeys(age_conds))
        parts.append(f"({' || '.join(unique_ages)})")

    # household 조건 (OR)
    if hh_conds:
        parts.append(f"({' || '.join(hh_conds)})")

    # 지역 조건 (OR)
    if region_conds:
        parts.append(f"({' || '.join(region_conds)})")

    # 조건이 하나도 없으면 전국 대상 (true)
    if not parts:
        return 'true'

    return ' && '.join(parts)

def build_js_from_bokjiro(data_list):
    """복지로 데이터 리스트 → generated_data.js 내용 생성"""
    lines = ['const welfareData = [']

    for item in data_list:
        name = item.get('name', '').replace("'", "\\'")
        desc = item.get('description', '').replace("'", "\\'").replace('\n', ' ').strip()
        agency = item.get('agency', '').replace("'", "\\'")
        hashtags = item.get('hashtags', [])
        serv_id = item.get('servId', '')
        sprt_cyc = item.get('sprtCycNm', '')
        srv_pvsn = item.get('srvPvsnNm', '')
        onapPsblt = item.get('onapPsbltYn', 'N')
        monthly_amount = 0  # 복지로 API에서 금액 정보 없음

        # 복지로 직접 링크
        if serv_id:
            apply_url = f"https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId={serv_id}&wlfareInfoReldBztpCd=01"
        else:
            apply_url = 'https://www.bokjiro.go.kr/'

        # 신청 방법
        howto = ['온라인 신청', '방문 신청'] if onapPsblt == 'Y' else ['방문 신청']

        # 조건 생성
        cond = build_condition(item)
        is_local = any(
            r in (item.get('agency', '') + item.get('name', ''))
            for r in REGION_MAP.keys()
        )

        # relevance: 기본 80, 온라인 신청가능하면 +5
        relevance = 85 if onapPsblt == 'Y' else 80

        # ★ 퀴즈 카테고리 값으로 변환 (index.html STEP4와 일치해야 함)
        quiz_category = get_category(item.get('intrsThemaArray', ''))

        # 해시태그 JS string
        hashtags_js = json.dumps(hashtags, ensure_ascii=False)

        lines.append('    {')
        lines.append(f"        name: '{name}',")
        lines.append(f"        description: '{desc[:200]}',")
        lines.append(f"        icon: '🏛', tag: '{agency}',")
        lines.append(f"        hashtags: {hashtags_js},")
        lines.append(f"        applyUrl: '{apply_url}',")
        lines.append(f"        apply_period: '{sprt_cyc}',")
        lines.append(f"        howTo: {json.dumps(howto, ensure_ascii=False)},")
        lines.append(f"        monthlyAmount: {monthly_amount},")
        lines.append(f"        relevance: {relevance},")
        lines.append(f"        isLocal: {'true' if is_local else 'false'},")
        lines.append(f"        category: '{quiz_category}',")
        lines.append(f"        condition: (d) => {cond}")
        lines.append('    },')

    lines.append('];')
    return '\n'.join(lines)

# =============================================
# 2. 복지로 전체 서비스 최대한 수집
# =============================================
def fetch_all_bokjiro():
    """다양한 키워드로 복지로 서비스 최대한 수집"""
    LIST_URL = 'http://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001'
    
    # 검색어 목록 (없으면 365개 기본 + 키워드별 추가)
    # srchKeyCode=003 (제목+내용) 필수
    search_targets = [
        '',           # 전체 (기본 365개)
        '주거', '취업', '교육', '보육', '의료', '건강',
        '노인', '장애', '한부모', '저소득', '청년', '아동',
        '창업', '금융', '문화', '안전', '임신', '출산',
    ]
    
    all_items = {}  # servId → item (중복 제거)
    
    for keyword in search_targets:
        params = {
            'serviceKey': API_KEY,
            'callTp': 'L',
            'pageNo': '1',
            'numOfRows': '500',
            'srchKeyCode': '003',
        }
        if keyword:
            params['searchWrd'] = keyword

        qs = urllib.parse.urlencode(params)
        url = f'{LIST_URL}?{qs}'

        try:
            with urllib.request.urlopen(url, timeout=15) as res:
                raw = res.read().decode('utf-8')

            root = ET.fromstring(raw)
            rc = root.findtext('resultCode')
            tc = root.findtext('totalCount')

            if rc != '0':
                print(f"  [{keyword or '전체'}] 오류: {root.findtext('resultMessage')}")
                continue

            count = 0
            for serv in root.iter('servList'):
                item = {}
                for child in serv:
                    item[child.tag] = (child.text or '').strip()
                serv_id = item.get('servId', '')
                if serv_id and serv_id not in all_items:
                    all_items[serv_id] = item
                    count += 1

            print(f"  [{keyword or '전체'}] +{count}개 (누계 {len(all_items)}개, 전체 {tc}건)")
            time.sleep(0.3)

        except Exception as e:
            print(f"  [{keyword or '전체'}] 예외: {e}")

    return list(all_items.values())

# =============================================
# 3. 실행
# =============================================
print("=== 복지로 전용 데이터 생성 시작 ===\n")
print("1단계: 복지로 API에서 전체 서비스 수집 중...")
raw_items = fetch_all_bokjiro()
print(f"\n  → 총 {len(raw_items)}개 수집 완료\n")

# 해시태그 추가
print("2단계: 공식 해시태그 생성 중...")
processed = []
for item in raw_items:
    life = item.get('lifeArray', '')
    trgter = item.get('trgterIndvdlArray', '')
    intrs = item.get('intrsThemaArray', '')

    hashtags = []
    for raw in [life, trgter, intrs]:
        for t in raw.split(','):
            t = t.strip()
            if t and t not in hashtags:
                hashtags.append(t)

    processed.append({
        'name': item.get('servNm', ''),
        'description': item.get('servDgst', ''),
        'agency': item.get('jurMnofNm', '').replace(' ' + item.get('jurOrgNm', ''), '').strip(),
        'hashtags': hashtags,
        'servId': item.get('servId', ''),
        'sprtCycNm': item.get('sprtCycNm', ''),
        'srvPvsnNm': item.get('srvPvsnNm', ''),
        'onapPsbltYn': item.get('onapPsbltYn', 'N'),
        'lifeArray': life,
        'trgterIndvdlArray': trgter,
        'intrsThemaArray': intrs,
    })

# bokjiro_official_data.json 업데이트
bokjiro_path = os.path.join(current_dir, 'bokjiro_official_data.json')
with open(bokjiro_path, 'w', encoding='utf-8') as f:
    json.dump(processed, f, ensure_ascii=False, indent=2)
print(f"  → bokjiro_official_data.json 업데이트 ({len(processed)}개)")

# JS 생성
print("\n3단계: generated_data.js 생성 중...")
js_content = build_js_from_bokjiro(processed)

# 기존 파일 백업
backup_path = os.path.join(current_dir, 'generated_data.js')  # data-engine 안에 원본 있음
output_path = os.path.join(root_dir, 'generated_data.js')

with open(output_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"  → generated_data.js 저장 완료 ({len(js_content):,}자)")

# 검증: 조건 분포 확인
true_count = js_content.count('condition: (d) => true')
cond_count = len(processed) - true_count
print(f"\n=== 조건 분포 ===")
print(f"  전국 대상 (condition: true): {true_count}개")
print(f"  필터 조건 있음:              {cond_count}개")
print(f"  총 서비스:                   {len(processed)}개")
print(f"\n✅ 완료! http://localhost:5500 에서 확인하세요.")
