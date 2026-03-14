import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import os
from dotenv import load_dotenv

# load .env
_root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_root_dir, '.env'))
api_key = os.getenv('YOUTH_CENTER_API_KEY_1')

url = "https://www.youthcenter.go.kr/opi/youthPlcyList.do"
params = {
    "openApiVlak": api_key,
    "display": "5",
    "pageIndex": "1"
}
query_string = urllib.parse.urlencode(params)
full_url = f"{url}?{query_string}"

req = urllib.request.Request(full_url, headers={'User-Agent': 'Mozilla/5.0'})

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        print(f"Status: {response.getcode()}")
        print(f"URL after redirect: {response.geturl()}")
        content = response.read().decode('utf-8')
        print("--- Content Preview ---")
        print(content[:500])
        
        try:
            root = ET.fromstring(content)
            print("Successfully parsed XML")
            
            emps = root.findall('.//emp')
            print(f"Found {len(emps)} emp tags")
            if len(emps) > 0:
                print(f"First element bizId: {emps[0].find('bizId').text}")
                print(f"First element polyBizSjnm: {emps[0].find('polyBizSjnm').text}")
        except Exception as e:
            print("Error parsing XML:", e)

except Exception as e:
    print("HTTP Error:", e)
