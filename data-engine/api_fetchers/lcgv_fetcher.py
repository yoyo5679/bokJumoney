import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
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

# 한국사회보장정보원_지자체복지서비스 (data.go.kr 15108347)
BASE_URL = "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist"
PER_PAGE = 500

# 목록 응답에는 생애주기가 없어서, 생애주기 필터(lifeArray)로 따로 조회해 붙인다
LIFE_CODES = {
    "001": "영유아", "002": "아동", "003": "청소년", "004": "청년",
    "005": "중장년", "006": "노년", "007": "임신출산",
}

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "lcgv_welfare_data.json")


def fetch_all(**filters):
    items = []
    page = 1
    while True:
        params = {"serviceKey": API_KEY, "pageNo": page, "numOfRows": PER_PAGE, **filters}
        full_url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"
        with urllib.request.urlopen(full_url, timeout=60) as response:
            root = ET.fromstring(response.read())
        if root.findtext(".//resultCode") not in ("0", "00"):
            raise RuntimeError(f"지자체복지서비스 API 오류: {root.findtext('.//resultMessage') or root.findtext('.//returnAuthMsg')}")

        rows = [{child.tag: (child.text or "").strip() for child in serv} for serv in root.iter("servList")]
        items.extend(rows)
        total = int(root.findtext(".//totalCount") or 0)
        if not rows or len(items) >= total:
            return items
        page += 1
        time.sleep(0.3)


def split_names(raw):
    return [v.strip() for v in (raw or "").split(",") if v.strip()]


def fetch_data():
    print("Fetching local government welfare services...")
    services = fetch_all()
    print(f"  목록 {len(services)}건")

    life_by_id = {}
    for code, label in LIFE_CODES.items():
        for row in fetch_all(lifeArray=code):
            life_by_id.setdefault(row["servId"], []).append(label)
        print(f"  생애주기 {label}: 누적 {len(life_by_id)}건 표시")

    return [{
        "id": s["servId"],
        "name": s.get("servNm", ""),
        "summary": s.get("servDgst", ""),
        "sido": s.get("ctpvNm", ""),
        "sigungu": s.get("sggNm", ""),
        "department": s.get("bizChrDeptNm", ""),
        "targets": split_names(s.get("trgterIndvdlNmArray")),
        "life": life_by_id.get(s["servId"], []),
        "url": s.get("servDtlLink", ""),
        "cycle": s.get("sprtCycNm", ""),
        "provision": s.get("srvPvsnNm", ""),
        "modified": s.get("lastModYmd", ""),
    } for s in services]


if __name__ == "__main__":
    results = fetch_data()
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    print(f"Saved {len(results)} items to {OUTPUT_FILE}")
