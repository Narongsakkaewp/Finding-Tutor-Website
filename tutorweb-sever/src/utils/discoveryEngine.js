//tutorweb-sever/src/utils/discoveryEngine.js
const SUBJECT_SYNONYMS = {
  // === 📚 สายวิชาการหลัก (Academics) ===
  physics: ['ฟิสิกส์', 'physics', 'phy', 'physic', 'กลศาสตร์', 'อะตอม', 'atom', 'ไฟฟ้า', 'กล', 'quantum', 'mechanics', 'electricity', 'motion'],
  chemistry: ['เคมี', 'chemistry', 'chem', 'อินทรีย์', 'organic', 'stoichiometry', 'เคมีอินทรีย์', 'สารประกอบ', 'ธาตุ', 'โมล', 'reaction'],
  biology: ['ชีวะ', 'ชีววิทยา', 'biology', 'bio', 'genetics', 'anatomy', 'พันธุศาสตร์', 'พฤกษศาสตร์'],
  science: ['วิทย์', 'วิทยาศาสตร์', 'science', 'sci', 'stem', 'ดาราศาสตร์', 'astronomy', 'โลกและอวกาศ'],
  math: ['คณิต', 'คณิตศาสตร์', 'math', 'mathematics', 'algebra', 'calculus', 'เลข', 'สถิติ', 'stat', 'geometry', 'trigonometry', 'probability', 'แคล', 'แคลคูลัส', 'discrete'],
  social: ['สังคม', 'สังคมศึกษา', 'social', 'history', 'ประวัติศาสตร์', 'religion', 'ศาสนา', 'civics', 'หน้าที่พลเมือง', 'geography', 'ภูมิศาสตร์'],
  law: ['กฎหมาย', 'law', 'นิติ', 'นิติศาสตร์', 'legal', 'แพ่ง', 'อาญา', 'รัฐธรรมนูญ'],
  // === 🗣️ สายภาษา (Languages) ===
  english: ['อังกฤษ', 'ภาษาอังกฤษ', 'english', 'eng', 'toeic', 'ielts', 'toefl', 'grammar', 'speaking', 'presentation', 'conversation', 'reading', 'writing', 'vocabulary'],
  chinese: ['จีน', 'ภาษาจีน', 'chinese', 'mandarin', 'hsk', 'pinyin', 'จีนกลาง', 'เหล่าซือ'],
  japanese: ['ญี่ปุ่น', 'ภาษาญี่ปุ่น', 'japanese', 'jlpt', 'n1', 'n2', 'n3','n4', 'n5', 'hiragana', 'katakana', 'kanji', 'เซนเซย์'],
  korean: ['เกาหลี', 'ภาษาเกาหลี', 'korean', 'topik', 'hangul', 'ฮันกึล'],
  french: ['ฝรั่งเศส', 'ภาษาฝรั่งเศส', 'french', 'francais', 'français', 'pat'],
  german: ['เยอรมัน', 'ภาษาเยอรมัน', 'german', 'deutsch', 'goethe'],
  thai: ['ไทย', 'ภาษาไทย', 'thai', 'หลักภาษา', 'วรรณคดี', 'tpat', 'tgat'],
  // === 💻 สายเทคโนโลยีและเขียนโปรแกรม (Tech & Programming) ===
  programming: ['เขียนโปรแกรม', 'programming', 'program', 'coding', 'code', 'developer', 'dev', 'software', 'algorithm', 'problem solving', 'c', 'rust', 'go'],
  web: ['เว็บ', 'web', 'website', 'html', 'css', 'javascript', 'js', 'react', 'node', 'frontend', 'backend', 'fullstack', 'php', 'web development', 'tailwind', 'bootstrap', 'vue', 'nextjs', 'typescript'],
  mobile: ['แอปมือถือ', 'mobile app', 'ios', 'android', 'flutter', 'react native', 'swift', 'kotlin', 'dart'],
  java: ['java', 'oop', 'object oriented', 'จาวา'],
  python: ['python', 'py', 'ไพธอน', 'machine learning', 'ml', 'ai', 'deep learning', 'pandas'],
  cpp: ['c++', 'cpp', 'ซีพลัสพลัส'],
  csharp: ['c#', 'csharp', 'ซีชาร์ป', '.net', 'dotnet'],
  database: ['database', 'ฐานข้อมูล', 'sql', 'mysql', 'postgresql', 'db', 'mongodb', 'nosql'],
  datastructure: ['data structure', 'data structures', 'โครงสร้างข้อมูล', 'linked list', 'tree', 'graph', 'stack', 'queue'],
  algorithm: ['algorithm', 'algorithms', 'อัลกอริทึม', 'problem solving', 'sorting', 'searching'],
  cloud: ['cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'devops', 'server'],
  network: ['network', 'เครือข่าย', 'cisco', 'ccna', 'it support', 'system admin', 'cybersecurity', 'security', 'ความปลอดภัยไซเบอร์'],
  data_analytics: ['data analytics', 'data analysis', 'excel', 'powerbi', 'tableau', 'วิเคราะห์ข้อมูล', 'data science'],
  // === 🔌 สายวิศวกรรมและอิเล็กทรอนิกส์ (Engineering & Electronics) ===
  electronics: ['microcontroller', 'arduino', 'esp32', 'วงจร', 'อิเล็กทรอนิกส์', 'embedded', 'iot', 'ไฟฟ้า', 'circuit', 'digital logic', 'ect', 'raspberry pi'],
  engineering: ['วิศวะ', 'วิศวกรรม', 'engineering', 'mechanic', 'drawing', 'autocad', 'solidworks'],
  // === 💼 สายธุรกิจและการสื่อสาร (Business & Career) ===
  business: ['ธุรกิจ', 'business', 'บริหาร', 'management', 'entrepreneur', 'startup'],
  accounting: ['บัญชี', 'accounting', 'บัญชีเบื้องต้น', 'เดบิต', 'เครดิต', 'งบการเงิน', 'tax', 'ภาษี'],
  economics: ['เศรษฐศาสตร์', 'economics', 'microeconomics', 'macroeconomics', 'demand', 'supply', 'elasticity'],
  marketing: ['การตลาด', 'marketing', 'digital marketing', 'content', 'branding', 'seo', 'social media', 'ads'],
  sales: ['การขาย', 'sales', 'sale engineer', 'account executive', 'b2b', 'crm', 'telesales', 'negotiation'],
  communication: ['การสื่อสาร', 'communication', 'public speaking', 'soft skills', 'small talk', 'networking', 'presentation', 'บุคลิกภาพ'],
  // === 🎨 สายศิลปะ การออกแบบ และดนตรี (Arts, Design & Music) ===
  design: ['ออกแบบ', 'design', 'ui', 'ux', 'ux/ui', 'figma', 'illustrator', 'photoshop', 'graphic', 'adobe', 'canva'],
  art: ['ศิลปะ', 'art', 'drawing', 'วาดรูป', 'painting', 'สีน้ำ', 'sketch', 'illustration', 'ประติมากรรม'],
  video_editing: ['ตัดต่อ', 'video editing', 'premiere pro', 'after effects', 'vlog', 'youtube', 'tiktok'],
  music: ['ดนตรี', 'music', 'guitar', 'piano', 'vocal', 'ร้องเพลง', 'กีตาร์', 'เปียโน', 'ทฤษฎีดนตรี', 'ไวโอลิน', 'กลอง'],
  // === 🏃‍♂️ สายกีฬาและไลฟ์สไตล์ (Sports & Lifestyle) ===
  sports: ['กีฬา', 'sports', 'ว่ายน้ำ', 'swimming', 'แบดมินตัน', 'badminton', 'เทนนิส', 'tennis', 'ฟุตบอล', 'football', 'โยคะ', 'yoga', 'ฟิตเนส'],
  cooking: ['ทำอาหาร', 'cooking', 'เบเกอรี่', 'bakery', 'ทำขนม', 'culinary', 'บาริสต้า', 'ชงกาแฟ']
};

const STOPWORDS = new Set([
  'และ', 'กับ', 'ของ', 'ที่', 'ให้', 'ได้', 'อยาก', 'หา', 'เรียน', 'สอน', 'วิชา',
  'the', 'for', 'and', 'with', 'from', 'into', 'this', 'that', 'your',
]);

const GRADE_GROUPS = {
  'ม.1': ['มัธยมต้น', 'middle school'],
  'ม.2': ['มัธยมต้น', 'middle school'],
  'ม.3': ['มัธยมต้น', 'middle school'],
  'ม.4': ['มัธยมปลาย', 'high school'],
  'ม.5': ['มัธยมปลาย', 'high school'],
  'ม.6': ['มัธยมปลาย', 'high school'],
  'ป.1': ['ประถม', 'primary'],
  'ป.2': ['ประถม', 'primary'],
  'ป.3': ['ประถม', 'primary'],
  'ป.4': ['ประถม', 'primary'],
  'ป.5': ['ประถม', 'primary'],
  'ป.6': ['ประถม', 'primary'],
  'ปริญญาตรี': ['มหาวิทยาลัย', 'university', 'bachelor'],
  'บุคคลทั่วไป': ['ทั่วไป', 'general', 'none'],
};

//ชุดคำวิชาและคำใกล้เคียงที่ใช้ในการขยายสัญญาณและการทำเหมืองข้อมูลเพื่อปรับปรุงการค้นหาและการแนะนำ
function normalizeAliasKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_\s./#+-]+/g, '');
}

const ALIAS_TO_CANONICAL = Object.entries(SUBJECT_SYNONYMS).reduce((acc, [canonical, aliases]) => {
  acc[canonical] = canonical;
  acc[normalizeAliasKey(canonical)] = canonical;
  aliases.forEach((alias) => {
    const lowered = String(alias).toLowerCase();
    acc[lowered] = canonical;
    acc[normalizeAliasKey(lowered)] = canonical;
  });
  return acc;
}, {});

//ตัดคำที่ไม่จำเป็นออก เช่น สัญลักษณ์พิเศษ ตัวเชื่อม และคำฟุ่มเฟือย เพื่อให้เหลือแต่คำสำคัญที่ใช้ในการค้นหาและการจับคู่
function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s./#+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

//แยกข้อความออกเป็นคำสำคัญ จากประโยคให้เหลือคำเดียว
function tokenize(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const base = normalized
    .split(/[\s,/|+-]+/)
    .map((part) => part.trim())
    .filter((part) => part && !STOPWORDS.has(part));

  const tokens = new Set(base);
  for (let i = 0; i < base.length - 1; i += 1) {
    const phrase = `${base[i]} ${base[i + 1]}`.trim();
    if (phrase.length > 2) tokens.add(phrase);
  }
  for (let i = 0; i < base.length - 2; i += 1) {
    const phrase = `${base[i]} ${base[i + 1]} ${base[i + 2]}`.trim();
    if (phrase.length > 4) tokens.add(phrase);
  }

  return Array.from(tokens);
}

//ขยายคำที่เกี่ยวข้องกับคำค้นหา เช่น ถ้าค้นหาคำว่า "ฟิสิกส์" ก็จะขยายไปถึงคำว่า "physics", "กลศาสตร์", "อะตอม"
function expandTerms(text) {
  const tokens = tokenize(text);
  const expanded = new Set(tokens);

  tokens.forEach((token) => {
    const compactToken = normalizeAliasKey(token);
    const canonical = ALIAS_TO_CANONICAL[token] || ALIAS_TO_CANONICAL[compactToken];
    if (canonical) {
      expanded.add(canonical);
      SUBJECT_SYNONYMS[canonical].forEach((alias) => expanded.add(String(alias).toLowerCase()));
    }

    Object.entries(SUBJECT_SYNONYMS).forEach(([key, aliases]) => {
      const matchesAlias =
        token.includes(key) ||
        compactToken.includes(normalizeAliasKey(key)) ||
        aliases.some((alias) => {
          const loweredAlias = String(alias).toLowerCase();
          const compactAlias = normalizeAliasKey(loweredAlias);
          return token.includes(loweredAlias) || compactToken.includes(compactAlias);
        });

      if (matchesAlias) {
        expanded.add(key);
        aliases.forEach((alias) => expanded.add(String(alias).toLowerCase()));
      }
    });
  });

  return Array.from(expanded);
}

//ขยายคำที่ได้มา ให้เชื่อมกับคำที่ใกล้เคียงหรือคำพ้อง
function addSignal(map, rawText, weight) {
  if (!rawText || !weight) return;
  expandTerms(rawText).forEach((term) => {
    if (!term || STOPWORDS.has(term) || term.length < 2) return;
    map.set(term, (map.get(term) || 0) + weight);
  });
}

//ฟังก์ชั่นเรื่องเวลา เช่น ถ้าข้อมูลถูกสร้างวันนี้หรือเมื่อวาน จะมีน้ำหนักมากกว่าข้อมูลที่ถูกสร้างเมื่อ 20 วันก่อน
function getRecencyMultiplier(dateValue, windows = {}) {
  const ageDays = daysSince(dateValue);
  if (ageDays <= (windows.oneDay ?? 1)) return windows.oneDayWeight ?? 2.8;
  if (ageDays <= (windows.threeDays ?? 3)) return windows.threeDayWeight ?? 2.2;
  if (ageDays <= (windows.sevenDays ?? 7)) return windows.sevenDayWeight ?? 1.7;
  if (ageDays <= (windows.fourteenDays ?? 14)) return windows.fourteenDayWeight ?? 1.25;
  if (ageDays <= (windows.twentyDays ?? 20)) return windows.twentyDayWeight ?? 0.85;
  return windows.defaultWeight ?? 0.45;
}

function serializeReasonTerms(signalMap, limit = 5) {
  return Array.from(signalMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

//ดูข้อความในโพสต์ว่าตรงกับคำสำคัญของผู้ใช้งานมากแค่ไหน
function scoreTextAgainstSignals(text, signalMap, multiplier = 1) {
  const haystack = normalizeText(text);
  if (!haystack) return 0;

  let score = 0;
  for (const [term, weight] of signalMap.entries()) {
    if (haystack === term) score += weight * 7 * multiplier;
    else if (haystack.includes(term)) score += weight * 3 * multiplier;
  }
  return score;
}

//คำนวณว่าโพสต์นั้นเก่าหรือใหม่แค่ไหน
function daysSince(dateValue) {
  const value = new Date(dateValue);
  if (Number.isNaN(value.getTime())) return 365;
  return Math.max(0, (Date.now() - value.getTime()) / (1000 * 60 * 60 * 24));
}

//ให้คะแนนความใหม่ของโพสต์
function recencyScore(dateValue) {
  const ageDays = daysSince(dateValue);
  if (ageDays <= 1) return 35; // โพสต์ที่สร้างในวันนี้หรือเมื่อวานจะได้คะแนนสูงสุด
  if (ageDays <= 3) return 25; // โพสต์ที่สร้างในช่วง 3 วันที่ผ่านมา
  if (ageDays <= 7) return 18; // โพสต์ที่สร้างในช่วง 7 วันที่ผ่านมา
  if (ageDays <= 14) return 10; // โพสต์ที่สร้างในช่วง 14 วันที่ผ่านมา
  if (ageDays <= 30) return 4; // โพสต์ที่สร้างในช่วง 30 วันที่ผ่านมา
  return 0;
}

//ให้คะแนนความนิยมของโพสต์/ติวเตอร์
function popularityScore({ favCount = 0, reviewCount = 0, joinCount = 0, studentCount = 0, rating = 0 }) {
  return (
    Math.min(Number(favCount || 0), 20) * 1.8 +
    Math.min(Number(reviewCount || 0), 20) * 2.2 +
    Math.min(Number(joinCount || 0), 30) * 1.6 +
    Math.min(Number(studentCount || 0), 60) * 1.2 +
    Number(rating || 0) * 6
  );
}

//เช็คว่าโพสต์เลยเวลาเรียนมาแล้วหรือยัง
function calculateIsExpired(post) {
  const teachingDays = String(post.teaching_days || post.preferred_days || '').trim();
  const teachingTimes = String(post.teaching_time || post.preferred_time || '').trim();
  const createdAt = post.created_at || post.createdAt;

  if (teachingDays) {
    const dates = teachingDays.split(',').map((entry) => entry.trim()).filter(Boolean);
    const times = teachingTimes.split(',').map((entry) => entry.trim());
    if (dates.length > 0) {
      const now = new Date();
      let foundConcreteDate = false;
      let foundFuture = false;

      for (let index = 0; index < dates.length; index += 1) {
        const item = dates[index];
        const ymd = item.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        const dmy = item.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!ymd && !dmy) return false;

        foundConcreteDate = true;
        const year = ymd ? Number(ymd[1]) : Number(dmy[3]) > 2400 ? Number(dmy[3]) - 543 : Number(dmy[3]);
        const month = ymd ? Number(ymd[2]) - 1 : Number(dmy[2]) - 1;
        const day = ymd ? Number(ymd[3]) : Number(dmy[1]);
        const timeValue = times[index] || times[0] || '';
        const timeMatch = timeValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        const targetDate = new Date(
          year,
          month,
          day,
          timeMatch ? Number(timeMatch[1]) : 23,
          timeMatch ? Number(timeMatch[2]) : 59,
          timeMatch ? Number(timeMatch[3] || 0) : 59
        );

        if (targetDate >= now) {
          foundFuture = true;
          break;
        }
      }

      if (foundConcreteDate && !foundFuture) return true;
    }
  }

  return daysSince(createdAt) > 45;
}

//เอาชื่อวิชาต่างๆที่ได้มา มาแปลงให้เป็นชื่อกลางที่มีอยู่ใน SUBJECT_SYNONYMS
function getCanonicalSubject(subject) {
  const terms = expandTerms(subject);
  return terms.find((term) => SUBJECT_SYNONYMS[term]) || normalizeText(subject);
}

//เช็คว่าโพสต์นั้นตรงกับความสนใจของผู้ใช้หรือไม่ โดยดูจากคำสำคัญที่ของผู้ใช้
function rowMatchesTopTerms(row, topTerms = []) {
  if (!Array.isArray(topTerms) || topTerms.length === 0) return false;

  const rowTerms = new Set(
    expandTerms(
      [
        row.subject,
        row.description,
        row.target_student_level,
        row.location,
        row.name,
        row.lastname,
      ].filter(Boolean).join(' ')
    )
  );

  return topTerms.some((term) => rowTerms.has(String(term || '').toLowerCase()));
}

//ไม่ให้ขึ้นติวเตอร์ซ้ำหรือวิชาเดิมซ้ำมากเกินไป
function diversifyTutorRows(rows, limit) {
  const selected = [];
  const tutorCounts = new Map();
  const subjectCounts = new Map();

  const sorted = [...rows].sort((a, b) => b.recommendation_score - a.recommendation_score);
  const subjectKeyOf = (row) => getCanonicalSubject(row.subject);

  for (const row of sorted) {
    if (selected.length >= limit) break;
    const tutorKey = row.tutor_id;
    const subjectKey = subjectKeyOf(row);
    const tutorCount = tutorCounts.get(tutorKey) || 0;
    const subjectCount = subjectCounts.get(subjectKey) || 0;

    if (tutorCount >= 2 || subjectCount >= 2) continue; //ติวเตอร์เดิมไม่เกิน 2 โพสต์ วิชาเดิมไม่เกิน 2 โพสต์

    selected.push(row);
    tutorCounts.set(tutorKey, tutorCount + 1);
    subjectCounts.set(subjectKey, subjectCount + 1);
  }

  if (selected.length < limit) {
    for (const row of sorted) {
      if (selected.length >= limit) break;
      if (selected.find((item) => item.tutor_post_id === row.tutor_post_id)) continue;
      selected.push(row);
    }
  }

  return selected;
}

//โดยเอาโพสต์ที่คะแนนรองลงมา หรือโพสต์หมดเวลาแล้วแต่น่าสนใจ มาจัดเป็นชุด explore ให้ผู้ใช้กดดูได้
function buildExploreTutorRows(primaryRows, fallbackRows, limit) {
  const selected = [];
  const seen = new Set();

  const pushRows = (rows) => {
    const diversified = diversifyTutorRows(rows, limit * 2);
    for (const row of diversified) {
      if (selected.length >= limit) break;
      if (seen.has(row.tutor_post_id)) continue;
      seen.add(row.tutor_post_id);
      selected.push(row);
    }
  };

  pushRows(primaryRows);
  if (selected.length < limit) pushRows(fallbackRows);

  return selected.slice(0, limit);
}

function buildColdStartTutorRows(rows, limit) { //ฟังก์ชั่นจัดอันดับโพสต์ติวเตอร์สำหรับผู้ใช้ใหม่ที่ยังไม่มีข้อมูลความสนใจ โดยจะเน้นที่โพสต์ที่ยังไม่หมดอายุและมีความหลากหลายของวิชาและติวเตอร์
  const activeRows = dedupeRows(rows, (row) => row.tutor_post_id).filter((row) => !calculateIsExpired(row));
  const newestRows = [...activeRows]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, Math.max(limit * 2, 12));
  const popularRows = [...activeRows]
    .sort((a, b) => (
      popularityScore({
        favCount: b.fav_count,
        reviewCount: b.review_count,
        joinCount: b.join_count,
        studentCount: b.students_taught_count,
        rating: b.avg_rating,
      }) - popularityScore({
        favCount: a.fav_count,
        reviewCount: a.review_count,
        joinCount: a.join_count,
        studentCount: a.students_taught_count,
        rating: a.avg_rating,
      })
    ))
    .slice(0, Math.max(limit * 2, 12));

  const selected = [];
  const seenPostIds = new Set();
  const tutorCounts = new Map();
  const subjectCounts = new Map();

  const pushRow = (row) => {
    if (!row || selected.length >= limit) return;
    if (seenPostIds.has(row.tutor_post_id)) return;

    const tutorKey = row.tutor_id;
    const subjectKey = getCanonicalSubject(row.subject);
    const tutorCount = tutorCounts.get(tutorKey) || 0;
    const subjectCount = subjectCounts.get(subjectKey) || 0;

    if (tutorCount >= 1 || subjectCount >= 1) return;

    selected.push(row);
    seenPostIds.add(row.tutor_post_id);
    tutorCounts.set(tutorKey, tutorCount + 1);
    subjectCounts.set(subjectKey, subjectCount + 1);
  };

  const rounds = Math.max(newestRows.length, popularRows.length);
  for (let index = 0; index < rounds && selected.length < limit; index += 1) {
    pushRow(newestRows[index]);
    pushRow(popularRows[index]);
  }

  if (selected.length < limit) {
    for (const row of diversifyTutorRows(activeRows, limit * 3)) {
      if (selected.length >= limit) break;
      if (seenPostIds.has(row.tutor_post_id)) continue;
      selected.push(row);
      seenPostIds.add(row.tutor_post_id);
    }
  }

  return selected.slice(0, limit);
}

async function getUserRole(pool, userId) { //รับค่า Role ของผู้ใช้งานเพื่อเอาไปใช้ใน fn getUserSignals
  const [[row]] = await pool.query('SELECT type FROM register WHERE user_id = ? LIMIT 1', [userId]);
  return String(row?.type || '').toLowerCase();
}

//ดึงข้อมูลของนักเรียน เพื่อใช้ในการคำนวณคะแนนความตรงกับโพสต์ติวเตอร์
async function getStudentSignals(pool, userId) {
  const signals = new Map(); // เก็บคำสำคัญและน้ำหนักของความสนใจผู้ใช้
  const reasons = []; // เก็บข้อความสรุปสั้น ๆ ว่าระบบอ้างอิงจากอะไรบ้าง

  // ดึงข้อมูลโปรไฟล์ของนักเรียนมาใช้เป็นฐานความสนใจ
  const [[profile]] = await pool.query(
    `SELECT grade_level, institution, faculty, major, about, interested_subjects
     FROM student_profiles
     WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  const hasProfileInfo = !!( //โค้ดเช็คว่ามีข้อมูลส่วนตัวในโปรไฟล์หรือไม่ เพื่อใช้ในการให้คะแนนความตรงกับโพสต์ติวเตอร์
    profile?.grade_level || profile?.institution || profile?.faculty || profile?.major ||
    profile?.about || profile?.interested_subjects
  );

  if (profile?.grade_level) { //โค้ดที่เช็คว่ามีข้อมูลระดับชั้นหรือไม่ ถ้ามีจะเพิ่มคะแนนความสนใจด้วย
    addSignal(signals, profile.grade_level, 10); //
    (GRADE_GROUPS[profile.grade_level] || []).forEach((gradeAlias) => addSignal(signals, gradeAlias, 7));
    reasons.push(`ระดับชั้น ${profile.grade_level}`);
  }
  addSignal(signals, profile?.institution, 8); // สถานศึกษา
  addSignal(signals, profile?.faculty, 10); // คณะ
  addSignal(signals, profile?.major, 10); // สาขา
  addSignal(signals, profile?.interested_subjects, 16); // วิชาที่สนใจ มีผลแรงที่สุดในฝั่งโปรไฟล์
  addSignal(signals, profile?.about, 3); // about มีผลเสริมบริบท

  // ดึงโพสต์ที่นักเรียนเคยสร้าง เพื่อดูว่าเคยสนใจวิชาอะไร
  const [myPosts] = await pool.query(
    `SELECT subject, description, grade_level
     FROM student_posts
     WHERE student_id = ?
     ORDER BY created_at DESC
     LIMIT 15`,
    [userId]
  );
  myPosts.forEach((post) => {
    addSignal(signals, post.subject, 16); // วิชาในโพสต์เก่า
    addSignal(signals, post.description, 4); // รายละเอียดโพสต์
    addSignal(signals, post.grade_level, 6); // ระดับชั้นที่เคยหาเรียน
  });

  const [searches] = await pool.query(
    `SELECT keyword, created_at
     FROM search_history
     WHERE user_id = ?
     AND created_at >= DATE_SUB(NOW(), INTERVAL 20 DAY)
     ORDER BY created_at DESC
     LIMIT 80`,
    [userId]
  );
  searches.forEach((row, index) => {
    const positionWeight = Math.max(1, 8 - Math.floor(index / 4)); // คำค้นล่าสุดมีผลมากกว่าคำค้นเก่า
    const recencyWeight = getRecencyMultiplier(row.created_at, { // ยิ่งค้นหาใกล้ปัจจุบัน ยิ่งมีน้ำหนักมาก
      oneDayWeight: 3.2,
      threeDayWeight: 2.7,
      sevenDayWeight: 2.1,
      fourteenDayWeight: 1.4,
      twentyDayWeight: 0.9,
      defaultWeight: 0.4,
    });
    addSignal(signals, row.keyword, 8 * positionWeight * recencyWeight); // เพิ่มคำค้นเข้าไปเป็นความสนใจของผู้ใช้
  });

  // ดึงพฤติกรรมการใช้งานจริง เช่น กดถูกใจ เปิดโพสต์ หรือเปิดจากหน้าแนะนำ
  const [interactions] = await pool.query(
    `SELECT action_type, subject_keyword, created_at
     FROM user_interactions
     WHERE user_id = ?
     AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     ORDER BY created_at DESC
     LIMIT 120`,
    [userId]
  ).catch(() => [[]]);

  interactions.forEach((row, index) => {
    // แต่ละการกระทำสำคัญไม่เท่ากัน favorite จะหนักกว่า open_post
    const baseWeight = row.action_type === 'favorite'
      ? 18
      : row.action_type === 'open_post'
        ? 14
        : row.action_type === 'open_recommendation'
          ? 12
          : row.action_type === 'open_explore_recommendation'
            ? 9
            : row.action_type === 'search_open_post'
              ? 16
              : row.action_type === 'search_open_tutor'
              ? 12
                : 8;
    const positionWeight = Math.max(1, 10 - Math.floor(index / 6)); // interaction ล่าสุดสำคัญกว่า
    const recencyWeight = getRecencyMultiplier(row.created_at, { // interaction ใหม่กว่ามีผลมากกว่า
      oneDayWeight: 3.4,
      threeDayWeight: 2.6,
      sevenDayWeight: 1.9,
      fourteenDayWeight: 1.2,
      twentyDayWeight: 0.8,
      defaultWeight: 0.35,
    });
    addSignal(signals, row.subject_keyword, baseWeight * positionWeight * recencyWeight); // เพิ่มคำจากพฤติกรรมจริงเข้าไปใน map
  });

  // ดึงวิชาของโพสต์ที่ผู้ใช้เคยกดถูกใจ เพื่อช่วยบอกว่าชอบเนื้อหาแนวไหน
  const [favoriteSubjects] = await pool.query(
    `SELECT COALESCE(tp.subject, sp.subject) AS subject
     FROM posts_favorites pf
     LEFT JOIN tutor_posts tp ON pf.post_type = 'tutor' AND pf.post_id = tp.tutor_post_id
     LEFT JOIN student_posts sp ON pf.post_type = 'student' AND pf.post_id = sp.student_post_id
     WHERE pf.user_id = ?
     ORDER BY pf.created_at DESC
     LIMIT 30`,
    [userId]
  );
  favoriteSubjects.forEach((row) => addSignal(signals, row.subject, 12)); // น้ำหนักรองจาก favorite interaction โดยตรง

  return {
    role: 'student', // ระบุว่าชุดข้อมูลนี้เป็นของนักเรียน
    signals, // map คำสำคัญพร้อมคะแนนรวม
    reasons, // ข้อความสรุปสั้น ๆ สำหรับอธิบาย recommendation
    hasProfileInfo, // นักเรียนมีข้อมูลโปรไฟล์กรอกไว้หรือยัง
    isColdStart: signals.size === 0, // ถ้าไม่มีคำสำคัญเลย ถือว่าเป็นผู้ใช้ใหม่
    topTerms: serializeReasonTerms(signals), // คำสำคัญอันดับต้น ๆ ที่ระบบมองว่าเด่น
    gradeLevel: profile?.grade_level || '', // ส่งระดับชั้นออกไปใช้ต่อ
    institution: profile?.institution || '', // ส่งสถานศึกษาออกไปใช้ต่อ
    faculty: profile?.faculty || '', // ส่งคณะออกไปใช้ต่อ
    major: profile?.major || '', // ส่งสาขาออกไปใช้ต่อ
  };
}

// ดึงข้อมูลของติวเตอร์มาสรุปเป็นคำสำคัญ เพื่อใช้จับคู่กับโพสต์นักเรียน
async function getTutorSignals(pool, userId) {
  const signals = new Map(); // เก็บคำสำคัญของติวเตอร์พร้อมคะแนนสะสม
  // ดึงข้อมูลหลักของติวเตอร์ เช่น วิชาที่สอนได้ ระดับชั้นที่รับสอน และ about_me
  const [[profile]] = await pool.query(
    `SELECT can_teach_subjects, can_teach_grades, address, about_me
     FROM tutor_profiles
    WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  addSignal(signals, profile?.can_teach_subjects, 18); // วิชาที่สอนได้ สำคัญที่สุดสำหรับฝั่งติวเตอร์
  addSignal(signals, profile?.can_teach_grades, 8); // ระดับชั้นที่รับสอน
  addSignal(signals, profile?.about_me, 3); // about_me ใช้ช่วยเสริมบริบท

  // ดึงโพสต์เก่าของติวเตอร์ เพื่อดูว่ามักเปิดสอนเรื่องอะไร
  const [myPosts] = await pool.query(
    `SELECT subject, description, target_student_level
     FROM tutor_posts
     WHERE tutor_id = ?
     ORDER BY created_at DESC
     LIMIT 15`,
    [userId]
  );
  myPosts.forEach((row) => {
    addSignal(signals, row.subject, 18); // หัวข้อวิชาของโพสต์เก่า
    addSignal(signals, row.description, 4); // รายละเอียดโพสต์เก่า
    addSignal(signals, row.target_student_level, 6); // กลุ่มผู้เรียนที่เคยเปิดรับสอน
  });

  // ดึงประวัติการค้นหาย้อนหลัง 20 วัน เพื่อจับความสนใจล่าสุดของติวเตอร์
  const [searches] = await pool.query(
    `SELECT keyword, created_at
     FROM search_history
     WHERE user_id = ?
     AND created_at >= DATE_SUB(NOW(), INTERVAL 20 DAY)
     ORDER BY created_at DESC
     LIMIT 80`,
    [userId]
  );
  searches.forEach((row, index) => {
    const positionWeight = Math.max(1, 8 - Math.floor(index / 4)); // คำค้นล่าสุดมีผลมากกว่า
    const recencyWeight = getRecencyMultiplier(row.created_at, { // คำค้นใหม่กว่ามีน้ำหนักมากกว่า
      oneDayWeight: 3.0,
      threeDayWeight: 2.5,
      sevenDayWeight: 1.9,
      fourteenDayWeight: 1.3,
      twentyDayWeight: 0.85,
      defaultWeight: 0.4,
    });
    addSignal(signals, row.keyword, 7 * positionWeight * recencyWeight); // เพิ่มคำค้นเข้าไปในความสนใจของติวเตอร์
  });

  // ดึงพฤติกรรมที่ติวเตอร์เคยทำจริง เช่น favorite หรือเปิดดูโพสต์
  const [interactions] = await pool.query(
    `SELECT action_type, subject_keyword, created_at
     FROM user_interactions
     WHERE user_id = ?
     AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     ORDER BY created_at DESC
     LIMIT 120`,
    [userId]
  ).catch(() => [[]]);
  interactions.forEach((row, index) => {
    const baseWeight = row.action_type === 'favorite' ? 14 : row.action_type === 'open_post' ? 12 : 8; // favorite หนักกว่า open_post
    const positionWeight = Math.max(1, 10 - Math.floor(index / 6)); // interaction ล่าสุดสำคัญกว่า
    const recencyWeight = getRecencyMultiplier(row.created_at, { // interaction ใหม่กว่ามีน้ำหนักมากกว่า
      oneDayWeight: 3.2,
      threeDayWeight: 2.4,
      sevenDayWeight: 1.8,
      fourteenDayWeight: 1.2,
      twentyDayWeight: 0.8,
      defaultWeight: 0.35,
    });
    addSignal(signals, row.subject_keyword, baseWeight * positionWeight * recencyWeight); // เพิ่มคำจากพฤติกรรมจริงเข้าไปใน map
  });

  return {
    role: 'tutor', // ระบุว่าชุดข้อมูลนี้เป็นของติวเตอร์
    signals, // map คำสำคัญพร้อมคะแนนรวม
    isColdStart: signals.size === 0, // ถ้ายังไม่มีคำสำคัญเลย ถือว่าเป็น cold start
    topTerms: serializeReasonTerms(signals), // คำสำคัญอันดับต้น ๆ ของติวเตอร์
    address: profile?.address || '', // ส่งที่อยู่กลับไปใช้ต่อ
    canTeachGrades: profile?.can_teach_grades || '', // ส่งระดับชั้นที่ติวเตอร์รับสอนกลับไปใช้ต่อ
  };
}

//ดูว่าผู้ใช้เป็นนักเรียนหรือติวเตอร์ เพื่อไปดูข้อมูลส่วนตัวของเขา
async function getUserSignals(pool, userId, roleHint = '') {
  const role = roleHint || await getUserRole(pool, userId); //ถ้าไม่รู้บทบาทของผู้ใช้ ก็ไปเช็คจากฐานข้อมูล
  if (role === 'tutor' || role === 'teacher') return getTutorSignals(pool, userId); //เป็นติวเตอร์ก็ไปดูข้อมูลของติวเตอร์
  return getStudentSignals(pool, userId); //เป็นนักเรียนก็ไปดูข้อมูลของนักเรียน
}

async function getTutorRecommendationCandidates(pool, userId = 0, limit = 300) { //โค้ดเชื่อมต่อฐานข้อมูลเพื่อดึงข้อมูลโพสต์ติวเตอร์
  const [rows] = await pool.query(
    `SELECT
        tp.tutor_post_id,
        tp.tutor_id,
        tp.subject,
        tp.description,
        tp.target_student_level,
        tp.teaching_days,
        tp.teaching_time,
        tp.location,
        tp.price,
        tp.contact_info,
        tp.group_size,
        tp.created_at,
        r.name,
        r.lastname,
        r.email,
        r.username,
        tpro.profile_picture_url,
        tpro.nickname,
        tpro.about_me,
        tpro.phone,
        tpro.education,
        tpro.teaching_experience,
        tpro.can_teach_subjects,
        tpro.can_teach_grades,
        COALESCE(rv.avg_rating, 0) AS avg_rating,
        COALESCE(rv.review_count, 0) AS review_count,
        COALESCE(fvc.c, 0) AS fav_count,
        CASE WHEN fme.user_id IS NULL THEN 0 ELSE 1 END AS favorited,
        COALESCE(jc.join_count, 0) AS join_count,
        COALESCE(tc.students_taught_count, 0) AS students_taught_count,
        (SELECT status FROM tutor_post_joins WHERE tutor_post_id = tp.tutor_post_id AND user_id = ? LIMIT 1) AS my_join_status
     FROM tutor_posts tp
     JOIN register r ON tp.tutor_id = r.user_id
     LEFT JOIN tutor_profiles tpro ON tp.tutor_id = tpro.user_id
     LEFT JOIN (
       SELECT tutor_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
       FROM reviews
       GROUP BY tutor_id
     ) rv ON rv.tutor_id = tp.tutor_id
     LEFT JOIN (
       SELECT post_id, COUNT(*) AS c
       FROM posts_favorites
       WHERE post_type = 'tutor'
       GROUP BY post_id
     ) fvc ON fvc.post_id = tp.tutor_post_id
     LEFT JOIN posts_favorites fme
       ON fme.post_type = 'tutor' AND fme.post_id = tp.tutor_post_id AND fme.user_id = ?
     LEFT JOIN (
       SELECT tutor_post_id, COUNT(*) AS join_count
       FROM tutor_post_joins
       WHERE status = 'approved'
       GROUP BY tutor_post_id
     ) jc ON jc.tutor_post_id = tp.tutor_post_id
     LEFT JOIN (
       SELECT tutor_id, COUNT(DISTINCT learner_id) AS students_taught_count
       FROM (
         SELECT tp.tutor_id, j.user_id AS learner_id
         FROM tutor_posts tp
         JOIN tutor_post_joins j ON j.tutor_post_id = tp.tutor_post_id AND j.status = 'approved'
         UNION ALL
         SELECT o.tutor_id, sp.student_id AS learner_id
         FROM student_post_offers o
         JOIN student_posts sp ON sp.student_post_id = o.student_post_id
         WHERE o.status = 'approved'
         UNION ALL
         SELECT o.tutor_id, j.user_id AS learner_id
         FROM student_post_offers o
         JOIN student_post_joins j ON j.student_post_id = o.student_post_id AND j.status = 'approved'
         WHERE o.status = 'approved'
       ) taught
       GROUP BY tutor_id
     ) tc ON tc.tutor_id = tp.tutor_id
     WHERE COALESCE(tp.is_active, 1) = 1
     ORDER BY tp.created_at DESC
     LIMIT ?`,
    [userId, userId, limit]
  );
  return rows;
}

async function getStudentRecommendationCandidates(pool, limit = 300) {
  const [rows] = await pool.query(
    `SELECT
        sp.student_post_id,
        sp.student_id,
        sp.subject,
        sp.description,
        sp.preferred_days,
        sp.preferred_time,
        sp.location,
        sp.group_size,
        sp.budget,
        sp.grade_level,
        sp.contact_info,
        sp.created_at,
        r.name,
        r.lastname,
        r.username,
        spro.profile_picture_url,
        spro.institution,
        spro.faculty,
        spro.major,
        COALESCE(jc.join_count, 0) AS join_count,
        COALESCE(fvc.c, 0) AS fav_count
     FROM student_posts sp
     JOIN register r ON r.user_id = sp.student_id
     LEFT JOIN student_profiles spro ON spro.user_id = sp.student_id
     LEFT JOIN (
       SELECT student_post_id, COUNT(*) AS join_count
       FROM student_post_joins
       WHERE status = 'approved'
       GROUP BY student_post_id
     ) jc ON jc.student_post_id = sp.student_post_id
     LEFT JOIN (
       SELECT post_id, COUNT(*) AS c
       FROM posts_favorites
       WHERE post_type = 'student'
       GROUP BY post_id
     ) fvc ON fvc.post_id = sp.student_post_id
     WHERE COALESCE(sp.is_active, 1) = 1
     ORDER BY sp.created_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

function scoreTutorCandidate(row, signals) { //ฟังก์ชั่นคำนวณคะแนนความตรงของโพสต์ติวเตอร์กับความสนใจของนร. ดูจากฟิล์ดในโพสต์
  //การให้คะแนน ตรงชื่อวิชาให้สำคัญสุด
  const relevanceScore = // scoreTextAgainstSignals ฟังก์ชั่นที่ดูว่าข้อความในฟิลด์นั้นตรงกับคำสำคัญของผู้ใช้แค่ไหน และคูณด้วยน้ำหนักที่กำหนด
    scoreTextAgainstSignals(row.subject, signals, 3.2) + 
    scoreTextAgainstSignals(row.can_teach_subjects, signals, 2.4) +
    scoreTextAgainstSignals(row.description, signals, 1.2) +
    scoreTextAgainstSignals(row.about_me, signals, 0.8) +
    scoreTextAgainstSignals(row.target_student_level, signals, 1.1);

  let score = relevanceScore; //เริ่มต้นคะแนนรวมจากความเกี่ยวข้องก่อน
  score += recencyScore(row.created_at);
  score += popularityScore({
    favCount: row.fav_count,
    reviewCount: row.review_count,
    joinCount: row.join_count,
    studentCount: row.students_taught_count,
    rating: row.avg_rating,
  });

  const targetLevel = normalizeText(row.target_student_level);
  const gradeSignals = serializeReasonTerms(signals, 12).filter((term) => targetLevel.includes(term));
  if (gradeSignals.length > 0) score += 20;
  if (signals.size > 0 && relevanceScore === 0) score -= 36; //ผู้ใช้มีข้อมูลแล้ว แต่โพสต์ไม่เกี่ยวเลย ติดลบ 36
  else if (signals.size > 0 && relevanceScore < 18) score -= 12; //โพสต์เกี่ยวข้องน้อยมาก ติดลบ 12

  return score;
}

function scoreStudentCandidate(row, signals) { // คำนวณคะแนนว่าโพสต์นักเรียนนี้ตรงกับความสนใจของติวเตอร์แค่ไหน
  // relevanceScore = คะแนนความเกี่ยวข้องหลักของโพสต์นี้
  // row = ข้อมูลโพสต์นักเรียน 1 โพสต์
  // signals = คำสำคัญและน้ำหนักความสนใจของผู้ใช้ที่เก็บมาในรูปแบบ Map
  const relevanceScore =
    scoreTextAgainstSignals(row.subject, signals, 3.1) + // ชื่อวิชาสำคัญที่สุด จึงให้น้ำหนักสูง
    scoreTextAgainstSignals(row.description, signals, 1.2) + // รายละเอียดโพสต์ช่วยบอกบริบทเพิ่มเติม
    scoreTextAgainstSignals(row.grade_level, signals, 1.2) + // ระดับชั้นช่วยให้จับกลุ่มผู้เรียนได้ตรงขึ้น
    scoreTextAgainstSignals(row.institution, signals, 0.8) + // สถานศึกษามีผล แต่เบากว่าวิชา
    scoreTextAgainstSignals(row.faculty, signals, 1.0) + // คณะช่วยบอกสายการเรียน
    scoreTextAgainstSignals(row.major, signals, 1.0); // สาขาช่วยบอกความต้องการเฉพาะทาง

  let score = relevanceScore; // เริ่มต้นคะแนนรวมจากความเกี่ยวข้องก่อน
  score += recencyScore(row.created_at); // เพิ่มคะแนนให้โพสต์ใหม่
  score += popularityScore({
    favCount: row.fav_count, // จำนวนคนกดถูกใจโพสต์นี้
    joinCount: row.join_count, // จำนวนคนที่เข้าร่วมโพสต์นี้แล้ว
  });

  // ถ้าผู้ใช้มีข้อมูลความสนใจแล้ว แต่โพสต์นี้ไม่ตรงเลย ให้หักคะแนนแรง
  if (signals.size > 0 && relevanceScore === 0) score -= 28;
  // ถ้าตรงน้อยมาก ก็หักคะแนนเล็กลงมาอีกระดับ
  else if (signals.size > 0 && relevanceScore < 16) score -= 10;

  return score; // คืนคะแนนรวมสุดท้ายของโพสต์นักเรียนนี้
}

function dedupeRows(rows, keyFn) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFn(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapTutorRow(row) {
  return {
    ...row,
    id: row.tutor_post_id,
    _id: row.tutor_post_id,
    post_type: 'tutor',
    image: row.profile_picture_url || '/../blank_avatar.jpg',
    name: `${row.name || ''} ${row.lastname || ''}`.trim(),
    username: row.username,
    phone: row.phone || '',
    email: row.email || '',
    education: row.education || [],
    teaching_experience: row.teaching_experience || [],
    profile_bio: row.about_me || '',
    target_student_level: row.target_student_level || 'ทั่วไป',
    teaching_days: row.teaching_days || '',
    teaching_time: row.teaching_time || '',
    location: row.location || '',
    price: Number(row.price || 0),
    contact_info: row.contact_info || '',
    is_expired: calculateIsExpired(row),
    user: {
      first_name: row.name,
      last_name: row.lastname,
      username: row.username,
      profile_image: row.profile_picture_url || '/../blank_avatar.jpg',
    },
    meta: {
      target_student_level: row.target_student_level || 'ทั่วไป',
      teaching_days: row.teaching_days,
      teaching_time: row.teaching_time,
      location: row.location,
      price: Number(row.price || 0),
      contact_info: row.contact_info || '',
    },
    rating: Number(row.avg_rating || 0),
    reviews: Number(row.review_count || 0),
    fav_count: Number(row.fav_count || 0),
    favorited: !!row.favorited,
    join_count: Number(row.join_count || 0),
    students_taught_count: Number(row.students_taught_count || 0),
    joined: row.my_join_status === 'approved' || row.my_join_status === 'pending',
    pending_me: row.my_join_status === 'pending',
  };
}

function mapStudentRow(row) {
  return {
    ...row,
    id: row.student_post_id,
    _id: row.student_post_id,
    post_type: 'student',
    user: {
      first_name: row.name,
      last_name: row.lastname,
      username: row.username,
      profile_image: row.profile_picture_url || '/../blank_avatar.jpg',
    },
    budget: Number(row.budget || 0),
    join_count: Number(row.join_count || 0),
    fav_count: Number(row.fav_count || 0),
    createdAt: row.created_at,
  };
}

//ส่วนที่เป็น Logic ที่แนะนำโพสต์ตต.ในหน้าฟีด
async function getTutorRecommendations(pool, userId, options = {}) {
  const limit = Number(options.limit || 12); //เริ่มต้น 12 โพสต์
  if (!userId) { //ยังไม่รู้ว่าเป็นใคร ไม่มีข้อมูลอะไรเลย ให้ใช้โพสต์ใหม่และโพสต์นิยมแทน
    const latest = await getTutorRecommendationCandidates(pool, 0, 120); //ดึงโพสต์ติวเตอร์ล่าสุด 120
    const allRows = dedupeRows(latest, (row) => row.tutor_post_id); //dedupeRows ตัดโพสต์ซ้ำออก จะได้โพสต์ที่ไม่ซ้ำกันเก็บใน AllRows
    const fallbackRows = buildColdStartTutorRows(allRows, limit); //เอาโพสต์ที่ได้มาไปผ่านฟังก์ชั่น buildColdStartTutorRows ตัวแปร fallbackrows คือโพสต์ที่ผ่านการคัดแล้วสำหรับกรณีผู้ใช้ใหม่
    const fallbackItems = fallbackRows.map(mapTutorRow); //แปลงรูปแบบข้อมูลให้พร้อมแสดงผล
    const fallbackIds = new Set(fallbackRows.map((row) => row.tutor_post_id)); //เก็บ id ของโพสต์ที่เลือกเป็นรายการหลัก
    
    //โพสต์ที่ผู้ใช้จะเห็น เมื่อกดแสดงเพิ่มเติม
    const exploreItems = buildExploreTutorRows(
      allRows.filter((row) => !calculateIsExpired(row) && !fallbackIds.has(row.tutor_post_id)), //เอาโพสต์ที่ยังเรียนได้แต่ไม่ได้แสดงในรายการหลัก
      allRows.filter((row) => calculateIsExpired(row)), //ถ้าโพสต์ไหนหมดเวลาแล้วแต่ยังน่าสนใจอยู่ก็เอามาแนะนำเพิ่ม
      Math.min(limit, 12)
    ).map((row) => ({
      ...mapTutorRow(row),
      exploration_reason: calculateIsExpired(row) ? 'expired' : 'low_relevance', //ให้เหตุผลว่าทำไมโพสต์นี้ถึงมาอยู่ในส่วน explore ว่ามาจากโพสต์หมดเวลาแล้วหรือโพสต์ที่คะแนนความตรงกับผู้ใช้ต่ำ
    }));
    return { items: fallbackItems, explore_items: exploreItems, based_on: 'โพสต์ใหม่และโพสต์ยอดนิยมล่าสุด', reason_terms: [] };
  }

  const signals = await getUserSignals(pool, userId, 'student'); //ดึงข้อมูลนักเรียน ระบบจะไปดูข้อมูลของนักเรียนใน getUserSignals กรณีที่ Login หรือมี Userid แล้ว
  const candidates = await getTutorRecommendationCandidates(pool, userId, 240); //ดึงโพสต์ติวเตอร์มา 240 โพสต์ เอามาคิด

  //เอาทุกโพสต์ที่ได้มา มาคิดคะแนนก่อน
  let ranked = dedupeRows(candidates, (row) => row.tutor_post_id).map((row) => ({ //ตัดโพสต์ซ้ำ
    ...row,
    recommendation_score: scoreTutorCandidate(row, signals.signals), //คิดคะแนนแต่ละโพสต์ ที่คำนวณจาก scoreTutorCandidate
    is_expired: calculateIsExpired(row), //เช็คว่าหมดเวลาเรียนหรือยัง
  }));

  if (signals.isColdStart) { //เช็คว่าเป็นผู้ใช้ใหม่ที่ไม่มีข้อมูลอะไรเลยไหม ถ้าใช่ก็ให้เรียงตามความนิยมและความใหม่ของโพสต์เหมือนเดิม
    ranked = buildColdStartTutorRows(ranked, Math.max(limit * 3, 24)).map((row, index) => ({
      ...row,
      recommendation_score: Math.max(1, 100 - index), //ให้คะแนนเป็นลำดับแทน เพราะมัน personalized ไม่ได้
      is_expired: calculateIsExpired(row),
    }));
  } else {
    //ถ้ามีข้อมูลผู้ใช้แล้ว เรียงตามคะแนนจากมากไปน้อย
    ranked = ranked.sort((a, b) => b.recommendation_score - a.recommendation_score);
  }

  //แยกโพสต์ที่ยังเรียนได้ กับโพสต์ที่หมดเวลาแล้วออกจากกัน
  const activeRanked = ranked.filter((row) => !row.is_expired);
  const expiredRanked = ranked.filter((row) => row.is_expired);

  //คัดโพสต์ให้หลากหลาย ไม่ซ้ำติวเตอร์หรือวิชาเดิมมากไป
  let primaryRows = diversifyTutorRows(activeRanked, limit); //โพสต์หลักที่เลือกมาแล้วว่ายัง active อยู่ diversifyTutorRows กันติวเตอร์ซ้ำหรือโพสต์วิชาเดิมๆ
  const hasTopTermCoverage = primaryRows.some((row) => rowMatchesTopTerms(row, signals.topTerms)); //โพสต์ที่เอามามีตรงไหมถ้าไม่มีเลยทำบรรทัดต่อไป

  if (!hasTopTermCoverage) { //ถ้าโพสต์ยังไม่ครอบคลุมที่ผู้ใช้สนใจ ระบบจะดึงโพสต์หมดเวลาแต่ตรงคำสำคัญมาแทรกได้
    const exactExpiredRows = expiredRanked //เอาโพสต์หมดเวลาแล้วแต่ตรงกับความสนใจของผู้ใช้มาแนะนำเพิ่ม
      .filter((row) => row.recommendation_score > 0 && rowMatchesTopTerms(row, signals.topTerms))
      .sort((a, b) => b.recommendation_score - a.recommendation_score);

    if (exactExpiredRows.length > 0) { //ถ้ามีโพสต์หมดเวลาแต่ตรงคะแนนที่ได้มากกว่า 0 และตรงกับคำสำคัญของผู้ใช้
      const replacementLimit = Math.min(Math.max(1, Math.floor(limit / 3)), exactExpiredRows.length); //โพสต์ที่หมดเวลาแต่ตรงกับผู้ใช้
      const keptActiveRows = primaryRows.slice(0, Math.max(0, limit - replacementLimit));
      const replacementRows = exactExpiredRows.slice(0, replacementLimit).map((row) => ({
        ...row,
        is_expired: true,
      }));
      primaryRows = [...keptActiveRows, ...replacementRows];
    }
  }

  const primaryIds = new Set(primaryRows.map((row) => row.tutor_post_id));
  const lowerRelevanceRows = activeRanked.filter((row) => !primaryIds.has(row.tutor_post_id)); //โพสต์คะแนนรองลงมา
  const exploreRows = buildExploreTutorRows(lowerRelevanceRows, expiredRanked, Math.min(limit, 12));

  const items = primaryRows.map(mapTutorRow);
  const exploreItems = exploreRows.map((row) => ({
    ...mapTutorRow(row),
    exploration_reason: row.is_expired ? 'expired' : 'low_relevance',
  }));
  const basedOn = signals.isColdStart
    ? 'โปรไฟล์ยังไม่ครบ จึงใช้โพสต์ใหม่ล่าสุดและความนิยมของติวเตอร์'
    : `วิเคราะห์จากความสนใจล่าสุด: ${signals.topTerms.slice(0, 5).join(', ')}`;
  return { items, explore_items: exploreItems, based_on: basedOn, reason_terms: signals.topTerms }; //แสดงสิ่งที่แนะนำมาได้ไป frontend
}

async function getStudentRecommendationsForTutor(pool, userId, options = {}) {
  const limit = Number(options.limit || 30);
  const signals = await getUserSignals(pool, userId, 'tutor'); //ดึงข้อมูลของติวเตอร์ว่าสอนอะไรได้บ้าง
  const candidates = await getStudentRecommendationCandidates(pool, 240); //ดึงโพสต์นักเรียนมาเตรียมไว้

  // คิดคะแนนว่าโพสต์นักเรียนไหนตรงกับติวเตอร์มากที่สุด
  let ranked = dedupeRows(candidates, (row) => row.student_post_id).map((row) => ({
    ...row,
    recommendation_score: scoreStudentCandidate(row, signals.signals),
  }));

  if (signals.isColdStart) { //isColdStart คือเป็นค่าเริ่มต้นที่ไม่มีอะไรเลย
    // ถ้ายังไม่มีข้อมูลติวเตอร์พอ ให้เรียงตามความนิยมและความใหม่ของโพสต์ เหมือนนักเรียนเลยจ้า
    ranked = ranked.sort((a, b) => (
      (popularityScore({ favCount: b.fav_count, joinCount: b.join_count }) + recencyScore(b.created_at)) -
      (popularityScore({ favCount: a.fav_count, joinCount: a.join_count }) + recencyScore(a.created_at))
    ));
  } else {
    // ถ้ามีข้อมูลแล้ว ให้เรียงตามคะแนนความเกี่ยวข้อง
    ranked = ranked.sort((a, b) => b.recommendation_score - a.recommendation_score);
  }

  return { //แสดงผลการแนะนำโพสต์สำหรับติวเตอร์
    items: ranked.slice(0, limit).map(mapStudentRow),
    based_on: signals.isColdStart
      ? 'ยังไม่มีข้อมูลการสอนมากพอ จึงใช้โพสต์ใหม่และโพสต์ที่มีความเคลื่อนไหวสูง'
      : `คัดจากวิชาที่คุณสอนและพฤติกรรมล่าสุด: ${signals.topTerms.slice(0, 5).join(', ')}`,
    reason_terms: signals.topTerms,
  };
}

async function getMixedFeedRecommendations(pool, userId, options = {}) {
  const limit = Number(options.limit || 20);
  // ใช้ข้อมูลความสนใจของนักเรียนเป็นตัวกลางสำหรับฟีดรวม ตรงหน้ารายการที่สนใจ
  const signals = await getUserSignals(pool, userId, 'student');
  // ดึงโพสต์ติวเตอร์และโพสต์นักเรียนมาพร้อมกัน
  const [tutors, students] = await Promise.all([
    getTutorRecommendationCandidates(pool, userId, 160),
    getStudentRecommendationCandidates(pool, 160),
  ]);

  // คิดคะแนนโพสต์ติวเตอร์และโพสต์นักเรียนแยกกันก่อน
  const rankedTutors = dedupeRows(tutors, (row) => `t-${row.tutor_post_id}`).map((row) => ({
    ...mapTutorRow(row),
    recommendation_score: scoreTutorCandidate(row, signals.signals) + 8,
  })).filter((row) => !row.is_expired);
  const rankedStudents = dedupeRows(students, (row) => `s-${row.student_post_id}`).map((row) => ({
    ...mapStudentRow(row),
    recommendation_score: scoreStudentCandidate(row, signals.signals),
  }));

  // รวมสองฝั่งแล้วเรียงใหม่อีกรอบให้เหลือโพสต์ที่น่าสนใจที่สุด
  const merged = [...rankedTutors, ...rankedStudents]
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, limit);

  return {
    posts: merged,
    recommended_subjects: signals.topTerms,
    based_on: signals.isColdStart ? 'โพสต์ใหม่และโพสต์ยอดนิยมล่าสุด' : `ความสนใจล่าสุด: ${signals.topTerms.slice(0, 5).join(', ')}`,
  };
}

function buildTutorAggregateRows(rows) { //ติวเตอร์คนเดียวมีหลายโพสต์ จะเอาโพสต์ที่คะแนนดีที่สุดมาเป็นตัวแทน
  const byTutor = new Map(); 
  rows.forEach((row) => {
    const key = row.tutor_id;
    const current = byTutor.get(key);
    if (!current || row.recommendation_score > current.recommendation_score) {
      byTutor.set(key, row);
    }
  });
  return Array.from(byTutor.values());
}

async function smartSearch(pool, query, userId = 0) { //ระบบค้นหาที่ดูทั้งคำค้นหาและข้อมูลผู้ใช้ไปพร้อมกัน
  // ถ้ามีผู้ใช้ ให้เอาความสนใจเดิมของเขามาช่วยค้นด้วย
  const signals = userId ? await getUserSignals(pool, userId).catch(() => ({ signals: new Map() })) : { signals: new Map() };
  const querySignals = new Map();
  // คำค้นปัจจุบันเป็นตัวหลักของการค้นรอบนี้
  addSignal(querySignals, query, 20);
  // เอาความสนใจเดิมมาผสม แต่ไม่ให้แรงเกินคำค้นหลัก
  for (const [term, weight] of (signals.signals || new Map()).entries()) {
    querySignals.set(term, (querySignals.get(term) || 0) + Math.min(weight, 14));
  }

  const [tutors, students] = await Promise.all([
    getTutorRecommendationCandidates(pool, userId, 220),
    getStudentRecommendationCandidates(pool, 220),
  ]);

  // คิดคะแนนโพสต์ติวเตอร์ แล้วตัดโพสต์ที่ไม่เกี่ยวหรือหมดเวลาออก
  const tutorPosts = dedupeRows(tutors, (row) => row.tutor_post_id).map((row) => ({
    ...row,
    recommendation_score: scoreTutorCandidate(row, querySignals),
  })).filter((row) => row.recommendation_score > 0 && !calculateIsExpired(row));

  // คิดคะแนนโพสต์นักเรียน แล้วตัดโพสต์ที่ไม่เกี่ยวออก
  const studentPosts = dedupeRows(students, (row) => row.student_post_id).map((row) => ({
    ...row,
    recommendation_score: scoreStudentCandidate(row, querySignals),
  })).filter((row) => row.recommendation_score > 0);

  // รวมโพสต์ของติวเตอร์คนเดิมให้เหลือแค่ตัวแทนที่คะแนนดีที่สุด
  const tutorProfiles = buildTutorAggregateRows(tutorPosts).slice(0, 12).map((row) => ({
    tutor_id: row.tutor_id,
    name: `${row.name || ''} ${row.lastname || ''}`.trim(),
    username: row.username,
    nickname: row.nickname,
    profile_picture_url: row.profile_picture_url || '/../blank_avatar.jpg',
    avg_rating: Number(row.avg_rating || 0),
    review_count: Number(row.review_count || 0),
    can_teach_subjects: row.can_teach_subjects || row.subject || '',
    about_me: row.about_me || '',
    relevance_score: row.recommendation_score,
  }));

  return {
    // รายชื่อติวเตอร์ที่ตรงกับคำค้นมากที่สุด
    tutors: tutorProfiles,
    // โพสต์ติวเตอร์ที่ตรงกับคำค้นมากที่สุด
    posts: tutorPosts.sort((a, b) => b.recommendation_score - a.recommendation_score).slice(0, 18).map(mapTutorRow),
    // โพสต์นักเรียนที่ตรงกับคำค้นมากที่สุด
    students: studentPosts.sort((a, b) => b.recommendation_score - a.recommendation_score).slice(0, 18).map(mapStudentRow),
    keyword_used: query,
    // คำหลักที่ระบบใช้ตีความคำค้นครั้งนี้
    reason_terms: serializeReasonTerms(querySignals, 6),
  };
}

module.exports = {
  SUBJECT_SYNONYMS,
  expandTerms,
  normalizeText,
  tokenize,
  getUserSignals,
  getTutorRecommendations,
  getStudentRecommendationsForTutor,
  getMixedFeedRecommendations,
  smartSearch,
};
