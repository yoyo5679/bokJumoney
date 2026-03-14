import urllib.request
import xml.etree.ElementTree as ET
import os
from dotenv import load_dotenv

# load .env
_root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_root_dir, '.env'))
api_key = os.getenv('YOUTH_CENTER_API_KEY_1')

url = f"https://www.youthcenter.go.kr/opi/youthPlcyList.do?openApiVlak={api_key}&display=10&pageIndex=1"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
        print(content[:500])
        root = ET.fromstring(content)
        emps = root.findall('.//emp')
        print(f"Found {len(emps)} emp tags.")
        if len(emps) > 0:
            for child in emps[0]:
                print(f"  {child.tag}: {child.text[:50] if child.text else ''}")
except Exception as e:
    print("Error:", e)
