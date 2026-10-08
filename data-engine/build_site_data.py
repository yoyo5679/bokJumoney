"""
build_site_data.py
정부24 · 복지로 · 온통청년 수집 데이터를 합쳐 사이트용 데이터 파일을 만든다.

입력:
  api_fetchers/mois_gov24_data.json    (api_fetchers/mois_fetcher.py)
  bokjiro_official_data.json           (bokjiro_full_fetcher.py)
  api_fetchers/youth_center_data.json  (api_fetchers/youth_center_fetcher.py)
출력 (루트와 welfare-app/ 두 곳):
  generated_data.js          전국 대상 혜택  → const welfareData = [...]
  data/regions/{지역}.js     지역 대상 혜택  → registerRegionData('{지역}', [...])

항목 형식 (script.js 의 prepareWelfareItem 이 화면용 필드로 변환):
  k 고유ID, n 이름, t 기관, d 설명, u 신청URL, c 카테고리, i 아이콘, v 정렬 가중치
  a [최소나이, 최대나이]       없으면 나이 무관
  q [[토큰...], ...]           각 묶음마다 사용자의 생애주기/가구상황 중 하나 이상 일치해야 함
  r [지역...] / s 시군구       없으면 전국
"""
import json
import os
import re
from datetime import date

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(CURRENT_DIR)
OUTPUT_DIRS = [ROOT_DIR, os.path.join(ROOT_DIR, "welfare-app")]

GOV24_PATH = os.path.join(CURRENT_DIR, "api_fetchers", "mois_gov24_data.json")
BOKJIRO_PATH = os.path.join(CURRENT_DIR, "bokjiro_official_data.json")
YOUTH_PATH = os.path.join(CURRENT_DIR, "api_fetchers", "youth_center_data.json")

CATEGORY_ICONS = {
    "신체건강": "🏃", "정신건강": "🧠", "생활지원": "🛒", "주거": "🏠",
    "일자리": "💼", "문화여가": "🎨", "안전위기": "🛡️", "임신출산": "🤰",
    "보육": "👶", "교육": "📚", "입양위탁": "🏡", "보호돌봄": "🤝",
    "서민금융": "🏦", "법률": "⚖️",
}

# ── 지역 ──
SIDO_TO_REGIONS = {
    "서울특별시": ["seoul"], "부산광역시": ["busan"], "대구광역시": ["daegu"],
    "인천광역시": ["incheon"], "광주광역시": ["gwangju"], "대전광역시": ["daejeon"],
    "울산광역시": ["ulsan"], "세종특별자치시": ["sejong"], "경기도": ["gyeonggi"],
    "강원특별자치도": ["gangwon"], "강원도": ["gangwon"], "충청북도": ["chungbuk"],
    "충청남도": ["chungnam"], "전북특별자치도": ["jeonbuk"], "전라북도": ["jeonbuk"],
    "전라남도": ["jeonnam"], "경상북도": ["gyeongbuk"], "경상남도": ["gyeongnam"],
    "제주특별자치도": ["jeju"],
    # 2026년 광주광역시 + 전라남도 통합
    "전남광주통합특별시": ["gwangju", "jeonnam"],
}
SHORT_TO_REGION = {
    "서울": "seoul", "부산": "busan", "대구": "daegu", "인천": "incheon", "광주": "gwangju",
    "대전": "daejeon", "울산": "ulsan", "세종": "sejong", "경기": "gyeonggi", "강원": "gangwon",
    "충북": "chungbuk", "충남": "chungnam", "전북": "jeonbuk", "전남": "jeonnam",
    "경북": "gyeongbuk", "경남": "gyeongnam", "제주": "jeju",
}
GWANGJU_DISTRICTS = {"광산구", "남구", "동구", "북구", "서구"}
NATIONAL_AGENCY_TYPES = {"중앙행정기관", "공공기관"}

# ── 정부24 지원조건 코드 → 사이트 설문 값 (생애주기 / 가구상황) ──
CODE_TOKENS = {
    "JA0301": ["임신출산"],            # 예비부부/난임
    "JA0302": ["임신출산"],            # 임산부
    "JA0303": ["임신출산", "영유아"],  # 출산/입양
    "JA0317": ["아동"],                # 초등학생
    "JA0318": ["청소년"],              # 중학생
    "JA0319": ["청소년"],              # 고등학생
    "JA0320": ["청년"],                # 대학생/대학원생
    "JA0328": ["장애인"],
    "JA0329": ["보훈대상자"],
    "JA0401": ["다문화탈북민"],        # 다문화가족
    "JA0402": ["다문화탈북민"],        # 북한이탈주민
    "JA0403": ["한부모조손"],
    "JA0411": ["다자녀"],
}
# 설문에 없지만 누구나 해당될 수 있는 대상 → 제한 없음으로 취급
OPEN_CODES = {
    "JA0326",  # 근로자/직장인
    "JA0327",  # 구직자/실업자
    "JA0330",  # 질병/질환자
    "JA0404",  # 1인가구
    "JA0412",  # 무주택세대
    "JA0413",  # 신규전입
    "JA0414",  # 확대가족
}
# 특수대상 그룹 (해당사항없음 코드가 Y면 제한 없음)
GROUP_SPECIAL = (["JA0301", "JA0302", "JA0303", "JA0313", "JA0314", "JA0315", "JA0316",
                  "JA0317", "JA0318", "JA0319", "JA0320", "JA0326", "JA0327", "JA0328",
                  "JA0329", "JA0330"], "JA0322")
GROUP_FAMILY = (["JA0401", "JA0402", "JA0403", "JA0404", "JA0411", "JA0412", "JA0413", "JA0414"], "JA0410")
INCOME_CODES = ["JA0201", "JA0202", "JA0203", "JA0204", "JA0205"]  # 중위소득 ~50 / ~75 / ~100 / ~200 / 200%초과
BUSINESS_CODE_PREFIXES = ("JA11", "JA12", "JA21", "JA22")  # 창업자·업종·기업·단체 조건
# 정부24에 시군구 기관이 없는 지역의 설문 선택지
DEFAULT_SUB_REGIONS = {"sejong": ["세종시"], "jeju": ["제주시", "서귀포시"]}

# ── 복지로 태그 → 사이트 설문 값 ──
BOKJIRO_LC = {"임신·출산": "임신출산", "임신ㆍ출산": "임신출산", "영유아": "영유아", "아동": "아동",
              "청소년": "청소년", "청년": "청년", "중장년": "중장년", "노년": "노년"}
BOKJIRO_HH = {"저소득": "저소득", "장애인": "장애인", "한부모·조손": "한부모조손", "한부모ㆍ조손": "한부모조손",
              "다자녀": "다자녀", "다문화·탈북민": "다문화탈북민", "다문화ㆍ탈북민": "다문화탈북민",
              "보훈대상자": "보훈대상자"}
BOKJIRO_THEME = {"신체건강": "신체건강", "정신건강": "정신건강", "생활지원": "생활지원", "주거": "주거",
                 "일자리": "일자리", "문화·여가": "문화여가", "문화ㆍ여가": "문화여가",
                 "안전·위기": "안전위기", "안전ㆍ위기": "안전위기", "임신·출산": "임신출산",
                 "임신ㆍ출산": "임신출산", "보육": "보육", "교육": "교육", "입양·위탁": "입양위탁",
                 "입양ㆍ위탁": "입양위탁", "보호·돌봄": "보호돌봄", "보호ㆍ돌봄": "보호돌봄",
                 "서민금융": "서민금융", "법률": "법률"}

FINANCE_WORDS = ["대출", "융자", "보증", "금융", "저축", "통장", "적금", "이자", "자산형성"]
CHILDCARE_WORDS = ["보육", "어린이집", "아이돌봄", "유아", "영유아"]
MENTAL_WORDS = ["심리", "정신", "마음", "우울", "자살", "중독", "트라우마"]
CULTURE_WORDS = ["문화", "예술", "공연", "여행", "체육", "관광"]


def normalize_name(name):
    return re.sub(r"[\s\[\]()（）·ㆍ,.\-_'\"]", "", name or "")


def compact(item):
    """빈 값은 빼서 파일 크기를 줄인다."""
    return {k: v for k, v in item.items() if v not in (None, "", [], 0)}


# ──────────────── 정부24 ────────────────
def group_requirement(codes, group):
    """특수대상/가구 그룹의 요구 토큰. None=제한 없음, 'DROP'=설문으로 표현 불가(농어업인 등)."""
    group_codes, none_code = group
    if none_code in codes:
        return None
    selected = [c for c in group_codes if c in codes]
    if not selected or any(c in OPEN_CODES for c in selected):
        return None
    tokens = sorted({t for c in selected for t in CODE_TOKENS.get(c, [])})
    return tokens or "DROP"


def gov24_category(item):
    name, field = item["name"], item["field"]
    if "입양" in name:
        return "입양위탁"
    if "법률" in name or "소송" in name:
        return "법률"
    if "융자" in item["support_type"] or any(w in name for w in FINANCE_WORDS):
        return "서민금융"
    if field == "보육·교육":
        return "보육" if any(w in name for w in CHILDCARE_WORDS) else "교육"
    if field == "보건·의료":
        return "정신건강" if any(w in name for w in MENTAL_WORDS) else "신체건강"
    return {
        "생활안정": "생활지원", "주거·자립": "주거", "고용·창업": "일자리",
        "임신·출산": "임신출산", "보호·돌봄": "보호돌봄", "문화·환경": "문화여가",
        "행정·안전": "안전위기", "농림축산어업": "생활지원",
    }.get(field, "생활지원")


def build_sub_regions(gov24):
    """설문의 시군구 선택지. 정부24 시군구 기관명에서 지역별로 모은다."""
    by_code = build_agency_region_map(gov24)
    subs = {region: set(names) for region, names in DEFAULT_SUB_REGIONS.items()}
    for regions, sub_region in by_code.values():
        for region in regions:
            if sub_region:
                subs.setdefault(region, set()).add(sub_region)
    return {region: sorted(names) for region, names in sorted(subs.items())}


def build_agency_region_map(gov24):
    """소관기관코드 → (지역 목록, 시군구). 광역시도/시군구 항목의 기관명으로 만든다."""
    by_code = {}
    for item in gov24:
        name, code = item["agency"], item["agency_code"]
        if item["agency_type"] == "광역시도" and name in SIDO_TO_REGIONS:
            by_code[code] = (SIDO_TO_REGIONS[name], "")
        elif item["agency_type"] == "시군구":
            parts = name.split()
            if len(parts) >= 2 and parts[0] in SIDO_TO_REGIONS:
                regions = SIDO_TO_REGIONS[parts[0]]
                if parts[0] == "전남광주통합특별시":
                    regions = ["gwangju"] if parts[1] in GWANGJU_DISTRICTS else ["jeonnam"]
                by_code[code] = (regions, parts[1])
    return by_code


def gov24_region(item, by_code):
    """(지역 목록, 시군구). 전국이면 ([], ''), 지역을 알 수 없으면 None."""
    if item["agency_type"] in NATIONAL_AGENCY_TYPES:
        return [], ""
    if item["agency_code"] in by_code:
        return by_code[item["agency_code"]]
    for sido, regions in SIDO_TO_REGIONS.items():
        if item["agency"].startswith(sido):
            return regions, ""
    for short, region in SHORT_TO_REGION.items():
        if item["agency"].startswith(short):
            return [region], ""
    return None


def convert_gov24(gov24, stats):
    by_code = build_agency_region_map(gov24)
    results = []
    for item in gov24:
        if "개인" not in item["user_type"] and "가구" not in item["user_type"]:
            stats["gov24_법인·소상공인 전용 제외"] += 1
            continue
        codes = set(item["codes"])
        if any(c.startswith(BUSINESS_CODE_PREFIXES) for c in codes) and \
                ("법인" in item["user_type"] or "소상공인" in item["user_type"]):
            stats["gov24_사업자·단체 조건이 붙은 서비스 제외"] += 1
            continue

        requirements = []
        for group in (GROUP_SPECIAL, GROUP_FAMILY):
            req = group_requirement(codes, group)
            if req == "DROP":
                break
            if req:
                requirements.append(req)
        else:
            req = None
        if req == "DROP":
            stats["gov24_농어업인 등 설문 외 대상 제외"] += 1
            continue

        income = [c for c in INCOME_CODES if c in codes]
        if income and not any(c in income for c in ("JA0203", "JA0204", "JA0205")):
            requirements.append(["저소득"])  # 중위소득 75% 이하만 대상

        age = None
        lo, hi = item["age"]
        if lo is not None or hi is not None:
            lo, hi = int(lo or 0), int(hi if hi is not None else 150)
            if lo <= hi and not (lo == 0 and hi >= 100):
                age = [lo, hi]

        region = gov24_region(item, by_code)
        if region is None:
            stats["gov24_지역 판별 불가 제외"] += 1
            continue
        regions, sub_region = region

        category = gov24_category(item)
        is_central = item["agency_type"] == "중앙행정기관"
        results.append({
            "k": f"g{item['id']}",
            "n": f"[중앙정부] {item['name']}" if is_central else item["name"],
            "t": item["agency"],
            "d": item["summary"],
            "u": item["url"],
            "c": category,
            "i": CATEGORY_ICONS.get(category, "🎁"),
            "v": 75 if regions else 50,
            "a": age,
            "q": requirements,
            "r": regions,
            "s": sub_region,
            "_norm": normalize_name(item["name"]),
        })
    return results


# ──────────────── 복지로 ────────────────
def split_tags(raw):
    return [t.strip() for t in (raw or "").split(",") if t.strip()]


def convert_bokjiro(bokjiro, gov24_by_name, stats):
    results = []
    for item in bokjiro:
        themes = [BOKJIRO_THEME[t] for t in split_tags(item.get("intrsThemaArray")) if t in BOKJIRO_THEME]
        category = themes[0] if themes else "생활지원"

        same = gov24_by_name.get(normalize_name(item["name"]))
        if same:
            # 정부24에도 있는 서비스: 조건은 정부24 것을 쓰고, 카테고리만 복지로 분류로 보정
            same["c"] = category
            same["i"] = CATEGORY_ICONS.get(category, "🎁")
            stats["복지로_정부24와 중복(카테고리만 반영)"] += 1
            continue

        tokens = [BOKJIRO_LC[t] for t in split_tags(item.get("lifeArray")) if t in BOKJIRO_LC]
        tokens += [BOKJIRO_HH[t] for t in split_tags(item.get("trgterIndvdlArray")) if t in BOKJIRO_HH]
        serv_id = item.get("servId", "")
        url = item.get("applyUrl")
        if not url or url == "#":
            url = f"https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId={serv_id}&wlfareInfoReldBztpCd=01"
        results.append({
            "k": f"b{serv_id}",
            "n": f"[중앙정부] {item['name']}",
            "t": item.get("agency") or "중앙부처",
            "d": item.get("description", ""),
            "u": url,
            "c": category,
            "i": CATEGORY_ICONS.get(category, "🎁"),
            "v": 50,
            "q": [sorted(set(tokens))] if tokens else [],
        })
    return results


# ──────────────── 온통청년 ────────────────
def youth_category(item):
    raw = (item.get("raw_category") or "").split(",")[0]
    name = item["name"]
    if raw == "일자리":
        return "일자리"
    if raw == "주거":
        return "주거"
    if raw.startswith("교육"):
        return "교육"
    if any(w in name for w in FINANCE_WORDS):
        return "서민금융"
    if any(w in name for w in CULTURE_WORDS):
        return "문화여가"
    return "생활지원"


def youth_region(item, plain_name, sub_regions):
    """(지역 목록, 시군구). 지역코드 → 담당기관명 → 정책명 속 시군구 표기 순으로 판단."""
    regions = sorted({SHORT_TO_REGION[r] for r in item.get("eligibility", {}).get("residence", [])
                      if r in SHORT_TO_REGION})
    parts = (item.get("agency") or "").split()
    if not regions and parts and parts[0] in SIDO_TO_REGIONS:
        regions = list(SIDO_TO_REGIONS[parts[0]])  # 지역코드가 없는 지자체 정책 (예: 전남광주통합특별시)
    if not regions or len(regions) > 2:
        return regions, ""

    found = set()
    if len(parts) >= 2 and parts[0] in SIDO_TO_REGIONS:
        found = {(r, parts[1]) for r in regions if parts[1] in sub_regions.get(r, [])}
    if not found:
        found = {(r, s) for r in regions for s in sub_regions.get(r, [])
                 if re.search(rf"(?<![가-힣]){s}(?![가-힣])", plain_name)}
    if len(found) == 1:
        region, sub_region = found.pop()
        return [region], sub_region
    return regions, ""


def convert_youth(youth, gov24_names, sub_regions, stats):
    results = []
    for item in youth:
        if (item.get("raw_category") or "").startswith("참여"):
            stats["온통청년_참여·기반(소식지·네트워크 등) 제외"] += 1
            continue
        plain_name = item["name"].replace("[온통청년]", "").strip()
        if normalize_name(plain_name) in gov24_names:
            stats["온통청년_정부24와 중복 제외"] += 1
            continue

        elig = item.get("eligibility", {})
        age = elig.get("age") or [0, 100]
        if age == [0, 100] or age[1] == 0:
            age = [19, 39]  # 연령 제한 없는(또는 0~0으로 비어 있는) 청년정책 → 청년 연령대로 한정

        regions, sub_region = youth_region(item, plain_name, sub_regions)

        category = youth_category(item)
        results.append({
            "k": item.get("id") or f"y{normalize_name(plain_name)}",
            "n": item["name"],
            "t": item.get("agency") or "온통청년",
            "d": item.get("description", ""),
            "u": item.get("applyUrl", ""),
            "c": category,
            "i": CATEGORY_ICONS.get(category, "🌱"),
            "v": 90,
            "a": age,
            "r": regions,
            "s": sub_region,
        })
    return results


# ──────────────── 출력 ────────────────
def items_to_js(items):
    return ",\n".join(json.dumps(compact(i), ensure_ascii=False, separators=(",", ":")) for i in items)


def main():
    with open(GOV24_PATH, encoding="utf-8") as f:
        gov24_raw = json.load(f)
    with open(BOKJIRO_PATH, encoding="utf-8") as f:
        bokjiro_raw = json.load(f)
    with open(YOUTH_PATH, encoding="utf-8") as f:
        youth_raw = json.load(f)

    from collections import Counter
    stats = Counter()
    gov24 = convert_gov24(gov24_raw, stats)
    gov24_by_name = {}
    for item in gov24:
        if not item["r"]:
            gov24_by_name.setdefault(item["_norm"], item)
    bokjiro = convert_bokjiro(bokjiro_raw, gov24_by_name, stats)
    sub_regions = build_sub_regions(gov24_raw)
    youth = convert_youth(youth_raw, {i["_norm"] for i in gov24}, sub_regions, stats)
    for item in gov24:
        del item["_norm"]

    all_items = gov24 + bokjiro + youth
    national = [i for i in all_items if not i.get("r")]
    by_region = {}
    for item in all_items:
        for region in item.get("r") or []:
            by_region.setdefault(region, []).append(item)

    version = date.today().isoformat()
    for out_dir in OUTPUT_DIRS:
        region_dir = os.path.join(out_dir, "data", "regions")
        os.makedirs(region_dir, exist_ok=True)
        with open(os.path.join(out_dir, "generated_data.js"), "w", encoding="utf-8") as f:
            f.write(f"// build_site_data.py 로 생성됨 ({version}) — 직접 수정하지 마세요\n")
            f.write(f"const WELFARE_DATA_VERSION = '{version}';\n")
            f.write(f"const SUB_REGIONS = {json.dumps(sub_regions, ensure_ascii=False)};\n")
            f.write(f"const welfareData = [\n{items_to_js(national)}\n];\n")
        for region, items in by_region.items():
            with open(os.path.join(region_dir, f"{region}.js"), "w", encoding="utf-8") as f:
                f.write(f"// build_site_data.py 로 생성됨 ({version})\n")
                f.write(f"registerRegionData('{region}', [\n{items_to_js(items)}\n]);\n")

    print(f"정부24 {len(gov24)} · 복지로 {len(bokjiro)} · 온통청년 {len(youth)} → 전국 {len(national)}건")
    for region in sorted(by_region):
        print(f"  {region}: {len(by_region[region])}건")
    for reason, count in stats.most_common():
        print(f"  - {reason}: {count}건")


if __name__ == "__main__":
    main()
