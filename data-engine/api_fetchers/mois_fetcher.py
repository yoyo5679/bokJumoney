import urllib.request
import urllib.parse
import json
import os
import time
from dotenv import load_dotenv

# API Configuration - 프로젝트 루트의 .env 파일에서 읽기
_root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(_root_dir, '.env'))
API_KEY = os.getenv('PUBLIC_DATA_API_KEY')
if not API_KEY:
    raise ValueError(".env 파일에 PUBLIC_DATA_API_KEY가 없습니다.")

# 행정안전부_대한민국 공공서비스(혜택) 정보 (data.go.kr 15113968)
BASE_URL = "https://api.odcloud.kr/api/gov24/v3"
PER_PAGE = 1000  # API 최대값

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "mois_gov24_data.json")


def fetch_all(endpoint):
    """endpoint(serviceList / supportConditions)의 전체 페이지를 가져온다."""
    items = []
    page = 1
    while True:
        params = {"page": page, "perPage": PER_PAGE, "serviceKey": API_KEY}
        full_url = f"{BASE_URL}/{endpoint}?{urllib.parse.urlencode(params)}"
        with urllib.request.urlopen(full_url, timeout=120) as response:
            data = json.loads(response.read().decode('utf-8'))
        if "data" not in data:
            raise RuntimeError(f"정부24 API 오류 ({endpoint}): {data}")

        items.extend(data["data"])
        total = data["totalCount"]
        print(f"  {endpoint}: {len(items)}/{total}")
        if page * PER_PAGE >= total:
            return items
        page += 1
        time.sleep(0.3)


def fetch_data():
    print("Fetching Gov24 public services...")
    services = fetch_all("serviceList")
    conditions = {c["서비스ID"]: c for c in fetch_all("supportConditions")}

    results = []
    for s in services:
        cond = conditions.get(s["서비스ID"], {})
        results.append({
            "id": s["서비스ID"],
            "name": (s.get("서비스명") or "").strip(),
            "summary": (s.get("서비스목적요약") or "").strip(),
            "agency": (s.get("소관기관명") or "").strip(),
            "agency_type": s.get("소관기관유형") or "",
            "agency_code": s.get("소관기관코드") or "",
            "user_type": s.get("사용자구분") or "",
            "field": s.get("서비스분야") or "",
            "support_type": s.get("지원유형") or "",
            "url": s.get("상세조회URL") or "",
            # 지원조건: 대상 연령(JA0110~JA0111)과 'Y'로 표시된 조건 코드 목록
            "age": [cond.get("JA0110"), cond.get("JA0111")],
            "codes": sorted(k for k, v in cond.items() if k.startswith("JA") and v == "Y"),
        })

    missing = sum(1 for s in services if s["서비스ID"] not in conditions)
    if missing:
        print(f"  ⚠️ 지원조건이 없는 서비스 {missing}건")
    return results


if __name__ == "__main__":
    results = fetch_data()
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    print(f"Saved {len(results)} items to {OUTPUT_FILE}")
