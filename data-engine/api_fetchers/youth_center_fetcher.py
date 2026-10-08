import urllib.request
import urllib.parse
import json
import os
import time
from datetime import date
from dotenv import load_dotenv

# API Configuration - 프로젝트 루트의 .env 파일에서 읽기
_root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(_root_dir, '.env'))
API_KEY = os.getenv('YOUTH_CENTER_API_KEY')
if not API_KEY:
    raise ValueError(".env 파일에 YOUTH_CENTER_API_KEY가 없습니다.")

# 온통청년 청년정책 API (2025년 개편 이후 주소)
BASE_URL = "https://www.youthcenter.go.kr/go/ythip/getPlcy"
DETAIL_URL = "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/{}"
PAGE_SIZE = 100

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "youth_center_data.json")

# zipCd(법정동 시군구 코드) 앞 2자리 → 시도명 (generate_js_data.py의 region_map 값과 동일)
SIDO_BY_ZIP_PREFIX = {
    "11": "서울", "26": "부산", "27": "대구", "28": "인천", "29": "광주",
    "30": "대전", "31": "울산", "36": "세종", "41": "경기",
    "42": "강원", "51": "강원", "43": "충북", "44": "충남",
    "45": "전북", "52": "전북", "46": "전남", "47": "경북", "48": "경남", "50": "제주",
}
ALL_SIDO = set(SIDO_BY_ZIP_PREFIX.values())

# 코드값 (온통청년 API 명세)
AGE_UNLIMITED = "Y"          # sprtTrgtAgeLmtYn: Y = 연령 제한 없음
EARN_ANNUAL = "0043002"      # earnCndSeCd: 연소득 기준
EARN_ETC = "0043003"         # earnCndSeCd: 기타 기준
APLY_PERIOD = "0057001"      # aplyPrdSeCd: 특정 기간
APLY_ALWAYS = "0057002"      # aplyPrdSeCd: 상시
APLY_CLOSED = "0057003"      # aplyPrdSeCd: 마감


def fetch_page(page_num):
    params = {
        "apiKeyNm": API_KEY,
        "pageNum": page_num,
        "pageSize": PAGE_SIZE,
        "rtnType": "json",
    }
    full_url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(full_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode('utf-8'))

    if data.get("resultCode") != 200:
        raise RuntimeError(f"온통청년 API 오류: {data.get('errorCode') or data.get('resultCode')} {data.get('errorMsg') or data.get('resultMessage')}")

    result = data["result"]
    return result["youthPolicyList"], int(result["pagging"]["totCount"])


def parse_residence(zip_cd):
    """zipCd 목록을 시도명 목록으로 변환. 전국 대상이면 빈 리스트."""
    sidos = {SIDO_BY_ZIP_PREFIX[z.strip()[:2]] for z in (zip_cd or "").split(",") if z.strip()[:2] in SIDO_BY_ZIP_PREFIX}
    if not sidos or sidos == ALL_SIDO:
        return []
    return sorted(sidos)


def application_ended(policy, today_str):
    """마감됐거나 신청 종료일이 지난 정책이면 True."""
    if policy.get("aplyPrdSeCd") == APLY_CLOSED:
        return True
    if policy.get("aplyPrdSeCd") == APLY_PERIOD:
        end = (policy.get("aplyYmd") or "").split("~")[-1].strip()
        if len(end) == 8 and end.isdigit() and end < today_str:
            return True
    return False


def process_policy(p):
    name = (p.get("plcyNm") or "").strip()
    category_raw = p.get("lclsfNm") or ""

    my_category = "생활비"
    if "주거" in category_raw: my_category = "주거"
    elif "일자리" in category_raw: my_category = "취업"
    elif "교육" in category_raw: my_category = "교육"

    min_age, max_age = int(p.get("sprtTrgtMinAge") or 0), int(p.get("sprtTrgtMaxAge") or 0)
    if p.get("sprtTrgtAgeLmtYn") == AGE_UNLIMITED or max_age == 0:
        age = [0, 100]
    else:
        age = [min_age, max_age]

    income = ""
    if p.get("earnCndSeCd") == EARN_ANNUAL:
        income = f"연소득 {p.get('earnMinAmt')}~{p.get('earnMaxAmt')}만원"
    elif p.get("earnCndSeCd") == EARN_ETC:
        income = (p.get("earnEtcCn") or "").strip()

    if p.get("aplyPrdSeCd") == APLY_ALWAYS:
        apply_period = "상시"
    else:
        apply_period = (p.get("aplyYmd") or "").strip()

    apply_url = (p.get("aplyUrlAddr") or "").strip() or DETAIL_URL.format(p.get("plcyNo"))

    return {
        "id": f"youth_{p.get('plcyNo')}",
        "name": f"[온통청년] {name}",
        "description": (p.get("plcyExplnCn") or "").strip(),
        "icon": "🌱",
        "agency": p.get("sprvsnInstCdNm") or p.get("rgtrInstCdNm") or "온통청년",
        "tag": "청년",
        "applyUrl": apply_url,
        "category": my_category,
        "raw_category": category_raw,
        "relevance": 90,
        "amount_max": 0,
        "apply_period": apply_period,
        "eligibility": {
            "age": age,
            "residence": parse_residence(p.get("zipCd")),
            "income": income,
            "target": (p.get("addAplyQlfcCndCn") or "").strip(),
        },
        "eligibility_raw": {
            "target": (p.get("plcySprtCn") or "").strip(),
            "criteria": (p.get("addAplyQlfcCndCn") or "").strip(),
            "user_type": (p.get("ptcpPrpTrgtCn") or "").strip(),
        },
    }


def fetch_youth_policies():
    print("Starting fetch from Youth Center API...")
    policies, total = fetch_page(1)
    if not any(p.get("plcyNm") for p in policies):
        raise RuntimeError("온통청년 API가 빈 데이터(모든 필드 null)를 반환했습니다. 인증키 권한을 확인하세요.")
    total_pages = (total + PAGE_SIZE - 1) // PAGE_SIZE
    print(f"  총 {total}건 / {total_pages}페이지")

    for page_num in range(2, total_pages + 1):
        page_items, _ = fetch_page(page_num)
        policies.extend(page_items)
        print(f"  {page_num}/{total_pages}페이지 수집 ({len(policies)}건)")
        time.sleep(0.3)

    today_str = date.today().strftime("%Y%m%d")
    open_policies = [p for p in policies if p.get("plcyNm") and not application_ended(p, today_str)]
    print(f"  신청 마감 {len(policies) - len(open_policies)}건 제외")

    return [process_policy(p) for p in open_policies]


if __name__ == "__main__":
    results = fetch_youth_policies()
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(results)} youth policies to {OUTPUT_FILE}")
