import re
from collections import Counter

with open('../generated_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

cats = re.findall(r"category: '([^']+)'", content)
conds = re.findall(r"condition: \(d\) => (true|.*?)[\n,]", content)

print('=== 카테고리 분포 ===')
for cat, cnt in Counter(cats).most_common():
    print(f'  {cat}: {cnt}개')
print(f'  총: {len(cats)}개')

print('\n=== 조건 분포 ===')
true_count = sum(1 for c in conds if c == 'true')
print(f'  전국 대상 (true): {true_count}개')
print(f'  필터 조건 있음: {len(conds) - true_count}개')
