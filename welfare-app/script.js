const answers = {};
const TOTAL_STEPS = 5;

const REGION_NAMES = {
    'seoul': '서울', 'gyeonggi': '경기', 'incheon': '인천',
    'busan': '부산', 'daegu': '대구', 'ulsan': '울산',
    'daejeon': '대전', 'gwangju': '광주', 'sejong': '세종',
    'gangwon': '강원', 'chungbuk': '충북', 'chungnam': '충남',
    'jeonbuk': '전북', 'jeonnam': '전남', 'gyeongbuk': '경북',
    'gyeongnam': '경남', 'jeju': '제주'
};

// PC/모바일 구분 (V21)
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const linkTarget = isMobile ? '_self' : '_blank';

// ── 지역별 포털 데이터 (복지로 API 연동 후 자동 채워질 예정) ──
const REGIONAL_PORTALS = {};

// 시군구 데이터
const SUB_REGIONS = {
    'seoul': ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'],
    'gyeonggi': ['수원시', '고양시', '용인시', '성남시', '부천시', '화성시', '안산시', '남양주시', '안양시', '평택시', '시흥시', '파주시', '의정부시', '김포시', '광주시', '광명시', '군포시', '하남시', '오산시', '양주시', '이천시', '구리시', '안성시', '의왕시', '여주시', '양평군', '동두천시', '과천시', '가평군', '연천군'],
    'busan': ['강서구', '금정구', '기장군', '남구', '동구', '동래구', '부산진구', '북구', '사상구', '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구'],

    'incheon': ['강화군', '계양구', '남동구', '동구', '미추홀구', '부평구', '서구', '연수구', '옹진군', '중구'],
    'daegu': ['군위군', '남구', '달서구', '달성군', '동구', '북구', '서구', '수성구', '중구'],
    'gwangju': ['광산구', '남구', '동구', '북구', '서구'],
    'daejeon': ['대덕구', '동구', '서구', '유성구', '중구'],
    'ulsan': ['남구', '동구', '북구', '울주군', '중구'],
    'sejong': ['세종시'],
    'gangwon': ['춘천시', '원주시', '강릉시', '동해시', '속초시', '홍천군', '횡성군', '영월군', '평창군'],
    'chungbuk': ['청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군'],
    'chungnam': ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시'],
    'jeonbuk': ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군'],
    'jeonnam': ['목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군'],
    'gyeongbuk': ['포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시'],
    'gyeongnam': ['창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시'],
    'jeju': ['제주시', '서귀포시']
};

// welfareData is now provided by generated_data.js
// 옵션 선택
function selectOption(el, key, isMulti = false) {
    const parent = el.closest('.options');

    if (isMulti) {
        // "해당없음" 또는 "전체" 같은 배타적 옵션 처리
        if (el.dataset.val === '해당없음' || el.dataset.val === '전체') {
            parent.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
            el.classList.add('selected');
        } else {
            // 다른 옵션 선택시 배타적 옵션 해제
            const exclusiveBtn = parent.querySelector('.opt-btn[data-val="해당없음"], .opt-btn[data-val="전체"]');
            if (exclusiveBtn && exclusiveBtn.classList.contains('selected')) {
                exclusiveBtn.classList.remove('selected');
            }
            el.classList.toggle('selected');
        }

        // 선택된 값 다중 수집
        const selectedVals = Array.from(parent.querySelectorAll('.opt-btn.selected')).map(b => b.dataset.val);
        answers[key] = selectedVals;

        const stepNum = el.closest('.step').id.replace('step-', '');
        const btn = document.getElementById('next' + stepNum);
        if (btn) btn.disabled = selectedVals.length === 0;

    } else {
        parent.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
        el.classList.add('selected');
        answers[key] = el.dataset.val;

        // 지역 선택 시 시군구 인터랙션 (V11)
        if (key === 'region') {
            const subArea = document.getElementById('subRegionArea');
            const subOpts = document.getElementById('subRegionOptions');
            const regionKey = el.dataset.val;

            // 시군구 데이터가 있으면 렌더링
            if (SUB_REGIONS[regionKey] && SUB_REGIONS[regionKey].length > 0) {
                subOpts.innerHTML = ''; // 초기화
                SUB_REGIONS[regionKey].forEach(sub => {
                    const btn = document.createElement('button');
                    btn.className = 'opt-btn';
                    btn.textContent = sub;
                    btn.dataset.val = sub;
                    btn.onclick = function () { selectOption(this, 'subRegion'); };
                    subOpts.appendChild(btn);
                });
                subArea.style.display = 'block';

                // 도 선택 시 시/군/구 목록으로 자동 스크롤 (V17)
                subArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                // 다음 버튼 비활성화 (시군구 선택 대기)
                const stepNum = el.closest('.step').id.replace('step-', '');
                const btn = document.getElementById('next' + stepNum);
                if (btn) btn.disabled = true;

                // 세종 같은 단일 항목은 자동 선택 처리 (User Friendly)
                if (SUB_REGIONS[regionKey].length === 1) {
                    subOpts.firstChild.click();
                }
                return; // 시군구 선택 후 버튼 활성화를 위해 리턴
            } else {
                // 시군구 데이터 없으면 숨김
                subArea.style.display = 'none';
            }
        }

        // 시군구 선택 시 스크롤 부드럽게
        if (key === 'subRegion') {
            // 시군구 선택됨 -> 다음 버튼 활성화 로직으로 이동
        }

        const stepNum = el.closest('.step').id.replace('step-', '');
        const btn = document.getElementById('next' + stepNum);
        if (btn) btn.disabled = false;
    }
}

// 다음 스텝
function nextStep(num) {
    const current = num - 1;
    document.getElementById('step-' + current).classList.remove('active');
    document.getElementById('step-' + num).classList.add('active');
    updateProgress(current);

    // 첫 페이지를 제외하고는 중앙으로 자동 스크롤 (V16)
    if (num > 1) {
        const nextEl = document.getElementById('step-' + num);
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // History API 연동 (뒤로가기 지원)
    history.pushState({ step: num }, '', '#step-' + num);
}

// 이전 스텝 (V9)
function prevStep(num) {
    document.querySelector('.step.active').classList.remove('active');
    document.getElementById('step-' + num).classList.add('active');
    updateProgress(num - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 브라우저 뒤로가기 감지 (V9)
window.onpopstate = function (event) {
    const step = event.state ? event.state.step : 'intro';
    const activeStep = document.querySelector('.step.active');
    if (activeStep) activeStep.classList.remove('active');

    const progressWrap = document.getElementById('progressWrap');
    const topAd = document.getElementById('topAdZone');

    // 결과 화면에서 뒤로가기 시 5단계로
    if (step === 'result') {
        document.getElementById('step-result').classList.add('active');
        if (progressWrap) progressWrap.style.display = 'block';
        if (topAd) topAd.style.display = 'block';
    } else if (step === 'loading') {
        document.getElementById('step-loading').classList.add('active');
        if (progressWrap) progressWrap.style.display = 'block';
        if (topAd) topAd.style.display = 'none';
    } else if (step === 'intro') {
        document.getElementById('step-intro').classList.add('active');
        if (progressWrap) progressWrap.style.display = 'none';
        if (topAd) topAd.style.display = 'block';
    } else {
        const target = document.getElementById('step-' + step);
        if (target) target.classList.add('active');
        if (progressWrap) progressWrap.style.display = 'block';
        if (topAd) topAd.style.display = 'none';
        updateProgress(step - 1);
    }
};

// 초기 상태 설정
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Ensure we start at the top, even with #step-1 in URL
window.scrollTo(0, 0);
setTimeout(() => window.scrollTo(0, 0), 0);
setTimeout(() => window.scrollTo(0, 0), 100);

history.replaceState({ step: 'intro' }, '', '#intro');

// 진행바 업데이트
function updateProgress(completed) {
    const pct = (completed / TOTAL_STEPS) * 100;
    const bar = document.getElementById('progressBar');
    const label = document.getElementById('progressLabel');
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = completed + ' / ' + TOTAL_STEPS + ' 완료';
}

// 로딩 시작
function startLoading() {
    document.getElementById('step-5').classList.remove('active');
    document.getElementById('step-loading').classList.add('active');
    updateProgress(5);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    history.pushState({ step: 'loading' }, '', '#loading');

    const loadingIds = ['ls1', 'ls2', 'ls3', 'ls4', 'ls5'];
    loadingIds.forEach((id, i) => {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.classList.add('show');
            if (i === 4) setTimeout(showResult, 800);
        }, 500 + i * 600);
    });
}

// 결과 데이터 계산 (V12 점수 로직 업그레이드)
function calcResult() {
    let matched = [];
    let totalAmount = 0;

    // 1. 기본 점수 (30~50점 랜덤) - 변별력 확보
    let baseScore = Math.floor(Math.random() * 21) + 30;

    // ── 다중 선택 배열 정규화 ──
    // answers.lifeCycle, household, category 는 항상 배열로 처리
    const lc = Array.isArray(answers.lifeCycle) ? answers.lifeCycle : (answers.lifeCycle ? [answers.lifeCycle] : []);
    const hh = Array.isArray(answers.household) ? answers.household : (answers.household ? [answers.household] : []);
    const cats = Array.isArray(answers.category) ? answers.category : (answers.category ? [answers.category] : []);

    // 2. 생애주기/가구별 필요도 점수 (복지 시급성)
    let needScore = 0;

    // 생애주기 점수
    if (lc.some(x => ['영유아', '노년', '임신출산'].includes(x))) needScore += 15;
    else if (lc.length > 0) needScore += 5;

    // 가구 점수: 취약계층 우대
    if (hh.some(x => ['저소득', '장애인', '한부모조손'].includes(x))) needScore += 25;
    if (hh.some(x => ['다자녀', '보훈대상자'].includes(x))) needScore += 10;

    // 데이터 준비 — lc, hh, cats 도 함께 전달하여 condition 함수에서 사용 가능하게
    let incomeNum = 300; // 기본
    if (hh.includes('저소득')) incomeNum = 50;

    let familyCount = 1;
    if (hh.includes('다자녀')) familyCount = 4;
    else if (hh.includes('한부모조손')) familyCount = 2;

    const data = { ...answers, incomeNum, familyCount, lc, hh, cats };

    // 3. 혜택 매칭 및 가산점
    let potentialScore = 0;
    welfareData.forEach(item => {
        // 카테고리 필터링 (다중 선택 매칭)
        let isCategoryMatch = true;
        if (cats.length > 0 && !cats.includes('전체')) {
            if (!cats.includes(item.category) && !item.isLocal) isCategoryMatch = false;
        }

        if (item.condition(data) && isCategoryMatch) {
            // 태그 추출 및 매칭 (교집합 활용)
            let itemTags = [item.category];
            const condStr = item.condition.toString();
            const keywords = ['청년', '영유아', '아동', '청소년', '중장년', '노년', '임신출산', '저소득', '다자녀', '한부모조손', '장애인'];
            keywords.forEach(kw => {
                if (condStr.includes(kw)) itemTags.push(kw);
            });
            if (condStr.includes('age === "20대"')) itemTags.push('20대');
            if (condStr.includes('age === "30대"')) itemTags.push('30대');
            if (condStr.includes('incomeNum <= 100') || condStr.includes('incomeNum <= 250')) itemTags.push('저소득');

            // 사용자의 선택항목과 교집합
            const userSelections = [answers.age, ...(data.lc || []), ...(data.hh || []), ...(data.cats || [])];
            item.matchedTags = [...new Set(itemTags)].filter(tag => userSelections.includes(tag));

            // 만약 태그가 아무것도 매칭되지 않았다면 최소한 카테고리는 표시
            if (item.matchedTags.length === 0 && item.category && item.category !== '전체') {
                item.matchedTags.push(item.category);
            }

            matched.push(item);
            totalAmount += (item.monthlyAmount || 0);

            // 매칭 아이템당 가산점 (최대 40점 제한)
            if (potentialScore < 40) {
                potentialScore += 3;
            }
        }
    });

    // 4. 최종 점수 계산 및 테마 적용
    let finalScore = baseScore + needScore + potentialScore;

    // 감점 요인 (저소득 아님 + 생활지원 요청 시)
    if (!hh.includes('저소득') && cats.includes('생활지원')) finalScore -= 5;

    // 만점 방지 및 보정
    finalScore = Math.min(Math.max(finalScore, 45), 99); // 최소 45, 최대 99

    // 지역별 및 우선순위 정렬 로직
    matched.sort((a, b) => {
        let scoreA = a.relevance || 0;
        let scoreB = b.relevance || 0;

        // 0. 매칭된 해시태그 개수에 따른 가산점 (이용자가 선택한 카테고리가 많은 순으로 최우선 정렬)
        scoreA += (a.matchedTags ? a.matchedTags.length : 0) * 10000;
        scoreB += (b.matchedTags ? b.matchedTags.length : 0) * 10000;

        // 1. 온통청년(Youth Center) 데이터 가산점 (가장 공신력 있고 혜택이 큼)
        if (a.name.includes('[온통청년]')) scoreA += 2000;
        if (b.name.includes('[온통청년]')) scoreB += 2000;

        // 2. 핵심 정책 (내일채움공제 등) 추가 가산점
        if (a.name.includes('내일채움공제')) scoreA += 5000;
        if (b.name.includes('내일채움공제')) scoreB += 5000;

        // 2.5. 저소득층 우대 (기초생활수급 등 우선 노출)
        if (hh.includes('저소득')) {
            const lowIncomeKeywords = ['기초생활', '생계급여', '주거급여', '의료급여', '차상위', '수급자', '저소득'];
            const isLowIncomeA = lowIncomeKeywords.some(kw => (a.name || '').includes(kw) || (a.tag || '').includes(kw) || (a.desc || '').includes(kw));
            const isLowIncomeB = lowIncomeKeywords.some(kw => (b.name || '').includes(kw) || (b.tag || '').includes(kw) || (b.desc || '').includes(kw));

            if (isLowIncomeA) scoreA += 8000;
            if (isLowIncomeB) scoreB += 8000;
        }

        // 3. 지역별 정렬 로직 (기존 유지)
        const regionBtn = document.querySelector(`.opt-btn.selected[onclick*="region"]`);
        if (regionBtn) {
            const regionName = regionBtn.innerText.replace(/[^\uAC00-\uD7A3]/g, '').trim();
            if (answers.region === 'jeonbuk' && ((a.tag || '').includes('전북') || (a.tag || '').includes('전주'))) scoreA += 1000;
            if (answers.region === 'jeonbuk' && ((b.tag || '').includes('전북') || (b.tag || '').includes('전주'))) scoreB += 1000;
            if ((a.tag || '').includes(regionName)) scoreA += 800;
            if ((b.tag || '').includes(regionName)) scoreB += 800;
        }
        return scoreB - scoreA;
    });

    if (matched.length === 0) {
        matched = [{ name: '상세 분석 필요', description: '대표님의 상황에 맞는 숨은 혜택을 로거 블로그에서 확인해보세요!', icon: '🔍', tag: '맞춤안내', applyUrl: 'https://10000nanzip.tistory.com/' }];
    }

    // 결과 페이지 테마 적용
    applyScoreTheme(finalScore);

    return { score: finalScore, benefits: matched, totalAmount };
}

// 점수별 테마 적용 함수
function applyScoreTheme(score) {
    const resContainer = document.querySelector('.result-container');

    // 기존 테마 클래스 제거
    if (resContainer) {
        resContainer.classList.remove('score-tier-basic', 'score-tier-bronze', 'score-tier-silver', 'score-tier-gold');

        if (score >= 90) {
            resContainer.classList.add('score-tier-gold');
            shootConfetti();
        } else if (score >= 71) {
            resContainer.classList.add('score-tier-silver');
        } else if (score >= 51) {
            resContainer.classList.add('score-tier-bronze');
        } else {
            resContainer.classList.add('score-tier-basic');
        }
    }
}

// 꽃가루 효과 함수
function shootConfetti() {
    const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#fcd34d'];
    for (let i = 0; i < 50; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti';
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.top = '-10px'; // Start from top
        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        conf.style.animationDuration = (Math.random() * 3 + 2) + 's';
        document.body.appendChild(conf);

        // Remove after animation
        setTimeout(() => conf.remove(), 5000);
    }
}

// 전역 변수로 검색 결과 저장
let currentBenefits = { custom: [], local: [], agency: [] };

// 탭 변경
function changeTab(category, el) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    renderBenefits(category);
}

// 결과 표시
function showResult() {
    const { score, benefits, totalAmount } = calcResult();
    document.getElementById('step-loading').classList.remove('active');
    document.getElementById('step-result').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    history.pushState({ step: 'result' }, '', '#result');

    // 점수 대신 혜택 개수 애니메이션
    animateNumber('resultBenefitCount', benefits.length, 1500);

    // 광고 다시 켜기 (광고 정책 준수)
    const topAd = document.getElementById('topAdZone');
    if (topAd) topAd.style.display = 'block';

    // 메시지 업데이트
    let title = '복주머니가 혜택으로 가득 찼어요! 🧧';
    if (score < 40) title = '복주머니에 담을 혜택을 더 찾아볼까요?';
    else if (score < 70) title = '실속 있는 복지 혜택이 가득 담겼네요!';
    else if (score < 90) title = '와! 복주머니가 묵직할 정도로 혜택이 많아요!';

    document.getElementById('resultTitle').textContent = title;

    // 사용자 선택 태그 렌더링
    const selectedOptions = [
        answers.age,
        ...(Array.isArray(answers.lifeCycle) ? answers.lifeCycle : (answers.lifeCycle ? [answers.lifeCycle] : [])),
        ...(Array.isArray(answers.household) ? answers.household : (answers.household ? [answers.household] : [])),
        ...(Array.isArray(answers.category) ? answers.category : (answers.category ? [answers.category] : [])),
        answers.region ? (REGION_NAMES[answers.region] || answers.region) : null,
        answers.subRegion
    ];

    // 유효한 값 필터링 및 중복 제거
    const uniqueTags = [...new Set(selectedOptions.filter(val => val && val !== '해당없음' && val !== '전체'))];

    const userTagsContainer = document.getElementById('resultUserTags');
    if (userTagsContainer) {
        if (uniqueTags.length > 0) {
            userTagsContainer.innerHTML = uniqueTags.map(t => `<span class="hashtag-badge" style="background:var(--primary-light, #e0e7ff); color:var(--primary, #4f46e5); padding:4px 10px; border-radius:12px; font-size:13px; font-weight:700;">#${t}</span>`).join('');
        } else {
            userTagsContainer.innerHTML = '';
        }
    }

    // 혜택 분류
    currentBenefits = { custom: [], local: [], agency: [] };

    const regionBtn = document.querySelector(`.opt-btn.selected[onclick*="region"]`);
    const regionName = regionBtn ? regionBtn.innerText.replace(/[^\uAC00-\uD7A3]/g, '').trim() : '내 지역';
    const subRegionBtn = document.querySelector(`.opt-btn.selected[onclick*="subRegion"]`);
    const subRegionName = subRegionBtn ? subRegionBtn.innerText : '';
    const selectedRegion = answers.region || '';

    // ── V20: 지역별 청년포털 데이터 자동 주입 ──
    if (selectedRegion && REGIONAL_PORTALS[selectedRegion]) {
        REGIONAL_PORTALS[selectedRegion].forEach(portal => {
            currentBenefits.local.push({
                ...portal,
                isLocal: true,
                category: '생활지원' // Changed from 생활비
            });
        });
    }

    // 중앙정부 데이터 중 지역 매칭된 isLocal 항목도 추가
    benefits.forEach(b => {
        if (['초록우산', '굿네이버스', '이랜드복지재단', '희망친구기아대책'].includes(b.tag)) {
            currentBenefits.agency.push(b);
        } else if (b.isLocal) {
            // condition이 true인 경우만 (false 하드코딩 제외)
            currentBenefits.local.push(b);
        } else {
            currentBenefits.custom.push(b);
        }
    });

    // ── V20: 자립준비청년 선택 시 전용 혜택 카드 맞춤혜택 최상단 추가 ──
    if (answers.household === '자립준비청년') {
        currentBenefits.custom.unshift({
            name: '자립준비청년 맞춤 지원사업 안내',
            tag: '아동권리보장원',
            desc: '보호종료 후 자립을 준비하는 청년을 위한 주거·취업·생활·심리 맞춤 지원사업 통합 포털. 나에게 맞는 지원을 한눈에 확인하세요.',
            applyUrl: 'https://jaripon.ncrc.or.kr/home/kor/support/projectMng/index.do',
            monthlyAmount: 0,
            icon: '🌱',
            relevance: 9999
        });
        currentBenefits.custom.unshift({
            name: '자립준비청년 자립수당 (월 40만원)',
            tag: '아동권리보장원',
            desc: '보호종료 후 5년 이내 자립준비청년에게 자립활동비로 매월 40만원 지급. 만 24세 이하 대상.',
            applyUrl: 'https://jaripon.ncrc.or.kr/home/kor/support/projectMng/index.do',
            monthlyAmount: 400000,
            icon: '💰',
            relevance: 9998
        });
    }

    // 지역별 정렬 최적화 (해시태그 매칭 및 relevance 높은 것 상단)
    currentBenefits.local.sort((a, b) => {
        let scoreA = (a.relevance || 0) + ((a.matchedTags ? a.matchedTags.length : 0) * 10000);
        let scoreB = (b.relevance || 0) + ((b.matchedTags ? b.matchedTags.length : 0) * 10000);

        let hh = answers.household || '';
        if (hh.includes('저소득')) {
            const lowIncomeKeywords = ['기초생활', '생계급여', '주거급여', '의료급여', '차상위', '수급자', '저소득'];
            if (lowIncomeKeywords.some(kw => (a.name || '').includes(kw) || (a.tag || '').includes(kw) || (a.desc || '').includes(kw))) scoreA += 8000;
            if (lowIncomeKeywords.some(kw => (b.name || '').includes(kw) || (b.tag || '').includes(kw) || (b.desc || '').includes(kw))) scoreB += 8000;
        }

        return scoreB - scoreA;
    });

    // 지역지원 탭 버튼에 배지 표시
    const localTabBtn = document.querySelector('.tab-btn[onclick*="local"]');
    if (localTabBtn && currentBenefits.local.length > 0) {
        localTabBtn.innerHTML = `📍 지역 지원 <span style="background:#ef4444;color:white;border-radius:10px;padding:1px 6px;font-size:11px;margin-left:4px;">${currentBenefits.local.length}</span>`;
    }

    // 기본 탭(맞춤 혜택) 렌더링
    renderBenefits('custom');
}

// 혜택 리스트 렌더링
function renderBenefits(category) {
    const list = document.getElementById('benefitList');
    const aiNewsletterWrapper = document.getElementById('aiNewsletterWrapper');
    list.innerHTML = '';

    // AI 뉴스레터 표시 제어 (기존 지도 대체)
    if (category === 'agency') {
        const aiNewsletterWrapper = document.getElementById('aiNewsletterWrapper');
        if (aiNewsletterWrapper) aiNewsletterWrapper.style.display = 'block';
        
        const aiGrid = document.getElementById('aiNewsletterGrid');
        if (aiGrid && aiGrid.innerHTML.trim() === '') {
            const allNewsletters = [{"id": "nsModal1", "title": "2026년도 정부 지원 복지 동향 핵심 요약", "desc": "2026년 정부 복지 예산은 역대 최대 규모인 137조 원으로 편성되며 다양한 계층을 위한 맞춤형 복지 정책이 대폭 확대되었습니다. 특히 이번 개편안에서는 그동안 사각지대에 놓여있던\n                    청년, 1인 가구, 고립·은둔형 취약계층, 그리고 다자녀 가구를 위한 핀셋 지원이 강화된 것이 핵심입니다."}, {"id": "nsModal2", "title": "청년 대상: 도약과 자립을 위한 든든한 맞춤 지원금", "desc": "취업 한파와 고물가 속에서 미래를 준비하는 청년들을 위해 2026년 정부와 지자체의 청년 지원 정책이 더욱 풍성해졌습니다. 단순 생활비 보조를 너머, 청년들이 스스로 자립형 자산을\n                    형성하고 안정적인 직장 생활을 이어갈 수 있도록 맞춤형 재무 설계를 돕는 것이 2026년 청년 복지의 주된 테마입니다."}, {"id": "nsModal3", "title": "청년 주거혁명: 월세 부담 낮추고 전세사기 철벽방어", "desc": "청년 1인 가구의 팍팍한 삶의 질을 떨어뜨리는 가장 핵심 요인은 단연 '주거비 부담'입니다. 매월 빠져나가는 높은 월세와 보증금 대출 이자 때문에 저축액을 늘리지 못하는 청년 세대의\n                    고충을 해결하기 위해, 2026년 주거 지원 정책은 현금성 직접 지원과 금리 인하라는 두 마리 토끼를 모두 잡는 방향으로 진화했습니다."}, {"id": "nsModal4", "title": "신혼부부 내집마련: 대출 특례와 주거 희망사다리 안내", "desc": "초저출생 위기가 국가적 핵심 현안으로 대두되면서, 2026년 신혼부부 및 출산 예정 가구를 향한 주거 복지는 가히 '역대급' 혜택을 자랑합니다. 결혼과 출산이 경제적으로 페널티가\n                    되는 현상을 막기 위해, 정부는 파격적인 금리 혜택과 우선 분양 물량을 집중적으로 배정하여 부부들의 내 집 마련 꿈을 단축시켜 주고 있습니다."}, {"id": "nsModal5", "title": "중장년의 2막: 평생교육과 재취업을 위한 든든한 안전망", "desc": "대한민국의 허리를 든든하게 받치고 있는 4050 중장년 세대. 조기 퇴직의 불안감, 급변하는 AI와 디지털 산업 혁명으로 인한 직무 전환의 필요성 등 다중고를 겪고 있는\n                    40대~50대를 위해 국가에서는 제2의 인생 도약을 돕는 전방위적 생애 설계 프로그램과 재취업 지원, 그리고 건강 관리 및 생활 복지 지원 제도를 전폭적으로 가동하고 있습니다."}, {"id": "nsModal6", "title": "어르신 행복노후: 기초연금 확대 및 맞춤형 노인 일자리", "desc": "초고령사회 문턱에 진입한 2026년, 정부의 가장 핵심적인 과제는 어르신들이 질병이나 가난으로 고통받지 않고 건강하고 존엄하게 여생을 보낼 수 있도록 보장하는 것입니다. 이에 따라\n                    직접적인 소득을 올려드리는 현금성 복지를 빈틈없이 강화하는 한편, 활기찬 노후와 사회적 소속감을 선사하는 맞춤형 일자리 및 요양 인프라 확충에 천문학적인 예산을 집중 투입했습니다."}, {"id": "nsModal27", "title": "국민연금 조기 수령 가이드: 손해일까 이득일까?", "desc": "은퇴 후 소득 크레바스를 극복하기 위해 국민연금을 앞당겨 받는 조기노령연금 제도를 상세히 파헤칩니다. 감액률과 수급 시기별 손익 분기점, 그리고 2026년 개편된 연계 혜택을 비교 분석해 드립니다."}, {"id": "nsModal28", "title": "전세사기 피해자 주거 안정 집중 지원책", "desc": "전세사기로 고통받는 세입자들을 위해 정부가 마련한 긴급 주거 지원과 맞춤형 금융 구제책입니다. 피해 구제 신청 방법부터 최저 연 1.2% 금리의 대환대출, 그리고 심리 상담 지원까지 모든 것을 담았습니다."}, {"id": "nsModal29", "title": "농산어촌 유학 프로그램: 아이도 살리고 지역도 살리고", "desc": "도심의 아이들이 자연 속에서 교육받을 수 있도록 지원하는 농촌 유학 프로그램! 매월 지원되는 체재비용, 학부모 주거 지원, 그리고 특화된 생태 교육의 혜택을 통해 가족의 새로운 라이프스타일을 제안합니다."}, {"id": "nsModal30", "title": "맞춤형 복지 멤버십: 나 몰래 쌓이는 혜택 알림", "desc": "복지로 시스템의 '맞춤형 급여 안내(복지 멤버십)' 서비스! 한 번만 가입해 두면 나이, 가구 구성, 소득 변동에 따라 내가 받을 수 있는 정부 혜택을 문자로 알아서 척척 알려주는 필수 신청 서비스입니다."}, {"id": "nsModal31", "title": "워킹맘·워킹대디 전성시대: 육아기 근로시간 단축 제도", "desc": "일과 육아의 양립을 돕는 '육아기 근로시간 단축' 제도의 지원 대상과 기간이 대폭 확대되었습니다. 단축된 근로시간에 대한 급여 보전과, 눈치 보지 않고 제도를 사용할 수 있는 정부 지원 장려금을 소개합니다."}, {"id": "nsModal32", "title": "귀농·귀촌 희망자 필독! 영농 정착금과 주택 수리비", "desc": "도시를 떠나 새로운 삶을 꿈꾸는 예비 농업인들을 위한 귀농·귀촌 종합 지원책! 최장 3년간 매월 최대 110만 원을 지급하는 청년농 영농정착지원금과 시골집 수리비 반값 지원 혜택을 제대로 활용하세요."}, {"id": "nsModal33", "title": "백내장·임플란트 건강보험 확대 혜택 총정리", "desc": "중장년층과 어르신들의 시력 및 치아 건강을 위해 임플란트 치아 개수 확대 및 백내장 수술비 지원 등 다빈도 수술에 대한 건강보험 보장성이 강화되었습니다. 달라진 보장 범위와 청구 꿀팁을 확인하세요."}, {"id": "nsModal34", "title": "디지털 정보격차 해소: 통신비 감면과 무료 스마트폰", "desc": "디지털 소외 계층인 고령자와 기초생활수급자를 위해 정부가 월 최대 통신비 감면 혜택을 제공하며, 지자체별로 시행 중인 '사랑의 중고 스마트폰 보급 지원' 및 디지털 배움터 무료 교육을 안내합니다."}, {"id": "nsModal35", "title": "고립·은둔 청년 발굴 및 사회 복귀 원스톱 지원", "desc": "방 밖으로 나오기 힘든 청년들을 위한 정부의 따뜻한 손길! 현장 방문 상담부터 맞춤형 심리 치료, 그리고 대인 관계 형성 및 취업 연계까지 돕는 '청년도전지원사업'의 디테일한 혜택을 살펴봅니다."}, {"id": "nsModal36", "title": "치매 국가책임제 2.0: 치매 안심센터와 요양비 지원", "desc": "치매 환자와 그 가족의 고통을 덜어주기 위해 치매 검진 비용 지원, 약제비 보조, 그리고 치매 전담형 장기요양기관 확충 등 더욱 촘촘해진 '치매국가책임제'의 2026년 최신 혜택을 꼼꼼히 짚어드립니다."}, {"id": "nsModal37", "title": "소상공인 폐업 점포 철거비 및 재도전 장려금", "desc": "안타깝게 폐업을 결심한 소상공인들의 부담을 줄여주기 위해 평당 철거비 지원 한도가 상향되었고, 취업이나 재창업 시 지급되는 재도전 특별 장려금 요건이 완화되었습니다. 안전한 퇴로와 새로운 시작을 위한 정보를 담았습니다."}, {"id": "nsModal38", "title": "초중고 교육급여 및 입학준비금 100% 활용", "desc": "저소득층 자녀의 교육 격차 해소를 위해 교육급여 단가가 대폭 인상되었으며, 지자체별로 초중고 신입생에게 교복 밎 체육복, 스마트기기 등 입학준비금을 지급하는 알짜 혜택을 꼭 챙기시길 바랍니다."}, {"id": "nsModal39", "title": "근로장려금 & 자녀장려금: 2026 지급액 상향 안내", "desc": "저소득 근로 가구의 든든한 보너스, 근로장려금과 자녀장려금! 재산 요건이 완화되고 최대 지급액이 상향 조정되어 더 많은 가구가 목돈을 만질 수 있게 되었습니다. 정기 신청과 반기 신청의 차이점도 명확히 알려드립니다."}, {"id": "nsModal40", "title": "청년 면접 정장 대여 및 자격증 응시료 지원", "desc": "취업 준비 비용에 허리가 휘는 청년들을 위해 전국 지자체에서 운영 중인 정장 무료 대여 서비스(취업 날개, 드림 옷장 등)와 어학 및 각종 국가 자격증 응시료 환급 제도를 모았습니다."}, {"id": "nsModal41", "title": "임산부 친환경 농산물 꾸러미 지원 시스템", "desc": "임산부의 건강과 친환경 농가의 판로 확보를 동시에! 월 일정 금액만 부담하면 유기농 농산물과 신선 1등급 고기를 집 앞까지 배송해 주는 임산부 친환경 꾸러미 사업의 신청 방법과 지역별 혜택을 다뤘습니다."}, {"id": "nsModal42", "title": "다문화 가족 및 외국인 근로자 정착 지원", "desc": "한국 사회에 원활히 적응하도록 돕는 다문화 가족 방문 교육, 이중언어 가족환경 조성, 외국인 근로자 무료 진료소 및 체류 자격별 맞춤 지원 서비스 등 글로벌 시대에 걸맞은 맞춤형 복지 제도를 안내합니다."}, {"id": "nsModal43", "title": "여성새로일하기센터 100% 활용한 경력 단절 극복", "desc": "여성새로일하기센터(새일센터)를 통해 제공되는 맞춤형 직업 교육, 인턴십 연계, 그리고 면접 코칭! 육아로 인해 경력이 단절되었던 여성들이 다시 당당하게 사회로 나갈 수 있는 첫걸음을 적극적으로 지원합니다."}, {"id": "nsModal44", "title": "군 복무 중 부상: 국가유공자 및 보훈 보상 체계", "desc": "군 복무 중 입은 부상이나 질병에 대해 국가가 끝까지 책임집니다! 상이등급 상향 판정 기준안, 위탁 병원 진료비 전액 감면, 그리고 취업 시 가산점 등 2026년 개선된 보훈 보상 제도를 정리했습니다."}, {"id": "nsModal45", "title": "햇살론 & 최저신용자 특례보증: 빚의 늪에서 탈출하기", "desc": "불법 사금융에 노출되기 쉬운 저신용·저소득자를 위한 구명줄! 서민금융진흥원의 햇살론 유스, 뱅크, 그리고 최저신용자 특례보증 대출 상품의 금리 및 연체 기록 말소(신용 사면) 혜택을 상세히 설명합니다."}, {"id": "nsModal46", "title": "지방 소멸 대응: 인구 감소 지역 청년 이주 정착금", "desc": "지방 소멸을 막기 위해 89개 인구 감소 지역으로 이주하는 청년 및 신혼부부에게 파격적인 정착 지원금이 지급됩니다. 주택 수리비, 취창업 자금, 심지어 매월 지급되는 생활비 보조 혜택 등 쏠쏠한 로컬 라이프를 소개합니다."}, {"id": "nsModal47", "title": "가족돌봄청년 (영케어러)을 위한 생계 돌봄 수당", "desc": "아픈 가족을 돌보느라 학업과 취업을 포기해야 했던 가족돌봄청년 (영케어러) 발굴 및 지원 체계가 신설되었습니다. 매월 돌봄 수당 지원은 물론 가사 지원 서비스 바우처 혜택으로 청년들의 무거운 어깨를 덜어줍니다."}, {"id": "nsModal48", "title": "난임 부부 시술비 및 냉동난자 지원 확대", "desc": "초저출생 시대, 아이를 간절히 원하는 난임 부부를 위해 정부가 소득 기준을 전면 폐지하고 체외수정 및 인공수정 시술비 지원 횟수를 확대했습니다. 또한 최근 트렌드인 미혼 여성의 가임력 보존을 위한 냉동난자 보조금도 확인하세요."}, {"id": "nsModal49", "title": "국립자연휴양림 및 템플스테이 취약계층 쿠폰", "desc": "경제적 이유로 휴가 한 번 가기 힘든 분들을 위해 산림복지바우처와 문화누리카드가 지원됩니다. 국립자연휴양림 반값 할인, 사찰 숙박 바우처(템플스테이) 등 산림과 문화를 누리며 힐링할 수 있는 혜택을 모았습니다."}, {"id": "nsModal50", "title": "층간소음 갈등 해결사: 방음 시공비 및 상담 지원", "desc": "이웃 간의 얼굴을 붉히는 층간소음 문제! 환경부 층간소음 이웃사이센터의 갈등 중재 서비스와 더불어, 취약 계층을 위한 바닥 소음 저감 매트 설치비 및 방음 시공비 지원 등 평화로운 실내 생활을 위한 제도를 소개합니다."}, {"id": "nsModal7", "title": "초보 사장님 필독! 소상공인 새출발 희망 자금", "desc": "매출 급감과 고금리로 고통받는 자영업자를 위한 2026년 소상공인 특화 지원금과 전기/배달비 감면 혜택을 총망라했습니다. 폐업 위기 극복부터 재창업 성공까지 정부가 밀어주는 핵심 제도를\n                확인하세요."}, {"id": "nsModal8", "title": "다둥이 맘빠의 구원투수: 2026 다자녀 혜택 완벽 가이드", "desc": "아이 키우기 좋은 세상을 위해 2026년부터 2자녀 이상만 되어도 다자녀 혜택을 전면 적용받습니다. 자동차세 감면부터 아이돌봄 지원금, 그리고 국가장학금 꿀팁까지 부모님의 부담을 덜어줄\n                정보를 담았습니다."}, {"id": "nsModal9", "title": "월세족 필독: 청년 월세 지원 & 전세보증금 반환보증", "desc": "다달이 나가는 월세가 아까운 무주택 청년들을 위한 청년 월세 특별지원과, 전세사기로부터 내 보증금을 지킬 수 있는 HUG 보증료 전액 지원 등 2030 세대의 주거 안정을 위한 필수 혜택을\n                소개합니다."}, {"id": "nsModal10", "title": "숨은 요금 찾기: 통신비 환급과 에너지 바우처", "desc": "매달 내는 통신비 안에 내가 몰랐던 환급금이 숨어있다는 사실 알고 계셨나요? 취약계층 에너지 바우처 확대 및 알뜰폰 전환 꿀팁 등 당장 실생활에서 돈을 10만 원 이상 아낄 수 있는 정책을\n                모았습니다."}, {"id": "nsModal11", "title": "은퇴 후가 진짜 인생! 신중년 경력형 우대 일자리", "desc": "은퇴를 앞두거나 이미 퇴직하신 5060 액티브 시니어를 위해 정부에서 새롭게 마련한 경력 우대형 일자리와 직업 훈련 시스템을 안내합니다. 재취업의 기회를 잡고 제2의 월급을 만들어 보세요."}, {"id": "nsModal12", "title": "한부모 가족을 위한 따뜻한 동행: 양육비와 자립 지원", "desc": "혼자서 아이를 키우며 고군분투하는 한부모 가족을 위해 아동양육비 지원 단가가 크게 올랐습니다. 생계비 보조뿐만 아니라 돌봄 서비스 우선 제공, 아이돌보미 혜택 등 든든한 바람막이가 되어줄\n                제도를 확인하세요."}, {"id": "nsModal13", "title": "카드 포인트가 현금으로? 숨은 돈 1분 만에 찾기", "desc": "정부 지원금은 아니지만 누구나 받을 수 있는 숨은 돈! 여러 카드사에 흩어진 포인트, 잊고 있던 휴면 예금과 자동차 환급금까지 스마트폰 하나로 1분 만에 조회하고 내 계좌로 바로 쏙\n                입금받는 방법을 정리했습니다."}, {"id": "nsModal14", "title": "K-패스 완전 정복: 대중교통비 매월 최대 53% 환급", "desc": "매일 출퇴근하는 직장인과 학생들의 교통비를 절반으로 줄여줄 'K-패스' 혜택이 대폭 상향되었습니다. 알뜰교통카드의 복잡한 조건을 없애고 그냥 썼을 뿐인데 매월 현금으로 캐시백 되는 마법을\n                확인하세요."}, {"id": "nsModal15", "title": "병원비 걱정 뚝! 재난적 의료비 & 본인부담상한제", "desc": "갑작스러운 큰 질병으로 인한 의료비 부담, 이제 정부가 막아줍니다! 저소득층은 물론 중산층까지 혜택이 확대된 재난적 의료비 지원 제도와 1년간 지불한 병원비 일부를 돌려받는 본인부담상한제를\n                알아두세요."}, {"id": "nsModal16", "title": "농어업인을 위한 직불금 2.0: 든든한 농가 소득 안전망", "desc": "농어촌의 고령화와 인구 감소 극복을 위해 2026년부터 개편된 기본형 공익직불금 및 청년 농업인 영농 정착 지원금을 소개합니다. 스마트팜 지원부터 농기계 임대 혜택까지, 농어업인이라면 절대\n                놓쳐선 안 될 정보입니다."}, {"id": "nsModal17", "title": "국군 장병 화이팅! 장병내일준비적금 & 제대 군인 혜택", "desc": "군 복무 기간 동안 매월 적금을 부으면 정부가 이자와 매칭 지원금을 더해 전역 시 약 2천만 원의 목돈을 쥘 수 있는 장병내일준비적금! 나라를 지켜준 군인과 예비군을 위한 다양한 교육 및\n                취업 지원 혜택을 알아보세요."}, {"id": "nsModal18", "title": "장애인 자립을 위한 2026 복지 패러다임 전환", "desc": "장애인 연금 수급액 상향과 더불어 장애인 활동 지원 서비스 등급이 대폭 개편되었습니다. 맞춤형 일자리 제공과 이동권 보장을 위한 특별교통수단 확충 등, 장애인의 진정한 자립을 위한 정부의\n                다각적인 지원책을 안내합니다."}, {"id": "nsModal19", "title": "전청서 꿀팁! 청년도약계좌 & 청년주택드림청약통장", "desc": "청년들의 내 집 마련과 자산 형성을 동시에 돕는 최강의 조합! 최고 연 6%대 이자와 정부 기여금이 더해진 청년도약계좌, 그리고 주택 청약 시 파격적인 금리 혜택을 제공하는\n                청년주택드림청약통장 활용법을 마스터하세요."}, {"id": "nsModal20", "title": "보육 대란 끝! 늘봄학교 전국 확대 및 양육수당", "desc": "초등학생 자녀를 둔 맞벌이 부부의 구세주 '늘봄학교'가 전국 100% 도입 완성되었습니다. 오전 7시부터 저녁 8시까지 안심하고 아이를 맡길 수 있는 촘촘한 돌봄 체계와 올해 더 늘어난\n                부모 급여 혜택을 챙겨보세요."}, {"id": "nsModal21", "title": "내일배움카드 200% 활용법: 코딩부터 뷰티까지 무료로", "desc": "전 국민의 평생교육을 책임지는 국민내일배움카드! 훈련비 지원 한도가 500만 원까지 상향되었고, 특히 디지털 핵심 실무 인재를 양성하는 K-디지털 트레이닝 과정은 전액 무료입니다. 내게\n                필요한 강의 찾기 꿀팁을 대공개합니다."}, {"id": "nsModal22", "title": "주거 급여 & 생계 급여: 2026년 기준 중위소득 대폭 인상", "desc": "기초생활보장제도의 핵심인 생계급여와 주거급여의 선정 기준선이 역대 최대 폭으로 인상되어 더 많은 분들이 수급 혜택을 누리게 되었습니다. 수급 자격 요건 완화와 자동차 재산 산정 기준 개편\n                등 가장 중요한 변화를 요약했습니다."}, {"id": "nsModal23", "title": "예술인 및 프리랜서 전폭 지원: 창작 준비금 & 고용보험", "desc": "근로기준법의 사각지대에 있던 예술인과 프리랜서 플랫폼 노동자들을 위한 고용보험 적용 범위가 크게 확대되었습니다. 생계 걱정 없이 창작 활동에 전념할 수 있도록 돕는 창작 준비금 지원 사업과\n                불공정 계약 방지책을 확인하세요."}, {"id": "nsModal24", "title": "친환경 전기차/수소차 보조금 A to Z", "desc": "미래 세대를 위한 필수 선택, 친환경 자동차! 2026년 전기차와 수소차 보조금 지급 기준이 새롭게 개편되었습니다. 국가 보조금에 지자체 추가 보조금까지 합쳐 차량 구매 비용을 수천만 원\n                아끼는 지역별 꿀팁을 정리했습니다."}, {"id": "nsModal25", "title": "반려동물 가구 희소식! 펫 보험 & 의료비 지원 제도", "desc": "반려동물 양육 인구 1,500만 시대! 부담스러운 동물 병원 진료비 부담을 덜어주기 위해 취약계층을 대상으로 반려동물 의료비 지원 사업이 확대 시행됩니다. 또한 정부가 장려하는 유기견 입양\n                지원금과 펫 보험 혜택을 알아보세요."}, {"id": "nsModal26", "title": "자립준비청년 (보호종료아동) 맞춤형 홀로서기 가이드", "desc": "아동 양육 시설에서 퇴소하여 홀로 세상을 마주해야 하는 자립준비청년들을 위해 자립정착금과 매월 지급되는 자립수당이 인상되었습니다. 주거, 학업, 취업에 이르는 통합 지원 체계와 심리 상담\n                혜택까지, 따뜻한 응원의 정보를 담았습니다."}];
            
            // Pick 5 random newsletters
            const shuffled = allNewsletters.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 5);
            
            let html = '';
            selected.forEach(nl => {
                html += `
                    <div style="background:#f8fafc; border-radius:12px; padding:16px; border:1px solid #e2e8f0; cursor:pointer; transition:all 0.2s;"
                        onmouseover="this.style.borderColor='var(--primary)'; this.style.transform='translateY(-2px)';"
                        onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='none';"
                        onclick="openModal('${nl.id}')">
                        <span style="display:inline-block; font-size:11px; font-weight:800; color:#ef4444; background:#fee2e2; padding:3px 8px; border-radius:4px; margin-bottom:8px;">추천 ⭐️</span>
                        <h4 style="font-size:15px; font-weight:700; color:#1e293b; margin-bottom:6px;">${nl.title}</h4>
                        <p style="font-size:13px; color:#475569; margin:0; line-height:1.5;">${nl.desc.length > 50 ? nl.desc.substring(0, 50) + '...' : nl.desc}</p>
                        <div style="margin-top:10px; font-size:13px; font-weight:700; color:var(--primary);">자세히 보기 ➔</div>
                    </div>
                `;
            });
            aiGrid.innerHTML = html;
        }
    } else {
        if (aiNewsletterWrapper) aiNewsletterWrapper.style.display = 'none';
    }

    const items = currentBenefits[category];
    if (!items || items.length === 0) {
        if (category !== 'agency') {
            list.innerHTML = '<p style="text-align:center; padding:40px; color:#64748b;">관련된 혜택이 아직 없습니다.</p>';
        }
        return;
    }

    items.forEach(b => {
        const card = document.createElement('div');
        card.className = 'benefit-card animate-fade';

        // 금액 표시 포맷
        const amountText = b.monthlyAmount ? `최대 ${Math.round(b.monthlyAmount).toLocaleString()}원` : '혜택 확인 필요';

        // 해시태그 렌더링
        let tagsHtml = '';
        if (b.matchedTags && b.matchedTags.length > 0) {
            tagsHtml = `<div class="hashtags">` + b.matchedTags.map(t => `<span class="hashtag-badge">#${t}</span>`).join('') + `</div>`;
        }

        // 블로그 검색 URL: 혜택명 키워드로 자동 연결
        const blogKeyword = encodeURIComponent(b.name.replace(/[\[\]]/g, '').trim());
        const blogUrl = `https://10000nanzip.tistory.com/search/${blogKeyword}`;

        card.innerHTML = `
            <div class="agency-badge">🏛️ ${b.tag || '중앙부처'}</div>
            ${tagsHtml}
            <div class="benefit-title">${b.name}</div>
            <div class="benefit-desc">${b.desc || b.description}</div>
            <div class="benefit-meta">
                <div class="benefit-amount">💰 ${amountText}</div>
                <a href="${b.applyUrl || '#'}" target="${linkTarget}" class="benefit-link-btn">신청하기 ➔</a>
            </div>
            <a href="${blogUrl}" target="${linkTarget}" class="blog-cta-btn">
                📖 신청 꿀팁 블로그에서 확인하기
            </a>
        `;
        list.appendChild(card);
    });
}

// (기존 카카오맵 관련 코드는 복지로 지도 iframe으로 대체됨)

// 숫자 애니메이션 함수
function animateNumber(id, target, duration, isLocale = false) {
    const el = document.getElementById(id);
    if (!el) return;
    let start = 0;
    const startTime = performance.now();
    function step(currentTime) {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const value = Math.floor(progress * target);
        el.textContent = isLocale ? value.toLocaleString() : value;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// 꽃가루 효과 (V3 통합 버전)
function triggerConfetti() {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#1a56db', '#a855f7', '#f59e0b', '#10b981', '#ef4444'];

    for (let i = 0; i < 150; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 3 + 2,
            angle: Math.random() * 6.28
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            p.y += p.speed;
            p.angle += 0.1;
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        });

        if (pieces.every(p => p.y > canvas.height)) {
            canvas.remove();
        } else {
            requestAnimationFrame(draw);
        }
    }
    draw();
}

// 복사 및 공유
function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => showToast('🔗 링크가 복사되었습니다!'));
}

function shareKakao() {
    showToast('💬 카카오톡 공유 기능이 준비 중입니다. 링크 복사를 이용해주세요!');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// AI 챗봇
// AI 챗봇 (V12 Scenario)
const chatScenario = {
    intro: "안녕 하세요! 당신의 든든한 지원군, **로거**예요! 🐶✨<br>복지 점수 리포트는 잘 보셨나요? 궁금한 게 있다면 무엇이든 편하게 물어봐 주세요!",
    options: [
        { text: "💰 제가 놓친 돈이 더 있을까요?", answer: "지금 입력하신 정보로는 최적의 혜택을 다 찾아드렸어요! 혹시 가족 관계에 변화가 생기거나, 소득 기준이 바뀌면 새로운 혜택이 뜰 수 있으니 가끔씩 저를 다시 찾아주세요! 😉" },
        { text: "📝 신청 방법이 궁금해요!", answer: "각 혜택 카드에 있는 **'신청하기'** 버튼을 누르면 바로 연결해 드려요! 준비물이 복잡할 땐 제가 블로그에 꿀팁을 정리해둘게요. 걱정 마세요! 🙌" },
        { text: "📊 제 점수, 이 정도면 괜찮은 건가요?", answer: "와우! 상위권에 속하는 아주 훌륭한 점수예요! 👍 평소에 복지 정보에 관심이 많으시군요? 부족한 부분은 제가 채워드릴 테니 함께 만점을 향해 가봐요!" }
    ]
};

document.getElementById('btn-ai-chat').onclick = () => {
    const chatBox = document.getElementById('aiChatBox');
    if (chatBox.style.display === 'block') {
        chatBox.style.display = 'none';
    } else {
        chatBox.style.display = 'block';
        initChat();
    }
};

function initChat() {
    const content = document.getElementById('chatContent');
    if (content.childElementCount > 0) return; // 이미 초기화됨

    addMessage('bot', chatScenario.intro);
    renderOptions();
}

function addMessage(sender, text) {
    const content = document.getElementById('chatContent');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${sender}`;
    msgDiv.innerHTML = text;
    content.appendChild(msgDiv);

    // 메시지 추가 후 항상 최하단으로 스크롤 (V17 개선)
    requestAnimationFrame(() => {
        content.scrollTop = content.scrollHeight;
    });
}

function renderOptions() {
    const content = document.getElementById('chatContent');
    const optDiv = document.createElement('div');
    optDiv.className = 'chat-options';

    chatScenario.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'chat-opt-btn';
        btn.textContent = opt.text;
        btn.onclick = () => {
            addMessage('user', opt.text);
            setTimeout(() => addMessage('bot', opt.answer), 600);
        };
        optDiv.appendChild(btn);
    });
    content.appendChild(optDiv);

    // 옵션 표시 후에도 최하단으로 스크롤 (V17 개선)
    requestAnimationFrame(() => {
        content.scrollTop = content.scrollHeight;
    });
}

// 챗봇 자유 검색 (V20)
function handleChatInput() {
    const input = document.getElementById('chatInput');
    const query = input.value.trim();
    if (!query) return;

    addMessage('user', query);
    input.value = '';

    setTimeout(() => {
        const results = chatSearch(query);
        if (results.length === 0) {
            addMessage('bot', `"${query}"에 대한 혜택을 찾지 못했어요 😅<br>더 구체적으로 입력해보시거나, <a href="https://10000nanzip.tistory.com" target="${linkTarget}" style="color:var(--primary);font-weight:700;">블로그</a>에서 검색해보세요!`);
        } else {
            let html = `<b>🔍 "${query}"</b> 관련 혜택 <b>${results.length}건</b>을 찾았어요!<br><br>`;
            results.slice(0, 4).forEach(b => {
                const blogKeyword = encodeURIComponent(b.name.replace(/[\[\]]/g, '').trim());
                html += `<div style="background:#f1f5f9;border-radius:10px;padding:10px 12px;margin-bottom:8px;">
                    <div style="font-weight:700;font-size:13px;margin-bottom:3px;">${b.icon || '💎'} ${b.name}</div>
                    <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${(b.desc || b.description || '').substring(0, 50)}...</div>
                    <a href="https://10000nanzip.tistory.com/search/${blogKeyword}" target="${linkTarget}" style="font-size:11px;color:var(--primary);font-weight:700;">📖 블로그에서 상세보기 →</a>
                </div>`;
            });
            if (results.length > 4) html += `<div style="font-size:12px;color:#64748b;">외 ${results.length - 4}건 더 있어요. 결과 페이지에서 확인해보세요!</div>`;
            addMessage('bot', html);
        }
    }, 600);
}

// 키워드 기반 혜택 검색
function chatSearch(query) {
    const ageMap = { '10대': '10대이하', '20대': '20대', '30대': '30대', '40대': '40대', '50대': '50대', '60대': '60대이상' };
    const categoryMap = {
        '주거': '주거', '집': '주거', '전세': '주거', '월세': '주거',
        '취업': '취업', '일자리': '취업', '취직': '취업', '창업': '취업',
        '육아': '육아', '아이': '육아', '보육': '육아', '출산': '육아',
        '교육': '교육', '학비': '교육', '장학': '교육',
        '의료': '의료', '건강': '의료', '병원': '의료',
        '생활비': '생활비', '생계': '생활비', '지원금': '생활비'
    };
    const householdMap = {
        '1인': '1인가구', '혼자': '1인가구', '독신': '1인가구',
        '신혼': '신혼부부', '결혼': '신혼부부',
        '자녀': '자녀있음', '아이': '자녀있음',
        '다자녀': '다자녀', '3명': '다자녀',
        '한부모': '한부모', '미혼모': '한부모', '미혼부': '한부모'
    };

    let targetAge = null, targetCategory = null, targetHousehold = null;

    Object.entries(ageMap).forEach(([k, v]) => { if (query.includes(k)) targetAge = v; });
    Object.entries(categoryMap).forEach(([k, v]) => { if (query.includes(k)) targetCategory = v; });
    Object.entries(householdMap).forEach(([k, v]) => { if (query.includes(k)) targetHousehold = v; });

    // 아무 키워드도 없으면 빈 배열
    if (!targetAge && !targetCategory && !targetHousehold) return [];

    const incomeNum = 200; // 검색 시 기본값 200만원 가정
    const familyCount = 1;
    const fakeData = {
        age: targetAge || answers.age || '30대',
        household: targetHousehold || answers.household || '1인가구',
        income: answers.income || '100-250만원',
        category: targetCategory || '전체',
        region: answers.region || 'seoul',
        subRegion: answers.subRegion || '',
        incomeNum, familyCount
    };

    return welfareData.filter(item => {
        try {
            let catMatch = true;
            if (targetCategory) catMatch = item.category === targetCategory;
            return item.condition(fakeData) && catMatch;
        } catch { return false; }
    }).slice(0, 8);
}

// 엔터키로 전송
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chatInput');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleChatInput();
        });
    }
});

// PDF 다운로드
function downloadPdf() {
    const element = document.getElementById('app-content');
    const opt = {
        margin: 10,
        filename: 'my_welfare_report_v10.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(element).set(opt).save();
}

// 다시 시작 (페이지 새로고침 없는 테마)
function restart() {
    window.scrollTo({ top: 0, behavior: 'instant' });
    Object.keys(answers).forEach(key => delete answers[key]);

    document.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.btn-next').forEach(b => b.disabled = true);

    document.querySelector('.step.active').classList.remove('active');
    document.getElementById('step-intro').classList.add('active');
    updateProgress(0);

    const progressWrap = document.getElementById('progressWrap');
    if (progressWrap) progressWrap.style.display = 'none';
    const topAd = document.getElementById('topAdZone');
    if (topAd) topAd.style.display = 'block';

    // 히스토리 초기화
    history.replaceState({ step: 'intro' }, '', '#intro');
}

// --- V22: SEO Newsletters & Intro Modal Control ---

function startTest() {
    document.getElementById('step-intro').classList.remove('active');
    document.getElementById('step-1').classList.add('active');

    // 진행바 표시 및 상단 광고 숨김(로딩/질문 중 구글 정책 준수)
    const progressWrap = document.getElementById('progressWrap');
    if (progressWrap) progressWrap.style.display = 'block';

    const topAd = document.getElementById('topAdZone');
    if (topAd) topAd.style.display = 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.pushState({ step: 1 }, '', '#step-1');
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // 스크롤 방지
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

// 모달 외부 클릭 시 닫기
window.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('show');
        document.body.style.overflow = '';
    }
});
