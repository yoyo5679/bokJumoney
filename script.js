// ───────────────────────── 복주머니 v2 ─────────────────────────
// 화면 흐름: 홈 → 설문(질문 4개) → 찾는 중 → 결과, 그리고 검색·분야별 / 저장한 혜택
// 혜택 데이터: generated_data.js(전국 혜택, SUB_REGIONS) + data/regions/{지역}.js(지역 혜택)
//   → data-engine/build_site_data.py 가 만든 압축 형식이라 prepareWelfareItem 으로 변환해서 쓴다.

const REGION_NAMES = {
    seoul: '서울', gyeonggi: '경기', incheon: '인천', busan: '부산', daegu: '대구',
    gwangju: '광주', daejeon: '대전', ulsan: '울산', sejong: '세종', gangwon: '강원',
    chungbuk: '충북', chungnam: '충남', jeonbuk: '전북', jeonnam: '전남',
    gyeongbuk: '경북', gyeongnam: '경남', jeju: '제주'
};

// ── 혜택 데이터 준비 ──
const AGE_RANGES = {
    '10대이하': [0, 19], '20대': [20, 29], '30대': [30, 39],
    '40대': [40, 49], '50대': [50, 59], '60대이상': [60, 150]
};
const LIFECYCLE_AGES = {
    '임신출산': [0, 1], '영유아': [0, 6], '아동': [7, 12], '청소년': [13, 18],
    '청년': [19, 39], '중장년': [40, 64], '노년': [65, 150]
};

function matchesWelfareItem(raw, data) {
    if (raw.r && !raw.r.includes(data.region)) return false;
    if (raw.s && data.subRegion && raw.s !== data.subRegion) return false;
    if (raw.a) {
        // 대상 연령은 혜택 받는 사람 기준 → 본인 나이대나 선택한 생애주기(가구원) 중 하나라도 겹치면 통과
        const ranges = [AGE_RANGES[data.age], ...(data.lc || []).map(lc => LIFECYCLE_AGES[lc])].filter(Boolean);
        if (ranges.length && !ranges.some(([lo, hi]) => raw.a[0] <= hi && lo <= raw.a[1])) return false;
    }
    if (raw.q) {
        // 묶음마다 사용자의 생애주기/가구상황 중 하나 이상 일치해야 한다
        const mine = [...(data.lc || []), ...(data.hh || [])];
        if (!raw.q.every(group => group.some(token => mine.includes(token)))) return false;
    }
    return true;
}

function prepareWelfareItem(raw) {
    return {
        id: raw.k,
        name: raw.n,
        tag: raw.t || '',
        description: (raw.d || '').replace(/\s+/g, ' ').trim(),
        applyUrl: raw.u || '',
        icon: raw.i || '🎁',
        category: raw.c,
        origin: raw.o,
        relevance: raw.v || 0,
        isLocal: !!raw.r,
        regions: raw.r || [],
        subRegion: raw.s || '',
        targetGroups: raw.q || [], // 대상 조건 묶음 (묶음마다 하나 이상 해당)
        ageRange: raw.a || null,
        deadline: raw.e || '', // 신청 마감 ('상시' 또는 '~2026.11.30')
        condition: data => matchesWelfareItem(raw, data)
    };
}

welfareData.forEach((raw, i) => { welfareData[i] = prepareWelfareItem(raw); });

// 지역 혜택은 사는 곳을 고를 때 해당 지역 파일만 한 번 불러온다
const loadedRegions = {};
const loadedItemIds = new Set(welfareData.map(item => item.id));

function registerRegionData(region, items) {
    items.forEach(raw => {
        if (loadedItemIds.has(raw.k)) return; // 광주·전남 통합 기관 혜택은 두 지역 파일에 모두 있음
        loadedItemIds.add(raw.k);
        welfareData.push(prepareWelfareItem(raw));
    });
}

function loadRegionData(region) {
    if (!region) return Promise.resolve();
    if (!loadedRegions[region]) {
        loadedRegions[region] = new Promise(resolve => {
            const script = document.createElement('script');
            script.src = `data/regions/${region}.js?v=${WELFARE_DATA_VERSION}`;
            script.onload = resolve;
            script.onerror = resolve; // 실패해도 전국 혜택으로 결과를 보여준다
            document.head.appendChild(script);
        });
    }
    return loadedRegions[region];
}

// ── 온통청년 실시간 조회 (Vercel 서버 함수 api/youth-policy.js 경유) ──
// 미리 만들어 둔 청년정책 데이터에 최신 정책을 더한다. 배포 환경에서만 동작하고,
// 서버 함수가 없거나 응답이 늦으면 건너뛰고 미리 만든 데이터만으로 결과를 보여준다.
const LIVE_YOUTH_PAGE_SIZE = 100;
const LIVE_YOUTH_MAX_PAGES = 15;
const LIVE_YOUTH_TIMEOUT = 10000; // 요청 하나당 제한 (백그라운드)
const LIVE_YOUTH_WAIT = 1500;     // 결과 화면을 띄우기 전에 더 기다려 주는 시간

// 온통청년 zipCd (법정동 시도·시군구 코드, 전북특별자치도는 2024년부터 52로 시작)
const YOUTH_SIDO_ZIP = {
    seoul: '11000', busan: '26000', daegu: '27000', incheon: '28000', gwangju: '29000',
    daejeon: '30000', ulsan: '31000', sejong: '36000', gyeonggi: '41000', gangwon: '51000',
    chungbuk: '43000', chungnam: '44000', jeonbuk: '52000', jeonnam: '46000',
    gyeongbuk: '47000', gyeongnam: '48000', jeju: '50000'
};
const YOUTH_DISTRICT_ZIP = {
    seoul: { '강남구': '11680', '강동구': '11740', '강북구': '11305', '강서구': '11500', '관악구': '11620', '광진구': '11215', '구로구': '11530', '금천구': '11545', '노원구': '11350', '도봉구': '11320', '동대문구': '11230', '동작구': '11590', '마포구': '11440', '서대문구': '11410', '서초구': '11650', '성동구': '11200', '성북구': '11290', '송파구': '11710', '양천구': '11470', '영등포구': '11560', '용산구': '11170', '은평구': '11380', '종로구': '11110', '중구': '11140', '중랑구': '11260' },
    gyeonggi: { '수원시': '41110', '고양시': '41280', '용인시': '41460', '성남시': '41130', '부천시': '41190', '화성시': '41590', '안산시': '41270', '남양주시': '41360', '안양시': '41170', '평택시': '41220', '시흥시': '41390', '파주시': '41480', '의정부시': '41150', '김포시': '41570', '광주시': '41610', '광명시': '41210', '군포시': '41410', '하남시': '41450', '오산시': '41370', '양주시': '41630', '이천시': '41500', '구리시': '41310', '안성시': '41550', '의왕시': '41430', '여주시': '41670', '양평군': '41830', '동두천시': '41250', '과천시': '41290', '가평군': '41820', '연천군': '41800', '포천시': '41650' },
    busan: { '강서구': '26440', '금정구': '26410', '기장군': '26710', '남구': '26290', '동구': '26170', '동래구': '26260', '부산진구': '26230', '북구': '26320', '사상구': '26530', '사하구': '26380', '서구': '26140', '수영구': '26500', '연제구': '26470', '영도구': '26200', '중구': '26110', '해운대구': '26350' },
    incheon: { '강화군': '28710', '계양구': '28245', '남동구': '28200', '미추홀구': '28177', '부평구': '28237', '연수구': '28185', '옹진군': '28720' },
    daegu: { '군위군': '27720', '남구': '27200', '달서구': '27290', '달성군': '27710', '동구': '27140', '북구': '27230', '서구': '27170', '수성구': '27260', '중구': '27110' },
    gwangju: { '광산구': '29200', '남구': '29155', '동구': '29110', '북구': '29170', '서구': '29140' },
    daejeon: { '대덕구': '30230', '동구': '30110', '서구': '30170', '유성구': '30200', '중구': '30140' },
    ulsan: { '남구': '31140', '동구': '31170', '북구': '31200', '울주군': '31710', '중구': '31110' },
    sejong: { '세종시': '36110' },
    gangwon: { '춘천시': '51110', '원주시': '51130', '강릉시': '51150', '동해시': '51170', '태백시': '51190', '속초시': '51210', '삼척시': '51230', '홍천군': '51720', '횡성군': '51730', '영월군': '51750', '평창군': '51760', '정선군': '51770', '철원군': '51780', '화천군': '51790', '양구군': '51800', '인제군': '51810', '고성군': '51820', '양양군': '51830' },
    chungbuk: { '청주시': '43110', '충주시': '43130', '제천시': '43150', '보은군': '43720', '옥천군': '43730', '영동군': '43740', '증평군': '43745', '진천군': '43750', '괴산군': '43760', '음성군': '43770', '단양군': '43800' },
    chungnam: { '천안시': '44130', '공주시': '44150', '보령시': '44180', '아산시': '44200', '서산시': '44210', '논산시': '44230', '계룡시': '44250', '당진시': '44270', '금산군': '44710', '부여군': '44760', '서천군': '44770', '청양군': '44790', '홍성군': '44800', '예산군': '44810', '태안군': '44825' },
    jeonbuk: { '전주시': '52110', '군산시': '52130', '익산시': '52140', '정읍시': '52180', '남원시': '52190', '김제시': '52210', '완주군': '52710', '진안군': '52720', '무주군': '52730', '장수군': '52740', '임실군': '52750', '순창군': '52770', '고창군': '52790', '부안군': '52800' },
    jeonnam: { '목포시': '46110', '여수시': '46130', '순천시': '46150', '나주시': '46170', '광양시': '46230', '담양군': '46710', '곡성군': '46720', '구례군': '46730', '고흥군': '46770', '보성군': '46780', '화순군': '46790', '장흥군': '46800', '강진군': '46810', '해남군': '46820', '영암군': '46830', '무안군': '46840', '함평군': '46860', '영광군': '46870', '장성군': '46880', '완도군': '46890', '진도군': '46900', '신안군': '46910' },
    gyeongbuk: { '포항시': '47110', '경주시': '47130', '김천시': '47150', '안동시': '47170', '구미시': '47190', '영주시': '47210', '영천시': '47230', '상주시': '47250', '문경시': '47280', '경산시': '47290', '의성군': '47730', '청송군': '47750', '영양군': '47760', '영덕군': '47770', '청도군': '47820', '고령군': '47830', '성주군': '47840', '칠곡군': '47850', '예천군': '47900', '봉화군': '47920', '울진군': '47930', '울릉군': '47940' },
    gyeongnam: { '창원시': '48120', '진주시': '48170', '통영시': '48220', '사천시': '48240', '김해시': '48250', '밀양시': '48270', '거제시': '48310', '양산시': '48330', '의령군': '48720', '함안군': '48730', '창녕군': '48740', '고성군': '48820', '남해군': '48840', '하동군': '48850', '산청군': '48860', '함양군': '48870', '거창군': '48880', '합천군': '48890' },
    jeju: { '제주시': '50110', '서귀포시': '50130' }
};

// 등록기관의 상위기관(시도) → 지역
const YOUTH_SIDO_REGIONS = {
    '서울특별시': ['seoul'], '부산광역시': ['busan'], '대구광역시': ['daegu'], '인천광역시': ['incheon'],
    '광주광역시': ['gwangju'], '대전광역시': ['daejeon'], '울산광역시': ['ulsan'], '세종특별자치시': ['sejong'],
    '경기도': ['gyeonggi'], '강원특별자치도': ['gangwon'], '충청북도': ['chungbuk'], '충청남도': ['chungnam'],
    '전북특별자치도': ['jeonbuk'], '전라남도': ['jeonnam'], '경상북도': ['gyeongbuk'], '경상남도': ['gyeongnam'],
    '제주특별자치도': ['jeju'], '전남광주통합특별시': ['gwangju', 'jeonnam']
};

// 정책 이름에 적힌 대상 → 그 상황을 고른 사람에게만 (data-engine/build_site_data.py 의 NAME_TARGETS 와 같은 기준)
const YOUTH_NAME_TARGETS = [
    ['한부모조손', ['한부모', '조손']], ['장애인', ['장애인', '장애아', '장애학생', '발달장애']],
    ['다문화탈북민', ['다문화', '북한이탈', '탈북', '결혼이민']], ['보훈대상자', ['보훈', '국가유공', '유공자', '참전']],
    ['다자녀', ['다자녀', '다둥이']], ['저소득', ['기초생활', '차상위', '저소득']],
    ['임신출산', ['임산부', '난임', '산모', '산후조리']], ['농어업인', ['농업인', '어업인', '농어업인', '농어민', '임업인']],
    ['대학생', ['대학생', '대학원생']], ['구직자', ['구직자', '미취업', '실업자']], ['자영업자', ['소상공인', '자영업']]
];

const formatYmd = ymd => `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`;

function youthPolicyToRaw(p, today) {
    const name = (p.plcyNm || '').trim();
    const mainCategory = (p.lclsfNm || '').split(',')[0];
    if (!name || mainCategory.startsWith('참여')) return null; // 소식지·네트워크 등은 제외
    if (p.aplyPrdSeCd === '0057003') return null; // 신청 마감
    const end = (p.aplyYmd || '').split('~').pop().replace(/\D/g, '').slice(0, 8);
    if (p.aplyPrdSeCd === '0057001' && end.length === 8 && end < today) return null;

    // sprtTrgtAgeLmtYn: 'Y' = 연령 제한 없음 → 청년정책이므로 청년 연령대로 본다
    const maxAge = parseInt(p.sprtTrgtMaxAge, 10) || 0;
    const age = p.sprtTrgtAgeLmtYn === 'Y' || !maxAge ? [19, 39] : [parseInt(p.sprtTrgtMinAge, 10) || 0, maxAge];

    // 지역: 등록기관 상위기관이 시도면 그 지역, 중앙부처 등이면 전국
    let regions = YOUTH_SIDO_REGIONS[(p.rgtrUpInstCdNm || '').trim().split(/\s+/)[0]] || null;
    let subRegion = '';
    const instParts = (p.rgtrInstCdNm || '').trim().split(/\s+/);
    if (regions && instParts.length >= 2) {
        const region = regions.find(r => (SUB_REGIONS[r] || []).includes(instParts[1]));
        if (region) { regions = [region]; subRegion = instParts[1]; }
    }

    let category = '생활지원';
    if (mainCategory === '일자리') category = '일자리';
    else if (mainCategory === '주거') category = '주거';
    else if (mainCategory.startsWith('교육')) category = '교육';
    else if (/대출|융자|보증|금융|저축|통장|적금|이자|자산형성/.test(name)) category = '서민금융';
    else if (/문화|예술|공연|여행|체육|관광/.test(name)) category = '문화여가';

    const targets = YOUTH_NAME_TARGETS.filter(([, words]) => words.some(w => name.includes(w))).map(([token]) => token);
    const deadline = p.aplyPrdSeCd === '0057002' ? '상시' : end.length === 8 ? `~${formatYmd(end)}` : '';

    return {
        k: `youth_${p.plcyNo}`,
        n: name,
        o: 'youth',
        t: p.sprvsnInstCdNm || p.rgtrInstCdNm || '온통청년',
        d: p.plcyExplnCn || p.plcySprtCn || '',
        u: p.aplyUrlAddr || `https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/${p.plcyNo}`,
        c: category,
        i: (CATEGORIES.find(([id]) => id === category) || [])[1] || '🌱',
        v: 90,
        a: age,
        q: targets.length ? [targets] : undefined,
        r: regions || undefined,
        s: subRegion || undefined,
        e: deadline || undefined
    };
}

const liveYouthLoads = {};

function fetchYouthPage(zip, page) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIVE_YOUTH_TIMEOUT);
    // 상대 경로: saboknote.com/benefits/ 아래에서 열려도 /benefits/api/… 로 이 프로젝트의 API를 부른다
    return fetch(`api/youth-policy?pageNum=${page}&pageSize=${LIVE_YOUTH_PAGE_SIZE}&zipCd=${zip}`, { signal: controller.signal })
        .then(res => (res.ok ? res.json() : null))
        .finally(() => clearTimeout(timer));
}

function addYouthPolicies(data) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const policies = data?.result?.youthPolicyList || [];
    upsertWelfareItems(policies.map(p => youthPolicyToRaw(p, today)).filter(Boolean));
}

// 시군구 코드로 조회하면 그 시군구에 해당하는 시도·전국 정책도 함께 온다.
// 한 번에 많이 받으면 느려서(500건 5~6초) 100건씩 나눠 동시에 받는다.
function loadLiveYouthPolicies(region, subRegion) {
    const zip = (YOUTH_DISTRICT_ZIP[region] || {})[subRegion] || YOUTH_SIDO_ZIP[region];
    if (!zip) return Promise.resolve();
    if (!liveYouthLoads[zip]) {
        liveYouthLoads[zip] = (async () => {
            try {
                const first = await fetchYouthPage(zip, 1);
                addYouthPolicies(first);
                const total = first?.result?.pagging?.totCount || 0;
                const pages = Math.min(Math.ceil(total / LIVE_YOUTH_PAGE_SIZE), LIVE_YOUTH_MAX_PAGES);
                const rest = [];
                for (let page = 2; page <= pages; page++) rest.push(fetchYouthPage(zip, page).then(addYouthPolicies));
                await Promise.allSettled(rest);
            } catch {
                delete liveYouthLoads[zip]; // 로컬 환경·타임아웃 등 → 다음에 다시 시도
            }
        })();
    }
    return liveYouthLoads[zip];
}

// 실시간 정책은 미리 만든 데이터보다 최신이므로 같은 정책이면 교체한다
function upsertWelfareItems(items) {
    items.forEach(raw => {
        const item = prepareWelfareItem(raw);
        if (loadedItemIds.has(raw.k)) {
            const index = welfareData.findIndex(existing => existing.id === raw.k);
            if (index >= 0) welfareData[index] = item;
        } else {
            loadedItemIds.add(raw.k);
            welfareData.push(item);
        }
    });
}

// ── 화면 문구 ──
const REGION_ORDER = ['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'daejeon', 'ulsan', 'sejong',
    'gangwon', 'chungbuk', 'chungnam', 'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju'];

const CATEGORIES = [
    ['주거', '🏠', '주거'], ['일자리', '💼', '일자리'], ['생활지원', '🛒', '생활 지원'], ['서민금융', '🏦', '금융·대출'],
    ['교육', '📚', '교육'], ['보육', '👶', '보육'], ['임신출산', '🤰', '임신·출산'], ['신체건강', '🏃', '건강·의료'],
    ['정신건강', '🧠', '마음 건강'], ['보호돌봄', '🤝', '돌봄'], ['문화여가', '🎨', '문화·여가'], ['안전위기', '🛡️', '안전·위기'],
    ['법률', '⚖️', '법률'], ['입양위탁', '🏡', '입양·위탁']
];
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(([id, , label]) => [id, label]));

const ORIGIN_LABELS = { central: '중앙정부', public: '공공기관', local: '지자체', youth: '청년정책' };

const TAG_LABELS = {
    '10대이하': '10대 이하', '60대이상': '60대 이상', '임신출산': '임신·출산', '노년': '어르신',
    '한부모조손': '한부모·조손', '다문화탈북민': '다문화·북한이탈', '보훈대상자': '보훈대상',
    '대학생': '대학(원)생', '구직자': '구직 중', '자영업자': '자영업', '농어업인': '농어업인', '직장인': '직장인'
};

const KEYWORDS = ['월세', '출산', '장학금', '취업', '의료비', '어르신', '장애인', '다자녀'];

// 검색어 → 함께 찾을 단어
const SYNONYMS = {
    어르신: ['어르신', '노인', '노년', '고령'],
    의료비: ['의료', '진료', '병원', '치료', '수술'],
    취업: ['취업', '일자리', '구직', '채용', '고용'],
    출산: ['출산', '임신', '산모', '산후', '신생아', '출생'],
    장학금: ['장학', '학비', '교육비', '등록금'],
    월세: ['월세', '임차', '주거비'],
    다자녀: ['다자녀', '다둥이']
};

const QUESTIONS = [
    {
        key: 'age', type: 'single',
        title: '나이가 어떻게 되세요?',
        help: '만 나이 기준으로 골라주세요.',
        options: [
            { value: '10대이하', label: '10대 이하', icon: '🧒' }, { value: '20대', label: '20대', icon: '🧑' },
            { value: '30대', label: '30대', icon: '🧑‍💻' }, { value: '40대', label: '40대', icon: '🧑‍💼' },
            { value: '50대', label: '50대', icon: '🧔' }, { value: '60대이상', label: '60대 이상', icon: '👵' }
        ]
    },
    {
        key: 'region', type: 'region',
        title: '어디에 살고 계세요?',
        help: '주민등록 주소지 기준이에요. 우리 동네 혜택까지 찾아드려요.'
    },
    {
        key: 'lifeCycle', type: 'multi',
        title: '나와 가족에 해당하는 걸 모두 골라주세요',
        help: '함께 사는 가족이 받을 수 있는 혜택도 찾아드려요.',
        options: [
            { value: '임신출산', label: '임신·출산', desc: '임신 중이거나 최근에 출산했어요', icon: '🤰' },
            { value: '영유아', label: '영유아', desc: '0~6세 아이가 있어요', icon: '👶' },
            { value: '아동', label: '초등학생', desc: '7~12세 자녀가 있어요', icon: '🧒' },
            { value: '청소년', label: '중·고등학생', desc: '13~18세 자녀가 있거나 본인이에요', icon: '🎒' },
            { value: '청년', label: '청년', desc: '19~39세예요', icon: '🧑' },
            { value: '중장년', label: '중장년', desc: '40~64세예요', icon: '🧑‍💼' },
            { value: '노년', label: '어르신', desc: '65세 이상이거나 함께 살아요', icon: '👵' }
        ]
    },
    {
        key: 'household', type: 'multi', exclusive: '해당없음',
        title: '해당하는 상황이 있나요?',
        help: '해당하는 게 있으면 받을 수 있는 혜택이 늘어나요.',
        options: [
            { value: '저소득', label: '저소득 가구', desc: '기초생활수급·차상위이거나 소득이 적어요', icon: '💰' },
            { value: '장애인', label: '장애인 가구', desc: '본인이나 가족이 등록 장애인이에요', icon: '♿' },
            { value: '한부모조손', label: '한부모·조손 가구', desc: '한부모 또는 조부모가 아이를 키워요', icon: '🏠' },
            { value: '다자녀', label: '다자녀 가구', desc: '자녀가 2명 이상이에요', icon: '👨‍👩‍👧‍👦' },
            { value: '다문화탈북민', label: '다문화·북한이탈 가구', icon: '🌏' },
            { value: '보훈대상자', label: '국가보훈대상자', icon: '🎖️' },
            { value: '해당없음', label: '해당 없음', icon: '🙂' }
        ]
    },
    {
        key: 'job', type: 'multi', exclusive: '해당없음',
        title: '지금 하고 있는 일을 골라주세요',
        help: '본인이나 함께 사는 가족 기준으로 모두 골라주세요.',
        options: [
            { value: '직장인', label: '직장인', desc: '회사·기관에서 일하고 있어요', icon: '💼' },
            { value: '구직자', label: '구직 중', desc: '일자리를 찾고 있거나 쉬고 있어요', icon: '🔎' },
            { value: '대학생', label: '대학(원)생', desc: '본인이나 자녀가 대학·대학원에 다녀요', icon: '🎓' },
            { value: '자영업자', label: '자영업·소상공인', desc: '가게나 사업을 운영하고 있어요', icon: '🏪' },
            { value: '농어업인', label: '농어업인', desc: '농업·어업·축산업·임업을 하고 있어요', icon: '🌾' },
            { value: '해당없음', label: '해당 없음', icon: '🙂' }
        ]
    },
    {
        key: 'interests', type: 'grid-multi',
        title: '어떤 도움이 필요하세요?',
        help: '필요한 분야를 모두 골라주세요. 고른 분야의 혜택만 모아 보여드려요.',
        options: CATEGORIES.map(([value, icon, label]) => ({ value, icon, label }))
    }
];

const AGE_TO_LIFECYCLE = { '10대이하': '청소년', '20대': '청년', '30대': '청년', '40대': '중장년', '50대': '중장년', '60대이상': '노년' };
const OPTION_LABELS = Object.fromEntries(QUESTIONS.flatMap(q => (q.options || []).map(o => [o.value, o.label])));

// 복지 소식 글 (본문은 index.html 의 nsModal{번호})
const NEWS_ARTICLES = [
    {
        "id": "nsModal1",
        "title": "2026년 복지 제도, 이렇게 달라졌어요",
        "desc": "기준 중위소득 역대 최대 인상, 아동수당 9세 미만 확대, 국민연금 개혁, 통합돌봄 전국 시행까지 올해 꼭 알아야 할 변화를 모았어요."
    },
    {
        "id": "nsModal2",
        "title": "청년 자산 만들기: 청년미래적금과 청년내일저축계좌",
        "desc": "청년도약계좌가 끝나고 2026년 6월 청년미래적금이 출시됐어요. 저소득 근로 청년은 청년내일저축계좌도 함께 확인하세요."
    },
    {
        "id": "nsModal3",
        "title": "독립한 청년의 주거 지원: 월세 지원·버팀목 대출",
        "desc": "청년월세 지원이 2026년부터 계속사업이 됐어요. 월 최대 20만 원 월세 지원과 저금리 전세대출 조건을 정리했어요."
    },
    {
        "id": "nsModal4",
        "title": "신혼·출산 가구의 내 집 마련: 신생아 특례대출과 신혼 전세대출",
        "desc": "2년 안에 아이를 낳은 가구는 신생아 특례대출, 신혼부부는 우대금리 버팀목 대출을 이용할 수 있어요."
    },
    {
        "id": "nsModal5",
        "title": "중장년 재취업: 중장년내일센터부터 경력지원제까지",
        "desc": "40대 이후 이직·퇴직을 준비한다면 무료 경력설계, 실무 경험, 훈련비 지원을 받을 수 있어요."
    },
    {
        "id": "nsModal6",
        "title": "어르신 노후 지원: 기초연금·노인일자리·통합돌봄",
        "desc": "2026년 기초연금은 단독가구 월 최대 34만 9,700원이에요. 역대 최대 노인일자리와 통합돌봄도 함께 정리했어요."
    },
    {
        "id": "nsModal7",
        "title": "자영업자 자금 지원: 재도전특별자금·햇살론",
        "desc": "매출이 줄거나 다시 창업하는 소상공인을 위한 정책자금과 보증 상품을 한눈에 정리했어요."
    },
    {
        "id": "nsModal8",
        "title": "아이가 둘 이상이라면: 다자녀 가구 혜택",
        "desc": "교통비 환급, 전세대출 우대, 휴양림 감면, 국민연금 출산크레딧까지 다자녀 가구가 챙길 혜택이에요."
    },
    {
        "id": "nsModal9",
        "title": "전세보증금 지키기: 반환보증 보증료 최대 40만 원 환급",
        "desc": "전세보증금반환보증에 가입했다면 낸 보증료를 최대 40만 원까지 돌려받을 수 있어요."
    },
    {
        "id": "nsModal10",
        "title": "에너지바우처와 통신요금 감면",
        "desc": "2026년 에너지바우처는 1인 가구 29만 5,200원부터예요. 통신요금 감면과 함께 고정비를 줄여보세요."
    },
    {
        "id": "nsModal11",
        "title": "국민연금 보험료 지원과 크레딧 제도",
        "desc": "소득이 적은 지역가입자의 보험료 지원, 2026년 확대된 출산크레딧 등 연금을 늘리는 방법이에요."
    },
    {
        "id": "nsModal12",
        "title": "한부모가족 아동양육비 지원",
        "desc": "기준 중위소득 65% 이하 한부모가족은 자녀 1명당 월 23만 원의 아동양육비를 받을 수 있어요."
    },
    {
        "id": "nsModal13",
        "title": "잠자는 내 돈 찾기: 숨은 금융자산 조회",
        "desc": "잊고 지낸 예금·보험금·카드포인트가 18조 원이 넘어요. 3분 만에 조회하는 방법이에요."
    },
    {
        "id": "nsModal14",
        "title": "K-패스와 모두의 카드로 교통비 돌려받기",
        "desc": "대중교통비의 20~53%를 돌려주는 K-패스에 2026년 정액형 '모두의 카드'가 더해졌어요."
    },
    {
        "id": "nsModal15",
        "title": "큰 병원비 부담 줄이기: 재난적 의료비와 본인부담상한제",
        "desc": "입원 의료비가 소득에 비해 과도하면 연간 최대 5천만 원까지 지원받을 수 있어요."
    },
    {
        "id": "nsModal16",
        "title": "농업인 공익직불금과 친환경·은퇴직불",
        "desc": "소규모 농가는 면적과 관계없이 130만 원을 받을 수 있어요. 친환경·은퇴직불 단가도 정리했어요."
    },
    {
        "id": "nsModal17",
        "title": "장병내일준비적금: 전역할 때 목돈 만들기",
        "desc": "복무 중 월 최대 55만 원을 저축하면 전역할 때 정부가 원금의 100%를 매칭해 줘요."
    },
    {
        "id": "nsModal18",
        "title": "장애인 지원: 장애인연금·활동지원·장애아동수당",
        "desc": "중증장애인 기초급여 월 34만 9,700원, 소득 기준 없는 활동지원 등 장애인 가구가 챙길 지원이에요."
    },
    {
        "id": "nsModal19",
        "title": "청년주택드림 청약통장: 우대금리와 비과세",
        "desc": "무주택 청년이 연소득 5천만 원 이하라면 일반 청약통장보다 유리한 청년주택드림 청약통장을 만들 수 있어요."
    },
    {
        "id": "nsModal20",
        "title": "출산·육아 현금 지원: 첫만남이용권·부모급여·아동수당",
        "desc": "첫째 200만 원 첫만남이용권, 0세 월 100만 원 부모급여, 만 9세 미만 아동수당까지 아이가 태어나면 받는 돈이에요."
    },
    {
        "id": "nsModal21",
        "title": "국민내일배움카드로 무료·저렴하게 배우기",
        "desc": "5년간 300~500만 원 한도에서 직업훈련비를 지원받는 국민내일배움카드 사용법이에요."
    },
    {
        "id": "nsModal22",
        "title": "2026년 기초생활보장: 생계·주거·교육급여 기준",
        "desc": "2026년 생계급여는 1인 가구 82만 556원까지 지원해요. 급여별 선정 기준을 정리했어요."
    },
    {
        "id": "nsModal23",
        "title": "예술인 지원: 예술활동준비금과 출산전후급여",
        "desc": "저소득 예술인에게 300만 원을 주는 예술활동준비금과 예술인 고용보험 출산전후급여를 정리했어요."
    },
    {
        "id": "nsModal24",
        "title": "아플 때 집으로 오는 돌봄: 일상돌봄·가사간병 방문지원",
        "desc": "돌봐줄 가족이 없는 청·중장년, 중증질환자에게 재가돌봄과 가사지원 바우처를 지원해요."
    },
    {
        "id": "nsModal25",
        "title": "임신부터 산후까지: 산모·신생아 건강관리와 의료비 지원",
        "desc": "산후 도우미 바우처, 임산부 외래진료비 경감, 고위험 임산부 의료비 90% 지원을 정리했어요."
    },
    {
        "id": "nsModal26",
        "title": "자립준비청년 지원: 매월 50만 원 자립수당",
        "desc": "보호가 끝난 자립준비청년은 보호종료 후 5년 동안 매월 50만 원의 자립수당을 받을 수 있어요."
    },
    {
        "id": "nsModal27",
        "title": "국민연금 조기 수령, 손해일까 이득일까?",
        "desc": "일찍 받으면 1년에 6%씩, 최대 30%가 줄어요. 조기·연기 수령을 결정하기 전에 따져볼 점이에요."
    },
    {
        "id": "nsModal28",
        "title": "전세사기 피해자 지원: 특별법 2027년 5월까지 연장",
        "desc": "전세사기 피해자로 결정되면 경공매 지원, 피해주택 매입 후 공공임대, 금융 지원을 받을 수 있어요."
    },
    {
        "id": "nsModal29",
        "title": "농산어촌 유학: 6개월~1년 시골 학교 다니기",
        "desc": "서울 초·중학생이 전남·전북·강원·제주·인천의 시골 학교에 다니면 월 30~60만 원의 경비를 지원받아요."
    },
    {
        "id": "nsModal30",
        "title": "받을 수 있는 복지를 알려주는 '맞춤형 급여 안내'",
        "desc": "한 번 신청해 두면 소득·재산·가구 변화에 맞춰 받을 수 있는 복지를 정기적으로 알려줘요."
    },
    {
        "id": "nsModal31",
        "title": "육아기 근로시간 단축: 초6 자녀까지, 최대 3년",
        "desc": "만 12세 이하 자녀가 있으면 주 15~35시간으로 근무를 줄이고 급여 일부를 지원받을 수 있어요."
    },
    {
        "id": "nsModal32",
        "title": "귀농·청년농 정착 지원: 월 최대 110만 원",
        "desc": "만 40세 미만 청년농은 월 최대 110만 원 정착지원금, 귀농인은 연 2% 창업·주택 융자를 받을 수 있어요."
    },
    {
        "id": "nsModal33",
        "title": "어르신 틀니·임플란트, 건강보험으로 줄이기",
        "desc": "만 65세 이상은 틀니(7년에 1회)와 임플란트(평생 2개)에 건강보험이 적용돼요."
    },
    {
        "id": "nsModal34",
        "title": "국민취업지원제도: 구직촉진수당 월 60~100만 원",
        "desc": "취업을 준비하는 저소득 구직자는 맞춤형 취업지원과 함께 6개월간 구직촉진수당을 받을 수 있어요."
    },
    {
        "id": "nsModal35",
        "title": "고립·은둔 청년과 청소년을 위한 지원",
        "desc": "청년미래센터와 고립·은둔 청소년 원스톱 지원으로 찾아가는 상담부터 일상 회복까지 도와줘요."
    },
    {
        "id": "nsModal36",
        "title": "치매안심센터와 치매치료관리비 지원",
        "desc": "60세 이상은 치매 선별검사가 무료이고, 진단 후에는 약값 등 월 3만 원까지 지원받을 수 있어요."
    },
    {
        "id": "nsModal37",
        "title": "폐업을 고민하는 사장님께: 희망리턴패키지",
        "desc": "점포철거비 최대 600만 원, 사업정리 컨설팅, 재취업 시 전직장려수당까지 폐업 전후를 지원해요."
    },
    {
        "id": "nsModal38",
        "title": "2026년 교육급여와 다문화 자녀 교육활동비",
        "desc": "교육급여 교육활동지원비는 초등 50만 2천 원, 중등 69만 9천 원, 고등 86만 원이에요."
    },
    {
        "id": "nsModal39",
        "title": "근로장려금·자녀장려금: 최대 330만 원",
        "desc": "일하는 저소득 가구는 근로장려금, 자녀가 있으면 자녀장려금을 받을 수 있어요. 소득·재산 기준을 정리했어요."
    },
    {
        "id": "nsModal40",
        "title": "청년 취업 준비 비용 줄이기: 면접정장·응시료 지원",
        "desc": "면접정장 무료 대여, 자격증 응시료 지원처럼 지자체가 운영하는 청년 취업 준비 지원을 찾는 법이에요."
    },
    {
        "id": "nsModal41",
        "title": "임산부 친환경농산물 꾸러미, 2026년 7월 재개",
        "desc": "임신부와 출산한 산모는 자부담 4만 8천 원으로 24만 원어치 친환경 농산물을 받을 수 있어요."
    },
    {
        "id": "nsModal42",
        "title": "다문화가족 지원: 가족센터·이중언어·통번역",
        "desc": "전국 가족센터에서 한국어·부모교육, 통번역, 자녀 이중언어 교육을 무료로 받을 수 있어요."
    },
    {
        "id": "nsModal43",
        "title": "여성새로일하기센터로 경력 다시 잇기",
        "desc": "경력이 끊긴 여성에게 1:1 취업상담, 직업교육훈련, 인턴십, 취업 연계를 무료로 지원해요."
    },
    {
        "id": "nsModal44",
        "title": "국가유공자 보상금과 참전명예수당",
        "desc": "2026년 국가유공자 보상금은 5% 올랐어요. 참전명예수당과 지자체 보훈수당도 함께 확인하세요."
    },
    {
        "id": "nsModal45",
        "title": "급할 때 쓰는 정책서민금융: 햇살론·불법사금융예방대출",
        "desc": "불법 사채 대신 이용할 수 있는 정책서민금융 상품의 한도와 금리를 비교했어요."
    },
    {
        "id": "nsModal46",
        "title": "인구감소지역에 살면 더 받는 혜택",
        "desc": "2026년 아동수당은 비수도권과 인구감소지역에 더 많이 지급돼요. 지역 정착 지원을 찾는 법도 정리했어요."
    },
    {
        "id": "nsModal47",
        "title": "가족을 돌보는 청년에게 자기돌봄비 연 200만 원",
        "desc": "아픈 가족을 전담해 돌보는 13~34세 청년에게 건강관리·자기계발에 쓸 수 있는 자기돌봄비를 지원해요."
    },
    {
        "id": "nsModal48",
        "title": "난임부부 시술비 지원: 소득 관계없이 신청",
        "desc": "체외수정 신선배아 1회 최대 110만 원 등 난임 시술 본인부담금을 지원해요. 난임치료휴가도 함께 확인하세요."
    },
    {
        "id": "nsModal49",
        "title": "문화누리카드·산림복지바우처로 여가 즐기기",
        "desc": "2026년 문화누리카드는 1인 연 15만 원이에요. 휴양림 감면과 산림복지바우처도 함께 정리했어요."
    },
    {
        "id": "nsModal50",
        "title": "갑자기 어려워졌을 때: 긴급복지지원",
        "desc": "실직·질병·화재 등으로 갑자기 생계가 어려워지면 생계비·의료비·주거비를 먼저 지원받을 수 있어요."
    }
];

const PAGE_SIZE = 20;
const SAVED_KEY = 'bokjumoney.saved.v1';

const ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>'
};

// ── 상태 ──
const state = {
    answers: { age: '', region: '', subRegion: '', lifeCycle: [], household: [], job: [], interests: [] },
    step: 0,
    result: { entries: [], scope: 'mine', category: '', query: '', limit: PAGE_SIZE },
    search: { query: '', category: '', limit: PAGE_SIZE }
};

// ── 공용 ──
const $ = id => document.getElementById(id);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const formatNumber = n => n.toLocaleString('ko-KR');

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function safeUrl(url) {
    return /^https?:\/\//i.test(url || '') ? url : '';
}

function debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function animateCount(el, target) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || target < 10) { el.textContent = formatNumber(target); return; }
    const start = performance.now();
    const step = now => {
        const t = Math.min(1, (now - start) / 700);
        el.textContent = formatNumber(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// ── 화면 전환 · 뒤로가기 ──
function showScreen(name, { history: mode = 'push', url } = {}) {
    const changed = document.body.dataset.screen !== name;
    document.querySelectorAll('.screen').forEach(el => el.classList.toggle('is-active', el.id === `screen-${name}`));
    document.body.dataset.screen = name;
    if (changed) window.scrollTo(0, 0);

    const entry = { screen: name, step: state.step };
    const target = url || `${location.pathname}#${name}`;
    if (mode === 'push') history.pushState(entry, '', target);
    else if (mode === 'replace') history.replaceState(entry, '', target);
}

window.addEventListener('popstate', event => {
    const entry = event.state || { screen: 'home' };
    hideOverlays();

    if (entry.overlay) { // 앞으로 가기로 열린 창 상태에 돌아온 경우
        history.back();
        return;
    }
    if (entry.screen === 'loading' || (entry.screen === 'result' && !state.result.entries.length)) {
        showScreen('home', { history: 'replace' });
        return;
    }
    if (entry.screen === 'survey') {
        state.step = entry.step || 0;
        renderQuestion();
    }
    if (entry.screen === 'search') renderSearch();
    if (entry.screen === 'saved') renderSaved();
    showScreen(entry.screen, { history: 'none' });
});

function goHome() {
    showScreen('home', { url: `${location.pathname}#home` });
}

// ── 홈 ──
function initHome() {
    $('dataDate').textContent = WELFARE_DATA_VERSION.replace(/-/g, '.');
    $('heroCount').textContent = formatNumber(Math.floor(WELFARE_TOTAL_COUNT / 100) * 100);

    $('keywordRow').innerHTML = KEYWORDS
        .map(k => `<button class="keyword" data-keyword="${k}">${k}</button>`).join('');
    $('keywordRow').addEventListener('click', e => {
        const btn = e.target.closest('[data-keyword]');
        if (btn) openSearch({ query: btn.dataset.keyword });
    });

    $('categoryGrid').innerHTML = CATEGORIES.map(([id, icon, label]) =>
        `<button class="category-tile" data-category="${id}"><span class="emoji" aria-hidden="true">${icon}</span>${label}</button>`
    ).join('');
    $('categoryGrid').addEventListener('click', e => {
        const btn = e.target.closest('[data-category]');
        if (btn) openSearch({ category: btn.dataset.category });
    });

    const articles = [...NEWS_ARTICLES].sort((a, b) => articleNo(a) - articleNo(b));
    $('articleList').innerHTML = articles.slice(0, 4).map(articleHtml).join('');
    $('articleListAll').innerHTML = articles.map(articleHtml).join('');
    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-article]');
        if (!btn) return;
        if (btn.closest('.sheet-backdrop')) {
            hideOverlays();
            history.replaceState({ screen: document.body.dataset.screen, overlay: btn.dataset.article }, '');
            showOverlay(btn.dataset.article);
        } else {
            openModal(btn.dataset.article);
        }
    });
}

function articleNo(article) {
    return Number(article.id.replace('nsModal', ''));
}

function articleHtml(article) {
    return `<button class="article-item" data-article="${article.id}">
        <span class="vol">Vol.${articleNo(article)}</span>
        <span class="text"><span class="title">${escapeHtml(article.title)}</span>
        <span class="desc">${escapeHtml(article.desc.replace(/\s+/g, ' '))}</span></span>
    </button>`;
}

// ── 설문 ──
function startSurvey() {
    state.step = 0;
    showScreen('survey');
    renderQuestion();
}

function editConditions() {
    startSurvey();
}

function isAnswered(question) {
    const a = state.answers;
    if (question.optional) return true;
    if (question.type === 'single') return !!a[question.key];
    if (question.type === 'region') return !!a.region && (!!a.subRegion || !(SUB_REGIONS[a.region] || []).length);
    return a[question.key].length > 0;
}

function renderQuestion() {
    const question = QUESTIONS[state.step];
    if (question.key === 'lifeCycle' && !state.answers.lifeCycle.length && AGE_TO_LIFECYCLE[state.answers.age]) {
        state.answers.lifeCycle = [AGE_TO_LIFECYCLE[state.answers.age]]; // 나이로 미리 선택해 둔다
    }
    $('progressFill').style.width = `${((state.step + 1) / QUESTIONS.length) * 100}%`;
    $('progressText').textContent = `${state.step + 1}/${QUESTIONS.length}`;
    $('questionTitle').textContent = question.title;
    $('questionHelp').textContent = question.help;
    renderQuestionBody();
    window.scrollTo(0, 0);
}

function renderQuestionBody() {
    const question = QUESTIONS[state.step];
    const a = state.answers;
    let html = '';

    if (question.type === 'single') {
        html = `<div class="option-grid">${question.options.map(o =>
            `<button class="option-tile" data-value="${o.value}" aria-pressed="${a[question.key] === o.value}">
                <span class="emoji" aria-hidden="true">${o.icon}</span>${o.label}</button>`).join('')}</div>`;
    } else if (question.type === 'grid-multi') {
        html = `<div class="option-grid">${question.options.map(o =>
            `<button class="option-tile is-compact" data-value="${o.value}" aria-pressed="${a[question.key].includes(o.value)}">
                <span class="emoji" aria-hidden="true">${o.icon}</span>${o.label}</button>`).join('')}</div>`;
    } else if (question.type === 'multi') {
        html = `<div class="option-list" role="group" aria-label="${question.title}">${question.options.map(o =>
            `<button class="option-row" role="checkbox" data-value="${o.value}" aria-checked="${a[question.key].includes(o.value)}">
                <span class="emoji" aria-hidden="true">${o.icon}</span>
                <span class="text"><span class="label">${o.label}</span>${o.desc ? `<span class="desc">${o.desc}</span>` : ''}</span>
                <span class="check">${ICONS.check}</span>
            </button>`).join('')}</div>`;
    } else {
        html = `<p class="region-label">시·도</p><div class="chip-grid">${REGION_ORDER.map(r =>
            `<button class="choice-chip" data-region="${r}" aria-pressed="${a.region === r}">${REGION_NAMES[r]}</button>`).join('')}</div>`;
        const subs = SUB_REGIONS[a.region] || [];
        if (a.region && subs.length) {
            html += `<p class="region-label" id="subRegionLabel">${REGION_NAMES[a.region]}의 시·군·구</p>
                <div class="chip-grid cols-3">${subs.map(s =>
                `<button class="choice-chip" data-sub="${escapeHtml(s)}" aria-pressed="${a.subRegion === s}">${escapeHtml(s)}</button>`).join('')}</div>`;
        }
    }

    $('questionBody').innerHTML = html;
    const last = state.step === QUESTIONS.length - 1;
    const skipping = question.optional && !a[question.key].length;
    $('surveyNext').textContent = skipping ? '건너뛰고 결과 보기' : last ? '결과 보기' : '다음';
    $('surveyNext').disabled = !isAnswered(question);
}

function handleQuestionClick(event) {
    const btn = event.target.closest('button');
    if (!btn) return;
    const question = QUESTIONS[state.step];
    const a = state.answers;

    if (question.type === 'single') {
        a[question.key] = btn.dataset.value;
        renderQuestionBody();
        const stepAtClick = state.step;
        setTimeout(() => { if (state.step === stepAtClick) nextQuestion(); }, 220);
        return;
    }

    if (question.type === 'multi' || question.type === 'grid-multi') {
        const value = btn.dataset.value;
        let values = a[question.key];
        if (value === question.exclusive) {
            values = values.includes(value) ? [] : [value];
        } else {
            values = values.filter(v => v !== question.exclusive);
            values = values.includes(value) ? values.filter(v => v !== value) : [...values, value];
        }
        a[question.key] = values;
        renderQuestionBody();
        return;
    }

    if (btn.dataset.region) {
        const changed = a.region !== btn.dataset.region;
        a.region = btn.dataset.region;
        if (changed) a.subRegion = '';
        const subs = SUB_REGIONS[a.region] || [];
        if (subs.length === 1) a.subRegion = subs[0];
        loadRegionData(a.region); // 결과 화면 전에 미리 받아둔다
        if (a.subRegion) loadLiveYouthPolicies(a.region, a.subRegion);
        renderQuestionBody();
        if (changed && subs.length > 1) $('subRegionLabel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (btn.dataset.sub) {
        a.subRegion = btn.dataset.sub;
        loadLiveYouthPolicies(a.region, a.subRegion); // 남은 질문에 답하는 동안 최신 청년정책을 받아둔다
        renderQuestionBody();
    }
}

function nextQuestion() {
    if (!isAnswered(QUESTIONS[state.step])) return;
    if (state.step < QUESTIONS.length - 1) {
        state.step++;
        showScreen('survey');
        renderQuestion();
    } else {
        runMatching();
    }
}

// ── 매칭 ──
function userProfile() {
    const a = state.answers;
    return {
        age: a.age, region: a.region, subRegion: a.subRegion,
        lc: a.lifeCycle, hh: [...a.household, ...a.job].filter(h => h !== '해당없음')
    };
}

async function runMatching({ animate = true } = {}) {
    showScreen('loading');
    const steps = [...document.querySelectorAll('#loadingSteps li')];
    steps.forEach(li => li.classList.remove('is-done'));
    const ticks = animate ? steps.map((li, i) => wait(380 * (i + 1)).then(() => li.classList.add('is-done'))) : [];
    // 실시간 청년정책은 설문 중에 미리 받기 시작하므로 결과 직전에는 잠깐만 더 기다린다 (공유 링크로 바로 열면 조금 더)
    const live = loadLiveYouthPolicies(state.answers.region, state.answers.subRegion);
    await Promise.all([
        loadRegionData(state.answers.region),
        Promise.race([live, wait(animate ? LIVE_YOUTH_WAIT : 5000)]),
        ...ticks
    ]);
    if (document.body.dataset.screen !== 'loading') return; // 찾는 중에 뒤로 간 경우

    computeResult();
    showScreen('result', { history: 'replace', url: resultUrl() });
    renderResult();
}

// 추천순: 대상이 좁은 조건이 맞을수록 위로 (가구상황·하는 일 > 생애주기), 우리 시군구 > 대상 연령이 좁은 혜택 > 우리 시도
const SPECIFIC_GROUP_SIZE = 3; // 대상이 이 개수 이하인 조건이 맞아야 '맞춤'으로 본다
// 조건 종류별 가중치: 대부분이 해당되는 '직장인'은 낮게, 자격 조건이 뚜렷한 가구상황은 높게
const TARGET_WEIGHTS = { 직장인: 600, 구직자: 900, 대학생: 900, 자영업자: 900, 농어업인: 1100 };
const LIFECYCLE_WEIGHT = 1000;
const HOUSEHOLD_WEIGHT = 1500;

function scoreEntry(item, data) {
    const matched = [];
    let score = item.relevance;
    let specific = false;

    item.targetGroups.forEach(group => {
        const hit = group.filter(t => data.hh.includes(t));
        const lifeHit = group.filter(t => data.lc.includes(t));
        if (!hit.length && !lifeHit.length) return;
        const weight = Math.max(...hit.map(t => TARGET_WEIGHTS[t] || HOUSEHOLD_WEIGHT), lifeHit.length ? LIFECYCLE_WEIGHT : 0);
        score += weight / group.length; // 대상이 좁은 조건일수록 높게
        if (group.length <= SPECIFIC_GROUP_SIZE) {
            specific = true;
            matched.push(...hit, ...lifeHit);
        }
    });

    const range = item.ageRange;
    if (range && range[1] - range[0] <= 25) {
        score += 600;
        specific = true;
        const mine = [[data.age, AGE_RANGES[data.age]], ...data.lc.map(lc => [lc, LIFECYCLE_AGES[lc]])];
        mine.forEach(([label, r]) => { if (r && r[0] <= range[1] && range[0] <= r[1]) matched.push(label); });
    }
    if (item.subRegion) score += item.subRegion === data.subRegion ? 700 : 0;
    else if (item.isLocal) score += 400;

    // 내 상황에 꼭 맞는 근거가 있거나 우리 지역 혜택이면 '맞춤', 아니면 대부분 해당되는 '누구나' 혜택
    return { item, matched: [...new Set(matched)], score, focused: specific || item.isLocal };
}

// 같은 혜택이 여러 출처(정부24·온통청년)나 해마다 다시 등록된 정책으로 따로 들어 있으면
// 이름이 같은 것은 하나만 보여 준다. 목록은 점수 순으로 정렬된 상태라 먼저 나온 것을 남긴다.
// 지역 혜택과 전국 혜택은 이름이 같아도 다른 사업일 수 있어 따로 둔다.
function dedupeByName(list, getItem = e => e) {
    const seen = new Set();
    return list.filter(e => {
        const item = getItem(e);
        const key = (item.isLocal ? 'L:' : 'N:') + item.name.replace(/[\s·ㆍ・.,_\-()[\]]/g, '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// 점수가 같으면 신청 기간이 적힌 것, 더 최근에 등록된 것(온통청년 id에는 등록일이 들어 있음)을 앞에
function fresherFirst(a, b) {
    if (!!a.deadline !== !!b.deadline) return a.deadline ? -1 : 1;
    return a.id > b.id ? -1 : a.id < b.id ? 1 : 0;
}

function computeResult() {
    const data = userProfile();
    const interests = state.answers.interests;
    const entries = dedupeByName(welfareData
        .filter(item => item.condition(data) && (!interests.length || interests.includes(item.category)))
        .map(item => scoreEntry(item, data))
        .sort((x, y) => (y.score - x.score) || fresherFirst(x.item, y.item)), e => e.item);
    state.result = { entries, scope: 'mine', category: '', query: '', limit: PAGE_SIZE };
    $('resultSearchInput').value = '';
}

function resultUrl() {
    const a = state.answers;
    const params = new URLSearchParams({
        age: a.age, region: a.region, sub: a.subRegion,
        lc: a.lifeCycle.join(','), hh: a.household.join(','), job: a.job.join(','), cat: a.interests.join(',')
    });
    return `${location.pathname}?${params}#result`;
}

function restoreFromUrl() {
    const params = new URLSearchParams(location.search);
    const age = params.get('age');
    const region = params.get('region');
    if (!AGE_RANGES[age] || !REGION_NAMES[region]) return false;
    const sub = params.get('sub') || '';
    const valuesOf = key => QUESTIONS.find(q => q.key === key).options.map(o => o.value);
    const listParam = (name, key) => (params.get(name) || '').split(',').filter(v => valuesOf(key).includes(v));
    state.answers = {
        age, region,
        subRegion: (SUB_REGIONS[region] || []).includes(sub) ? sub : '',
        lifeCycle: (params.get('lc') || '').split(',').filter(v => LIFECYCLE_AGES[v]),
        household: listParam('hh', 'household'),
        job: listParam('job', 'job'),
        interests: listParam('cat', 'interests')
    };
    return true;
}

// ── 결과 ──
function conditionLabels() {
    const a = state.answers;
    return [
        `${REGION_NAMES[a.region] || ''} ${a.subRegion}`.trim(),
        OPTION_LABELS[a.age],
        ...a.lifeCycle.map(v => OPTION_LABELS[v]),
        ...[...a.household, ...a.job].filter(v => v !== '해당없음').map(v => OPTION_LABELS[v]),
        a.interests.length ? `관심: ${a.interests.map(v => CATEGORY_LABELS[v]).join('·')}` : ''
    ].filter(Boolean);
}

function renderResult() {
    $('summaryCond').innerHTML = conditionLabels().map(c => `<span>${escapeHtml(c)}</span>`).join('');
    $('summaryScope').hidden = !state.answers.interests.length;
    const focused = state.result.entries.filter(e => e.focused).length;
    animateCount($('summaryCount'), focused);
    $('summaryAnyone').textContent = formatNumber(state.result.entries.length - focused);
    renderResultList();
}

function showAllCategories() {
    state.answers.interests = [];
    computeResult();
    history.replaceState(history.state, '', resultUrl());
    renderResult();
}

function inScope(entry, scope) {
    if (scope === 'anyone') return !entry.focused;
    return entry.focused && (scope === 'mine' || entry.item.isLocal);
}

function currentResultEntries() {
    const r = state.result;
    return r.entries.filter(e => matchesQuery(e.item, r.query) && inScope(e, r.scope) && (!r.category || e.item.category === r.category));
}

function renderResultList() {
    const r = state.result;
    const byQuery = r.entries.filter(e => matchesQuery(e.item, r.query));
    const scopes = [['mine', '맞춤 혜택'], ['local', '우리 지역'], ['anyone', '누구나 신청']];
    $('scopeTabs').innerHTML = scopes.map(([key, label]) =>
        `<button role="tab" data-scope="${key}" aria-selected="${r.scope === key}">${label}<span class="n">${formatNumber(byQuery.filter(e => inScope(e, key)).length)}</span></button>`
    ).join('');

    const scoped = byQuery.filter(e => inScope(e, r.scope));
    $('categoryChips').innerHTML = categoryChipsHtml(scoped.map(e => e.item), r.category);

    const list = scoped.filter(e => !r.category || e.item.category === r.category);
    renderCards($('resultList'), list.slice(0, r.limit).map(e => cardHtml(e.item, e.matched)),
        emptyHtml('조건에 맞는 혜택이 없어요', '분야나 검색어를 바꿔 보세요.', '필터 초기화', 'resetResultFilters()'));

    const rest = list.length - r.limit;
    $('resultMoreWrap').hidden = rest <= 0;
    $('resultMore').textContent = `더 보기 (${formatNumber(rest)}개 남음)`;
}

function categoryChipsHtml(items, selected) {
    const counts = {};
    items.forEach(item => { counts[item.category] = (counts[item.category] || 0) + 1; });
    const chips = [`<button class="filter-chip" data-chip="" aria-pressed="${!selected}">전체<span class="n">${formatNumber(items.length)}</span></button>`];
    CATEGORIES.forEach(([id, icon, label]) => {
        if (counts[id] || selected === id) {
            chips.push(`<button class="filter-chip" data-chip="${id}" aria-pressed="${selected === id}">${icon} ${label}<span class="n">${formatNumber(counts[id] || 0)}</span></button>`);
        }
    });
    return chips.join('');
}

function keepListInView() {
    // 필터를 바꿨을 때 목록 맨 위가 고정된 필터 바로 아래에 오도록 맞춘다
    const filters = document.querySelector('#screen-result .filters');
    const top = $('resultSearchWrap').getBoundingClientRect().top + window.scrollY - filters.offsetHeight - 56;
    if (window.scrollY > top) window.scrollTo(0, top);
}

function resetResultFilters() {
    Object.assign(state.result, { scope: 'mine', category: '', query: '', limit: PAGE_SIZE });
    $('resultSearchInput').value = '';
    renderResultList();
}

function showMoreResults() {
    state.result.limit += PAGE_SIZE;
    renderResultList();
}

function shareText() {
    const count = state.result.entries.filter(e => e.focused).length;
    return `나에게 맞는 정부 혜택 ${formatNumber(count)}개를 찾았어요! 복주머니에서 내 혜택도 찾아보세요.`;
}

async function shareResult() {
    const url = location.href;
    if (navigator.share) {
        try {
            await navigator.share({ title: '복주머니 · 내 맞춤 혜택', text: shareText(), url });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
        }
    }
    try {
        await navigator.clipboard.writeText(url);
        showToast('결과 링크를 복사했어요');
    } catch {
        showToast('주소창의 링크를 복사해 공유해 주세요');
    }
}

function printResult() {
    const list = currentResultEntries();
    const date = WELFARE_DATA_VERSION.replace(/-/g, '.');
    $('printReport').innerHTML = `
        <h1>복주머니 맞춤 혜택 목록</h1>
        <p class="meta">${escapeHtml(conditionLabels().join(' · '))} · ${date} 공공데이터 기준 · ${formatNumber(list.length)}개</p>
        <ol>${list.map(({ item }) => `<li>
            <div class="name">${escapeHtml(item.name)}</div>
            <div class="sub">${escapeHtml(item.tag)} · ${escapeHtml(CATEGORY_LABELS[item.category] || '')}</div>
            ${safeUrl(item.applyUrl) ? `<div class="url">${escapeHtml(item.applyUrl)}</div>` : ''}
        </li>`).join('')}</ol>`;
    window.print();
}

// ── 카드 ──
function cardHtml(item, matched = []) {
    const url = safeUrl(item.applyUrl);
    const saved = isSaved(item.id);
    const blogUrl = `https://10000nanzip.tistory.com/search/${encodeURIComponent(item.name)}`;
    return `<article class="card">
        <div class="card-head">
            <span class="card-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
            <div class="card-meta">
                <span class="badge badge-${item.origin}">${ORIGIN_LABELS[item.origin] || '공공'}</span>
                <span class="card-agency">${escapeHtml(item.tag)}</span>
            </div>
            <button class="save-btn" data-save="${escapeHtml(item.id)}" aria-pressed="${saved}" aria-label="${saved ? '저장 취소' : '저장하기'}">${ICONS.star}</button>
        </div>
        <h3 class="card-title">${escapeHtml(item.name)}</h3>
        ${item.deadline ? `<p class="card-deadline">신청 ${escapeHtml(item.deadline === '상시' ? '상시' : item.deadline)}</p>` : ''}
        ${item.description ? `<p class="card-desc">${escapeHtml(item.description)}</p>` : ''}
        ${matched.length ? `<div class="card-tags">${matched.slice(0, 3).map(t => `<span>#${escapeHtml(TAG_LABELS[t] || t)}</span>`).join('')}</div>` : ''}
        <div class="card-actions">
            ${url ? `<a class="btn btn-soft btn-sm" href="${escapeHtml(url)}" target="_blank" rel="noopener">자세히 보기 ${ICONS.external}</a>` : ''}
            <a class="btn btn-secondary btn-sm" href="${blogUrl}" target="_blank" rel="noopener">신청 꿀팁</a>
        </div>
    </article>`;
}

function emptyHtml(title, desc, buttonLabel, onclick) {
    return `<div class="empty">
        <img src="chatbot_avatar.png" alt="" class="mascot lg">
        <h3>${title}</h3><p>${desc}</p>
        ${buttonLabel ? `<button class="btn btn-primary" onclick="${onclick}">${buttonLabel}</button>` : ''}
    </div>`;
}

function renderCards(container, cards, empty) {
    container.innerHTML = cards.length ? cards.join('') : empty;
}

// ── 검색 · 분야별 ──
function matchesQuery(item, query) {
    const tokens = (query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return true;
    if (!item.searchText) {
        item.searchText = `${item.name} ${item.description} ${item.tag} ${CATEGORY_LABELS[item.category] || ''}`.toLowerCase();
    }
    return tokens.every(t => (SYNONYMS[t] || [t]).some(word => item.searchText.includes(word)));
}

function submitHomeSearch(event) {
    event.preventDefault();
    openSearch({ query: $('homeSearchInput').value.trim() });
}

function openSearch({ query = '', category = '' } = {}) {
    state.search = { query, category, limit: PAGE_SIZE };
    $('searchInput').value = query;
    showScreen('search');
    renderSearch();
    if (!query && !category) $('searchInput').focus();
}

function renderSearch() {
    const s = state.search;
    const region = state.answers.region;
    const pool = welfareData.filter(item =>
        (!item.isLocal || item.regions.includes(region)) && matchesQuery(item, s.query));
    const tokens = s.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const scored = dedupeByName(pool.map(item => ({
        item,
        score: (tokens.some(t => item.name.toLowerCase().includes(t)) ? 1000 : 0) + (item.isLocal ? 200 : 0) + item.relevance
    })).sort((x, y) => (y.score - x.score) || fresherFirst(x.item, y.item)), e => e.item);

    $('searchChips').innerHTML = categoryChipsHtml(scored.map(e => e.item), s.category);
    const list = scored.filter(e => !s.category || e.item.category === s.category);

    const regionNote = region
        ? `${REGION_NAMES[region]} 지역 혜택을 포함해 ${formatNumber(list.length)}개를 찾았어요.`
        : `전국 혜택 ${formatNumber(list.length)}개 · 사는 곳을 알려주시면 우리 동네 혜택도 함께 보여드려요. <button class="text-btn is-brand" onclick="startSurvey()">내 혜택 찾기</button>`;
    $('searchNote').innerHTML = regionNote;

    renderCards($('searchList'), list.slice(0, s.limit).map(e => cardHtml(e.item)),
        emptyHtml('검색 결과가 없어요', '다른 단어로 검색해 보세요. 예: 월세, 출산, 장학금'));
    const rest = list.length - s.limit;
    $('searchMoreWrap').hidden = rest <= 0;
    $('searchMore').textContent = `더 보기 (${formatNumber(rest)}개 남음)`;
}

function showMoreSearch() {
    state.search.limit += PAGE_SIZE;
    renderSearch();
}

// ── 저장한 혜택 (이 기기 브라우저에만 저장) ──
let savedCache = null;

function loadSaved() {
    if (savedCache) return savedCache;
    try {
        savedCache = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
        if (!Array.isArray(savedCache)) savedCache = [];
    } catch {
        savedCache = [];
    }
    return savedCache;
}

function persistSaved() {
    try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(savedCache));
    } catch {
        // 사파리 개인정보 보호 모드 등 저장이 막힌 환경에서는 이번 방문 동안만 유지
    }
}

function isSaved(id) {
    return loadSaved().some(item => item.id === id);
}

function toggleSave(id) {
    const saved = loadSaved();
    const index = saved.findIndex(item => item.id === id);
    if (index >= 0) {
        saved.splice(index, 1);
        showToast('저장을 취소했어요');
    } else {
        const item = welfareData.find(i => i.id === id);
        if (!item) return;
        const { name, tag, description, applyUrl, icon, category, origin } = item;
        saved.unshift({ id, name, tag, description, applyUrl, icon, category, origin });
        showToast('저장했어요 · 홈 상단에서 다시 볼 수 있어요');
    }
    persistSaved();
    document.querySelectorAll(`[data-save="${CSS.escape(id)}"]`).forEach(btn => {
        btn.setAttribute('aria-pressed', String(index < 0));
        btn.setAttribute('aria-label', index < 0 ? '저장 취소' : '저장하기');
    });
    updateSavedUi();
    if (document.body.dataset.screen === 'saved') renderSaved();
}

function updateSavedUi() {
    const count = loadSaved().length;
    document.querySelectorAll('[data-saved-button]').forEach(btn => { btn.hidden = count === 0; });
    document.querySelectorAll('[data-saved-count]').forEach(el => { el.textContent = count; });
}

function showSaved() {
    renderSaved();
    showScreen('saved');
}

function renderSaved() {
    renderCards($('savedList'), loadSaved().map(item => cardHtml(item)),
        emptyHtml('아직 저장한 혜택이 없어요', '혜택 카드의 별을 누르면 여기에 모아둘 수 있어요.', '내 혜택 찾기', 'startSurvey()'));
}

// ── 바텀시트 · 모달 ──
function showOverlay(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideOverlays() {
    document.querySelectorAll('.modal-overlay.show, .sheet-backdrop.show').forEach(el => el.classList.remove('show'));
    document.body.style.overflow = '';
}

function openModal(id) {
    // 휴대폰 뒤로가기로 창이 닫히도록 기록을 하나 남긴다
    history.pushState({ screen: document.body.dataset.screen, overlay: id }, '');
    showOverlay(id);
}

function closeModal() {
    if (history.state && history.state.overlay) history.back();
    else hideOverlays();
}

const openSheet = openModal;
const closeSheet = closeModal;

document.addEventListener('click', event => {
    if (event.target.classList.contains('modal-overlay')) closeModal();
    const saveBtn = event.target.closest('[data-save]');
    if (saveBtn) toggleSave(saveBtn.dataset.save);
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('.modal-overlay.show, .sheet-backdrop.show')) closeModal();
});

// ── 시작 ──
function bindEvents() {
    $('questionBody').addEventListener('click', handleQuestionClick);

    $('scopeTabs').addEventListener('click', e => {
        const btn = e.target.closest('[data-scope]');
        if (!btn) return;
        Object.assign(state.result, { scope: btn.dataset.scope, category: '', limit: PAGE_SIZE });
        renderResultList();
        keepListInView();
    });
    $('categoryChips').addEventListener('click', e => {
        const btn = e.target.closest('[data-chip]');
        if (!btn) return;
        Object.assign(state.result, { category: btn.dataset.chip, limit: PAGE_SIZE });
        renderResultList();
        keepListInView();
    });
    $('resultSearchInput').addEventListener('input', debounce(e => {
        Object.assign(state.result, { query: e.target.value, limit: PAGE_SIZE });
        renderResultList();
    }, 150));

    $('searchChips').addEventListener('click', e => {
        const btn = e.target.closest('[data-chip]');
        if (!btn) return;
        Object.assign(state.search, { category: btn.dataset.chip, limit: PAGE_SIZE });
        renderSearch();
    });
    $('searchInput').addEventListener('input', debounce(e => {
        Object.assign(state.search, { query: e.target.value, limit: PAGE_SIZE });
        renderSearch();
    }, 150));
}

initHome();
bindEvents();
updateSavedUi();

if (restoreFromUrl()) {
    // 공유받은 결과 링크로 들어온 경우 바로 결과를 보여준다
    history.replaceState({ screen: 'home' }, '', `${location.pathname}#home`);
    runMatching({ animate: false });
} else {
    history.replaceState({ screen: 'home' }, '', location.pathname);
}
