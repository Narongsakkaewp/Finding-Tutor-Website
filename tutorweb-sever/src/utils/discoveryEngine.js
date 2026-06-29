//tutorweb-sever/src/utils/discoveryEngine.js
const {
  scoreTextVariants,
  semanticSimilarityToPercent,
} = require('./semanticEmbedding');

// Discovery Engine คือส่วนกลางของระบบ Recommendation/Search
// หน้าที่หลักของไฟล์นี้มี 5 ส่วน:
// 1. แปลงข้อความโปรไฟล์/โพสต์เป็น multilingual embeddings แล้ววัด semantic similarity
// 2. สร้าง user signals จาก Bio/Profile, โพสต์เก่า, การค้นหา และพฤติกรรมการใช้งาน
// 3. คำนวณคะแนน recommendation เต็ม 100 คะแนน แบ่งเป็น Relevance 60, Recency 20, Popularity 20
// 4. กรองโพสต์ที่ไม่ผ่านเงื่อนไขหลัก เช่น วิชาไม่ตรง ระดับชั้นไม่ตรง หรือ Relevance Percent ไม่เกิน 80
// 5. ส่งรายการแนะนำให้ frontend ทั้งฝั่งนักเรียน, ฝั่งติวเตอร์, mixed feed และ smart search
//
// โครงสร้างคะแนนหลักของ Recommendation:
// 1) Relevance = 60 คะแนน
//    เป็นคะแนนสำคัญที่สุด ใช้ตอบคำถามว่า "โพสต์นี้ตรงกับสิ่งที่ผู้ใช้ต้องการหรือไม่"
//    SubjectMatch และ CanTeachMatch มาจาก semantic embedding similarity
//    ส่วน LevelMatch เป็น business rule แบบ hard rule เพื่อกันระดับชั้นผิดกลุ่ม
//
// 2) Recency = 20 คะแนน
//    เป็นคะแนนเสริมจากความใหม่ของโพสต์ ใช้ช่วยเรียงโพสต์ที่เกี่ยวข้องใกล้เคียงกัน
//    โพสต์ที่ใหม่กว่าจะได้เปรียบ แต่ Recency จะไม่ช่วยโพสต์ที่ Relevance ไม่ผ่าน
//
// 3) Popularity = 20 คะแนน
//    เป็นคะแนนเสริมจากพฤติกรรมผู้ใช้ เช่น favorites, joins และ rating
//    ใช้สะท้อนความน่าสนใจ/ความน่าเชื่อถือของโพสต์ แต่ไม่ให้ชนะโพสต์ที่ตรงกับผู้ใช้มากกว่า
//
// Final Score = RelevanceScore + RecencyScore + PopularityScore
// โดย RelevanceScore เต็ม 60, RecencyScore เต็ม 20, PopularityScore เต็ม 20
//
// หมายเหตุ:
// - ค่า weight ภายในหลายตัวเป็น "น้ำหนักดิบ" เพื่อสร้าง/จัดลำดับ signal ไม่ใช่คะแนนสุดท้ายโดยตรง
// - การตีความความหมายของวิชาใช้ embeddings เท่านั้น
// - คะแนนสุดท้ายจะถูก scale/cap ผ่าน RECOMMENDATION_SCORE_CAPS ให้ไม่เกิน 100 เสมอ
// - โพสต์หมดอายุยังแสดงได้ตาม requirement แต่ต้องยังเกี่ยวข้องกับ Subject/CanTeach/Level ของผู้ใช้
const STOPWORDS = new Set([
  'และ', 'กับ', 'ของ', 'ที่', 'ให้', 'ได้', 'อยาก', 'หา', 'เรียน', 'สอน', 'วิชา',
  'the', 'for', 'and', 'with', 'from', 'into', 'this', 'that', 'your',
]);

const GRADE_GROUPS = {
  'ประถมศึกษา': ['ประถม', 'primary', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
  'ประถม': ['ประถมศึกษา', 'primary', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
  'มัธยมต้น': ['มัธยมศึกษาตอนต้น', 'ม.ต้น', 'ม.1', 'ม.2', 'ม.3', 'middle school'],
  'มัธยมศึกษาตอนต้น': ['มัธยมต้น', 'ม.ต้น', 'ม.1', 'ม.2', 'ม.3', 'middle school'],
  'มัธยมปลาย': ['มัธยมศึกษาตอนปลาย', 'ม.ปลาย', 'ม.4', 'ม.5', 'ม.6', 'high school'],
  'มัธยมศึกษาตอนปลาย': ['มัธยมปลาย', 'ม.ปลาย', 'ม.4', 'ม.5', 'ม.6', 'high school'],
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

//เพดานคะแนนรวมของระบบ (รวม 100 คะแนน ตามที่อาจารย์กำหนด)
const RECOMMENDATION_SCORE_CAPS = Object.freeze({
  relevance: 60,   // Relevance score สูงสุด 60 คะแนน
  popularity: 20,  // Popularity score สูงสุด 20 คะแนน
  recency: 20,     // Recency score สูงสุด 20 คะแนน
});

// เกณฑ์ขั้นต่ำของ Relevance Percent
// SubjectMatch/CanTeachMatch ถูก normalize จาก cosine similarity เป็น 0-100
// ส่วน LevelMatch ยังเป็น 0/100 และสูตรรวมต้องได้มากกว่า 80
const RELEVANCE_THRESHOLD_RATIO = 0.80;

// จำกัดน้ำหนักสะสมของ keyword หนึ่งคำ ไม่ให้คำเดียวครอบระบบมากเกินไป
// เช่น ผู้ใช้ค้นหา "คณิต" ซ้ำหลายครั้ง คำนี้จะไม่โตจนกลบคำอื่นทั้งหมด
const MAX_SIGNAL_WEIGHT_PER_TERM = 100;

// น้ำหนักข้อมูลจาก Bio/Profile ของนักเรียน
// ใช้สร้าง signals สำหรับแนะนำโพสต์ติวเตอร์ให้นักเรียน
// interestedSubjects สูงสุด เพราะเป็นความต้องการโดยตรงของนักเรียน
const STUDENT_PROFILE_SIGNAL_WEIGHTS = Object.freeze({
  gradeLevel: 28,
  gradeGroup: 16,
  institution: 0,
  faculty: 5,
  major: 15,
  interestedSubjects: 45,
  about: 4,
});

// น้ำหนักจากโพสต์ที่นักเรียนเคยสร้าง
// ใช้เป็นประวัติความสนใจย้อนหลัง แต่ยังให้น้ำหนักรองจาก Bio/Profile
const STUDENT_POST_HISTORY_SIGNAL_WEIGHTS = Object.freeze({
  subject: 50,
  description: 20,
  gradeLevel: 18,
});

// น้ำหนักข้อมูลจาก Bio/Profile ของติวเตอร์
// canTeachSubjects สำคัญที่สุด เพราะเป็นวิชาที่ติวเตอร์ระบุว่าสอนได้จริง
const TUTOR_PROFILE_SIGNAL_WEIGHTS = Object.freeze({
  canTeachSubjects: 55,
  canTeachGrades: 8,
  aboutMe: 15,
});

// น้ำหนักจากโพสต์เก่าของติวเตอร์
// ใช้เสริมว่าติวเตอร์เคยเปิดสอนเรื่องอะไร แต่ไม่ควรกลบวิชาที่ระบุใน Bio
const TUTOR_POST_HISTORY_SIGNAL_WEIGHTS = Object.freeze({
  subject: 55,
  description: 15,
  targetStudentLevel: 5,
});

// น้ำหนักจากพฤติกรรมการใช้งานจริง
// favorite หนักกว่า open เพราะแปลว่าผู้ใช้สนใจมากกว่าแค่เปิดดู
const INTERACTION_SIGNAL_WEIGHTS = Object.freeze({
  favorite: 4,
  openPost: 2.5,
  openRecommendation: 2,
  openExploreRecommendation: 1.5,
  searchOpenPost: 3,
  searchOpenTutor: 2,
  default: 1,
});

// สัดส่วนของ Relevance สำหรับโพสต์ติวเตอร์
// SubjectMatch และ CanTeachMatch เป็นคะแนน 0-100 จาก semantic embedding similarity
// ไม่ใช่การเทียบคำตรง ๆ และไม่ใช้ synonyms แบบเก่าแล้ว
//
// สูตร Relevance Percent:
// RelevancePercent = SubjectMatch*0.55 + CanTeachMatch*(LevelMatch/100)*0.45
//
// เหตุผลของน้ำหนัก:
// - Subject 55%: วิชาของโพสต์ต้องตรงกับความต้องการหลักของผู้ใช้
// - CanTeach 45%: รายการวิชาที่ติวเตอร์สอนได้ช่วยยืนยันว่าติวเตอร์สอนเรื่องนั้นได้จริง
// - LevelMatch: ใช้คูณ CanTeach เพื่อกันกรณีวิชาคล้ายกันแต่ระดับชั้นไม่เหมาะ
const TUTOR_RELEVANCE_FIELD_POINTS = Object.freeze({
  subject: 55,             // SubjectMatch คิดเป็น 55% ของ Relevance Percent
  canTeachSubjects: 45,    // CanTeachMatch คิดเป็น 45% แต่ต้องคูณ LevelMatch ก่อน
  targetStudentLevel: 100, // LevelMatch ใช้เป็นตัวคูณ 0 หรือ 1 ไม่ได้นำไปบวกตรง ๆ
});

const STUDENT_RELEVANCE_FIELD_POINTS = Object.freeze({
  // ใช้กับโพสต์นักเรียนที่จะแนะนำให้ติวเตอร์
  // subject สำคัญที่สุด ส่วน grade/major/faculty เป็นตัวช่วยเสริมความเกี่ยวข้อง
  subject: 28,
  description: 8,
  gradeLevel: 4,
  major: 8,
  faculty: 2,
  institution: 0,
});

// Popularity field points สำหรับโพสต์ติวเตอร์ (ตัวแปรย่อย: Favorites, Joins, Rating)
const TUTOR_POPULARITY_FIELD_POINTS = Object.freeze({
  favorites: 30,  // จำนวนการกดถูกใจ
  joins: 30,      // จำนวนการเข้าร่วม
  rating: 40,     // คะแนนรีวิว (สำคัญที่สุดในส่วน popularity)
});

const STUDENT_POPULARITY_FIELD_POINTS = Object.freeze({
  // ใช้กับโพสต์นักเรียน: คนกดสนใจ/เข้าร่วมเยอะ แปลว่าโพสต์มีความเคลื่อนไหว
  favorites: 45,
  joins: 55,
});

// ---------------------------------------------------------------------------
// 1) Text normalization
// token ใช้สำหรับสร้างคำอธิบายและจัดกลุ่มข้อความที่เหมือนกันเท่านั้น
// การตัดสินความเกี่ยวข้องของวิชาใช้ semantic embeddings
// ---------------------------------------------------------------------------

// ทำความสะอาดข้อความก่อนนำไปเทียบ
// แปลงเป็นตัวพิมพ์เล็ก ลบสัญลักษณ์ที่ไม่จำเป็น และรวมช่องว่างให้เป็นรูปแบบเดียวกัน
function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\s./#+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// แยกข้อความเป็น token สำหรับจับคู่
// นอกจากคำเดี่ยวแล้วยังสร้าง phrase 2-3 คำ เช่น "data structure"
// เพื่อให้ระบบจับคู่คำสำคัญที่เป็นวลีได้
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

// เพิ่ม keyword เข้า signal map พร้อมน้ำหนัก
// เก็บเฉพาะ token ที่ปรากฏจริง ไม่มีการเติมคำหรือหมวดวิชา
// มี cap ต่อคำที่ MAX_SIGNAL_WEIGHT_PER_TERM เพื่อไม่ให้คำเดียวแรงเกินไป
function addSignal(map, rawText, weight) {
  if (!rawText || !weight) return;
  tokenize(rawText).forEach((term) => {
    if (!term || STOPWORDS.has(term) || term.length < 2) return;
    map.set(term, Math.min(MAX_SIGNAL_WEIGHT_PER_TERM, (map.get(term) || 0) + weight));
  });
}

// คำนวณ multiplier ตามความใหม่ของข้อมูลพฤติกรรม
// ใช้กับ search history / interactions เพื่อให้พฤติกรรมล่าสุดมีน้ำหนักมากกว่าอดีต
function getRecencyMultiplier(dateValue, windows = {}) {
  const ageDays = daysSince(dateValue);
  if (ageDays <= (windows.oneDay ?? 1)) return windows.oneDayWeight ?? 2.8;
  if (ageDays <= (windows.threeDays ?? 3)) return windows.threeDayWeight ?? 2.2;
  if (ageDays <= (windows.sevenDays ?? 7)) return windows.sevenDayWeight ?? 1.7;
  if (ageDays <= (windows.fourteenDays ?? 14)) return windows.fourteenDayWeight ?? 1.25;
  if (ageDays <= (windows.twentyDays ?? 20)) return windows.twentyDayWeight ?? 0.85;
  return windows.defaultWeight ?? 0.45;
}

// ดึง keyword ที่มีน้ำหนักสูงสุดออกมาเป็น array
// ใช้ส่งให้ frontend อธิบายว่า recommendation อ้างอิงจากคำใด
function serializeReasonTerms(signalMap, limit = 5) {
  return Array.from(signalMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

// สร้างชุดคำที่ปรากฏจริงจากช่อง "วิชาที่สนใจ" เพื่อใช้แสดงเหตุผล
function buildPrimaryInterestTerms(rawText) {
  return tokenize(rawText).map((term) => normalizeText(term)).filter(Boolean);
}

// ---------------------------------------------------------------------------
// 2) Score helpers
// กลุ่มนี้ใช้ scale คะแนนดิบให้เข้าเพดานคะแนนที่กำหนด
// และรวมคะแนน Relevance + Popularity + Recency ให้อยู่ใน 100 คะแนน
// ---------------------------------------------------------------------------

// รวมคะแนนเต็มของ object config
// เช่น { relevance: 60, popularity: 20, recency: 20 } -> 100
function sumConfigPoints(config) {
  return Object.values(config).reduce((sum, value) => sum + Number(value || 0), 0);
}

// แปลงคะแนนดิบให้อยู่ในเพดานที่กำหนด
// เช่น raw 50 จาก max 100 และ cap 20 จะได้ 10 คะแนน
function scaleToWeightedCap(rawScore, rawMax, weightedCap) {
  if (!rawMax || !weightedCap) return 0;
  const safeRaw = Math.max(0, Number(rawScore || 0));
  const ratio = Math.min(1, safeRaw / rawMax);
  return Number((ratio * weightedCap).toFixed(2));
}

// แปลงคะแนนดิบแบบ soft cap ด้วย exponential curve
// ใช้เมื่อต้องการให้คะแนนเพิ่มเร็วช่วงแรก แล้วค่อย ๆ อิ่มตัว
function softCapScore(rawScore, weightedCap, pivot = 1) {
  if (!weightedCap || !pivot) return 0;
  const safeRaw = Math.max(0, Number(rawScore || 0));
  const normalized = 1 - Math.exp(-safeRaw / pivot);
  return Number((normalized * weightedCap).toFixed(2));
}

// รวมคะแนนทั้ง 3 ส่วน และบังคับไม่ให้เกินเพดาน 100 คะแนน
// Relevance ไม่เกิน 60, Popularity ไม่เกิน 20, Recency ไม่เกิน 20
function capRecommendationScore(relevanceScore, popularityScoreValue, recencyScoreValue) {
  const relevance = Math.min(RECOMMENDATION_SCORE_CAPS.relevance, Math.max(0, Number(relevanceScore || 0)));
  const popularity = Math.min(RECOMMENDATION_SCORE_CAPS.popularity, Math.max(0, Number(popularityScoreValue || 0)));
  const recency = Math.min(RECOMMENDATION_SCORE_CAPS.recency, Math.max(0, Number(recencyScoreValue || 0)));
  const totalCap = sumConfigPoints(RECOMMENDATION_SCORE_CAPS);
  return Number(Math.min(totalCap, relevance + popularity + recency).toFixed(2));
}

// helper สำรองสำหรับกรณีที่มีการส่ง relevanceScore เต็ม 60 เข้ามาโดยตรง
// flow หลักปัจจุบันใช้ Relevance Percent > 80 ใน buildTutorRelevanceBreakdown แทน
function applyRelevanceThreshold(relevanceScore) {
  const relevanceCap = RECOMMENDATION_SCORE_CAPS.relevance;
  const relevanceThreshold = relevanceCap * RELEVANCE_THRESHOLD_RATIO;
  if (relevanceScore <= 0 || relevanceScore <= relevanceThreshold) return 0;
  return relevanceScore;
}

// ---------------------------------------------------------------------------
// 3) Schedule / expiration helpers
// กลุ่มนี้ใช้แปลงวันเวลาเรียนของโพสต์ และตรวจว่าโพสต์หมดอายุแล้วหรือยัง
// โพสต์จะถือว่าหมดอายุเมื่อทุก session ผ่านวันเวลาปัจจุบันไปแล้ว
// ---------------------------------------------------------------------------

// แปลงค่าวันและเวลาให้เป็น Date object
// รองรับวันที่แบบ YYYY-MM-DD และ DD/MM/YYYY
// ถ้าไม่มีเวลา จะตั้งเป็น 23:59:59 เพื่อถือว่าวันนั้นยังไม่หมดจนจบวัน
function parseScheduleDateTime(dateValue, timeValue) {
  const dateText = String(dateValue || '').trim();
  if (!dateText) return null;

  const ymd = dateText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmy = dateText.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!ymd && !dmy) return null;

  const year = ymd ? Number(ymd[1]) : Number(dmy[3]) > 2400 ? Number(dmy[3]) - 543 : Number(dmy[3]);
  const month = ymd ? Number(ymd[2]) - 1 : Number(dmy[2]) - 1;
  const day = ymd ? Number(ymd[3]) : Number(dmy[1]);
  const timeText = String(timeValue || '').trim();
  const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);

  const parsed = new Date(
    year,
    month,
    day,
    timeMatch ? Number(timeMatch[1]) : 23,
    timeMatch ? Number(timeMatch[2]) : 59,
    timeMatch ? Number(timeMatch[3] || 0) : 59
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ดึงวัน/เวลาสอนทั้งหมดของโพสต์ออกมาเป็นรายการ Date
// ใช้ได้ทั้งโพสต์ติวเตอร์ (teaching_days/time) และโพสต์นักเรียน (preferred_days/time)
function getPostSessionTimes(post = {}) {
  const dayText = String(post.teaching_days || post.preferred_days || '').trim();
  const timeText = String(post.teaching_time || post.preferred_time || '').trim();
  const extractedDays = dayText.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}/g);
  const extractedTimes = timeText.match(/\d{1,2}:\d{2}(?::\d{2})?/g);
  const days = (extractedDays || dayText.split(',')).map((entry) => entry.trim()).filter(Boolean);
  const times = (extractedTimes || timeText.split(',')).map((entry) => entry.trim());

  return days
    .map((day, index) => parseScheduleDateTime(day, times[index] || times[0] || ''))
    .filter(Boolean);
}

// หา session ล่าสุดของโพสต์
// ใช้เป็น expired_at เพื่อเรียงโพสต์หมดอายุจากล่าสุดไปเก่าสุด
function getPostLastSessionTime(post = {}) {
  const sessions = getPostSessionTimes(post);
  if (!sessions.length) return null;
  return sessions.reduce((latest, session) => (
    !latest || session.getTime() > latest.getTime() ? session : latest
  ), null);
}

// ---------------------------------------------------------------------------
// 4) Tutor-post relevance scoring
// ใช้กับฝั่งนักเรียนที่ต้องการหาโพสต์รับสอนของติวเตอร์
// สูตรหลัก: Subject + CanTeach * Level
// โดย SubjectMatch และ CanTeachMatch เป็นคะแนน 0-100 จาก embedding similarity
// ส่วน LevelMatch เป็น 0/100 เพราะเป็นเงื่อนไขระดับชั้นที่ควรตรงแบบชัดเจน
// ถ้า Relevance Percent ไม่มากกว่า 80 จะไม่คิด Recency และ Popularity ต่อ
// ---------------------------------------------------------------------------

function buildTutorRelevanceBreakdown(row, signals, context = {}) {
  // SubjectMatch:
  // เปรียบเทียบ "ความต้องการ/ความสนใจของนักเรียน" กับ "subject ของโพสต์"
  // ค่านี้มาจาก cosine similarity ของ embedding แล้วแปลงเป็นเปอร์เซ็นต์ 0-100
  // ถ้า semanticSubjectMatch เป็น null แปลว่าโมเดล embedding ใช้งานไม่ได้หรือไม่มีข้อความให้เทียบ
  const semanticSubjectMatch = semanticSimilarityToPercent(row.semantic_subject_similarity);
  const subjectMatch = semanticSubjectMatch ?? 0;

  // CanTeachMatch:
  // เปรียบเทียบ "ความต้องการ/ความสนใจของนักเรียน" กับ "วิชาที่ติวเตอร์ระบุว่าสอนได้"
  // ใช้ช่วยยืนยันว่าโพสต์ไม่ได้แค่ตั้งชื่อวิชาคล้ายกัน แต่โปรไฟล์ติวเตอร์ก็รองรับวิชานั้นด้วย
  const semanticCanTeachMatch = semanticSimilarityToPercent(row.semantic_can_teach_similarity);
  const canTeachMatch = semanticCanTeachMatch ?? 0;

  // Level Match: ถ้านักเรียนมีระดับชั้นใน Bio จะใช้เป็น hard condition
  // เช่น มัธยมต้นต้อง match กับ ม.1-ม.3 เท่านั้น ไม่ให้ มัธยมปลายผ่าน
  const levelMatch = context.gradeLevel
    ? (hasGradeLevelOverlap(row.target_student_level, context.gradeLevel) ? 100 : 0)
    : 100;
  const levelMultiplier = levelMatch / 100;

  // สูตร Relevance Percent:
  // RelevancePercent = SubjectMatch*0.55 + CanTeachMatch*(LevelMatch/100)*0.45
  //
  // ตัวอย่าง:
  // SubjectMatch = 90, CanTeachMatch = 85, LevelMatch = 100
  // RelevancePercent = 90*0.55 + 85*1*0.45 = 87.75
  //
  // ถ้า LevelMatch = 0 ส่วน CanTeach จะถูกตัดออกทันที
  // เพื่อกันการแนะนำโพสต์ที่วิชาใกล้เคียงแต่ระดับชั้นไม่เหมาะกับผู้ใช้
  const relevancePercent = Math.min(
    100,
    (subjectMatch * 0.55) + (canTeachMatch * levelMultiplier * 0.45)
  );

  // แปลง Relevance Percent 0-100 ให้เป็น Relevance Score เต็ม 60 คะแนน
  // เช่น RelevancePercent 90 จะได้ RelevanceScore 54 คะแนน
  const relevanceScore = scaleToWeightedCap(relevancePercent, 100, RECOMMENDATION_SCORE_CAPS.relevance);

  // Gate สำคัญของระบบ:
  // ต้องมี SubjectMatch, CanTeachMatch, LevelMatch และ RelevancePercent > 80
  // ถ้าไม่ผ่าน จะไม่ให้ Recency/Popularity มาดันโพสต์นั้นขึ้นมา
  // เหตุผลคือโพสต์ยอดนิยมหรือโพสต์ใหม่มาก ๆ ไม่ควรชนะแค่เพราะดัง/ใหม่ ถ้าวิชาไม่ตรงกับผู้ใช้
  const passesRelevance =
    subjectMatch > 0 &&
    canTeachMatch > 0 &&
    levelMatch > 0 &&
    relevancePercent > 80;

  return {
    subject_match: Number(subjectMatch.toFixed(2)),
    can_teach_match: Number(canTeachMatch.toFixed(2)),
    level_match: Number(levelMatch.toFixed(2)),
    relevance_percent: Number(relevancePercent.toFixed(2)),
    relevance_score: passesRelevance ? relevanceScore : 0,
    passes_relevance: passesRelevance,
  };
}

// คำนวณคะแนนรวมของโพสต์ติวเตอร์ 1 โพสต์
// ขั้นแรกคิด Relevance ถ้าไม่ผ่านจะคืนคะแนนรวม 0 ทันที
// ถ้าผ่านแล้วจึงคำนวณ Popularity และ Recency ต่อ
function buildTutorRecommendationScore(row, signals, context = {}) {
  const relevance = buildTutorRelevanceBreakdown(row, signals, context);
  if (!relevance.passes_relevance) {
    // ถ้า relevance ไม่ผ่านเกณฑ์ จะไม่ให้ Recency/Popularity ช่วยดันโพสต์ขึ้นมา
    return {
      ...relevance,
      popularity_score: 0,
      recency_score: 0,
      recommendation_score: 0,
    };
  }

  // หลังจากผ่าน Relevance แล้ว จึงค่อยคิดคะแนนเสริม:
  // - Popularity: ความนิยม/ความน่าเชื่อถือของโพสต์ เต็ม 20
  // - Recency: ความใหม่ของโพสต์ เต็ม 20
  // แล้วรวมกับ RelevanceScore ที่ถูก scale เป็นคะแนนเต็ม 60
  const popularity = popularityScore({
    favCount: row.fav_count,
    reviewCount: row.review_count,
    joinCount: row.join_count,
    rating: row.avg_rating,
  }, 'tutor');
  const recency = recencyScore(row.created_at);

  return {
    ...relevance,
    popularity_score: popularity,
    recency_score: recency,
    recommendation_score: capRecommendationScore(relevance.relevance_score, popularity, recency),
  };
}

// ตรวจว่าโพสต์มีองค์ประกอบหลักครบทั้ง Subject, CanTeach และ Level หรือไม่
// ใช้กับโพสต์หมดอายุ เพื่อให้โพสต์หมดอายุที่นำมาแสดงยังเกี่ยวข้องกับผู้ใช้จริง
function matchesTutorRecommendationConditions(row) {
  return (
    Number(row.subject_match || 0) > 0 &&
    Number(row.can_teach_match || 0) > 0 &&
    Number(row.level_match || 0) > 0
  );
}

// ตรวจว่าโพสต์ตรงกับวิชาที่นักเรียนระบุในช่อง "วิชาที่สนใจ" หรือไม่
// ใช้เป็นตัวกรองหลักเพื่อกันคำจากพฤติกรรมมาดันโพสต์คนละวิชา
function matchesPrimaryInterests(row, primaryInterestTerms = []) {
  if (!Array.isArray(primaryInterestTerms) || primaryInterestTerms.length === 0) return true;

  const semanticMatch = semanticSimilarityToPercent(row.semantic_core_similarity);
  return semanticMatch !== null && semanticMatch > 0;
}

// ---------------------------------------------------------------------------
// 5) Grade/subject hard matching
// กลุ่มนี้เป็นตัวกรองแบบ strict ที่เพิ่มเข้ามาเพื่อกันโพสต์คนละวิชา/คนละระดับชั้น
// เช่น นักเรียน ม.ต้น ไม่ควรได้โพสต์ ม.ปลาย หรือ art ไม่ควร match กับคำว่า Parts
// ---------------------------------------------------------------------------

// สร้างชุดคำระดับชั้น เช่น "มัธยมต้น" จะขยายเป็น ม.1, ม.2, ม.3, middle school
// ทำให้การเทียบระดับชั้นไม่พลาดเพราะใช้คำเรียกคนละแบบ
function getGradeTermSet(text) {
  const terms = getTokenSet(text);
  const normalized = normalizeText(text);
  if (!normalized) return terms;

  Object.entries(GRADE_GROUPS).forEach(([grade, aliases]) => {
    const gradeTerms = [grade, ...(aliases || [])];
    const matched = gradeTerms.some((term) => {
      const normalizedTerm = normalizeText(term);
      return normalizedTerm && normalized.includes(normalizedTerm);
    });

    if (matched) {
      gradeTerms.forEach((term) => {
        const normalizedTerm = normalizeText(term);
        if (normalizedTerm) terms.add(normalizedTerm);
      });
    }
  });

  return terms;
}

// ตรวจว่าระดับชั้นสองฝั่งอยู่กลุ่มเดียวกันหรือไม่
// เช่น "มัธยมต้น" match กับ "ม.1-ม.3" แต่ไม่ match กับ "มัธยมปลาย"
function hasGradeLevelOverlap(leftText, rightText) {
  const leftTerms = getGradeTermSet(leftText);
  const rightTerms = getGradeTermSet(rightText);
  if (!leftTerms.size || !rightTerms.size) return false;

  return Array.from(leftTerms).some((term) => rightTerms.has(term));
}

// คำนวณความเหมาะสมของโพสต์นักเรียนสำหรับติวเตอร์
// ใช้ฝั่ง "นักเรียนที่อาจเหมาะกับคุณ" โดยบังคับให้วิชาและระดับชั้นตรงกับ Bio ของติวเตอร์
function buildTutorStudentFitBreakdown(row, tutorSignals) {
  const canTeachSubjects = tutorSignals?.canTeachSubjects || '';
  const canTeachGrades = tutorSignals?.canTeachGrades || '';
  // ฝั่งติวเตอร์ดูโพสต์นักเรียน: วิชาในโพสต์นักเรียนต้องตรงกับวิชาที่ติวเตอร์สอนได้จริง
  const semanticSubjectMatch = semanticSimilarityToPercent(row.semantic_subject_similarity);
  const subjectMatch = semanticSubjectMatch ?? 0;

  // ระดับชั้นของโพสต์นักเรียนต้องอยู่ในช่วงที่ติวเตอร์รับสอน
  const levelMatch = canTeachGrades
    ? (hasGradeLevelOverlap(row.grade_level, canTeachGrades) ? 100 : 0)
    : 100;

  const fitPercent = (subjectMatch * 0.8) + (levelMatch * 0.2);

  return {
    tutor_subject_match: subjectMatch,
    tutor_level_match: levelMatch,
    tutor_fit_percent: fitPercent,
    passes_tutor_fit: subjectMatch >= 55 && levelMatch > 0,
  };
}

// comparator สำหรับเรียงโพสต์ติวเตอร์ที่ผ่าน relevance แล้ว
// เรียงจาก interest rank, relevance percent, relevance score, recommendation score และวันที่ล่าสุด
function compareTutorRecommendationRows(a, b) {
  return (
    Number(a.interest_rank ?? 999) - Number(b.interest_rank ?? 999) ||
    Number(b.relevance_percent || 0) - Number(a.relevance_percent || 0) ||
    Number(b.relevance_score || 0) - Number(a.relevance_score || 0) ||
    Number(b.recommendation_score || 0) - Number(a.recommendation_score || 0) ||
    new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
}

// สร้าง Set ของ token ที่ปรากฏจริงจากข้อความเดียว
function getTokenSet(text) {
  return new Set(
    tokenize(text)
      .map((term) => normalizeText(term))
      .filter(Boolean)
  );
}

// ลบ keyword บางกลุ่มออกจาก signal map ชั่วคราว
// ใช้กันการนับซ้ำ เช่น subject match แล้ว ไม่อยากให้ description ได้คะแนนจาก subject เดิมอีก
function withoutExcludedTerms(signalMap, excludedTerms) {
  if (!excludedTerms?.size) return signalMap;
  const filtered = new Map();
  signalMap.forEach((weight, term) => {
    if (!excludedTerms.has(normalizeText(term))) filtered.set(term, weight);
  });
  return filtered;
}

// คิดคะแนน field หนึ่ง field เทียบกับ signal map
// fieldCap คือคะแนนสูงสุดของ field นั้น และ rawMax ใช้ normalize คะแนนดิบ
function scoreFieldAgainstSignals(text, signalMap, fieldCap, options = {}) {
  if (!fieldCap) return 0;
  const scopedSignals = withoutExcludedTerms(signalMap, options.excludeTerms);
  const rawScore = scoreTextAgainstSignals(text, scopedSignals, 1);
  return scaleToWeightedCap(rawScore, options.rawMax || 700, fieldCap);
}

// ---------------------------------------------------------------------------
// 6) Generic text scoring / recency / popularity
// กลุ่มนี้คิดคะแนนพื้นฐานที่ใช้ซ้ำหลาย endpoint
// ---------------------------------------------------------------------------

// คืน relevance score ของโพสต์ติวเตอร์แบบ raw helper
// ใช้เป็น wrapper สำหรับ flow ที่ต้องการคะแนน relevance ของ tutor post โดยตรง
function buildTutorRelevanceRawScore(row, signals) {
  return buildTutorRelevanceBreakdown(row, signals).relevance_score;
}

// คิดคะแนน relevance ของโพสต์นักเรียนสำหรับฝั่งติวเตอร์
// ยังเป็นคะแนนแบบ field-weighted เพราะฝั่งโพสต์นักเรียนมี description/major/faculty เป็นตัวช่วย
function buildStudentRelevanceRawScore(row, signals) {
  const semanticMatch = semanticSimilarityToPercent(row.semantic_profile_similarity);
  if (semanticMatch === null) return 0;

  const semanticCap =
    STUDENT_RELEVANCE_FIELD_POINTS.subject +
    STUDENT_RELEVANCE_FIELD_POINTS.description +
    STUDENT_RELEVANCE_FIELD_POINTS.major +
    STUDENT_RELEVANCE_FIELD_POINTS.faculty;
  const semanticScore = scaleToWeightedCap(semanticMatch, 100, semanticCap);
  const levelScore = scoreFieldAgainstSignals(
    row.grade_level,
    signals,
    STUDENT_RELEVANCE_FIELD_POINTS.gradeLevel,
    { rawMax: 1200 }
  );
  return semanticScore + levelScore;
}

//ดูข้อความในโพสต์ว่าตรงกับคำสำคัญของผู้ใช้งานมากแค่ไหน
// ให้คะแนนข้อความจาก signal map
// ถ้าตรง keyword แบบ exact จะได้คะแนนมากกว่าแค่ contains
// เป็นฐานของการคิดคะแนนแบบ fuzzy ใน flow ที่ยังต้องใช้ความยืดหยุ่น
function scoreTextAgainstSignals(text, signalMap, multiplier = 1) {
  const haystack = normalizeText(text);
  if (!haystack || !signalMap?.size || !multiplier) return 0;

  const fieldTerms = new Set(
    tokenize(text)
      .map((term) => normalizeText(term))
      .filter(Boolean)
  );

  let score = 0;
  signalMap.forEach((weight, term) => {
    const normalizedTerm = normalizeText(term);
    const numericWeight = Number(weight || 0);
    if (!normalizedTerm || numericWeight <= 0) return;

    if (fieldTerms.has(normalizedTerm)) {
      score += numericWeight * 7 * multiplier;
    } else if (haystack.includes(normalizedTerm)) {
      score += numericWeight * 3 * multiplier;
    }
  });

  return Number(score.toFixed(2));
}

//คำนวณว่าโพสต์นั้นเก่าหรือใหม่แค่ไหน
// คำนวณจำนวนวันที่ผ่านไปจากวันที่ที่ส่งมา
// ใช้ทั้ง recency score และ fallback กรณีโพสต์ไม่มี session date
function daysSince(dateValue) {
  const value = new Date(dateValue);
  if (Number.isNaN(value.getTime())) return 365;
  return Math.max(0, (Date.now() - value.getTime()) / (1000 * 60 * 60 * 24));
}

// ให้คะแนนความใหม่ของโพสต์ (Recency Score)
//
// Recency เป็นคะแนนเสริมเต็ม 20 คะแนนจากคะแนนรวม 100
// ใช้หลังจากโพสต์ผ่าน Relevance แล้วเท่านั้น
//
// เหตุผลของเกณฑ์นี้:
// เว็บหาติวเตอร์ไม่เหมือนข่าวหรือ social media ที่โพสต์เก่าเร็วมาก
// ติวเตอร์อาจยังเปิดรับสอนอยู่หลายสัปดาห์ จึงกำหนดให้โพสต์ภายใน 14 วันยังใหม่เต็มคะแนน
// หลังจากนั้นลดคะแนนลงแบบค่อยเป็นค่อยไป เพื่อให้โพสต์ใหม่ได้เปรียบ
// แต่ไม่ตัดโพสต์ที่ยังเกี่ยวข้องออกเร็วเกินไป
//
// เกณฑ์คะแนนจริง:
// - อายุโพสต์ <= 14 วัน  = 20 คะแนน
// - อายุโพสต์ <= 30 วัน  = 15 คะแนน
// - อายุโพสต์ <= 60 วัน  = 10 คะแนน
// - อายุโพสต์ <= 90 วัน  = 5 คะแนน
// - อายุโพสต์ > 90 วัน   = 0 คะแนน
function recencyScore(dateValue) {
  const ageDays = daysSince(dateValue);
  let rawScore = 0;

  // rawScore เป็นคะแนนดิบเต็ม 100 แล้วค่อยแปลงลงมาเป็นคะแนนเต็ม 20 ด้วย scaleToWeightedCap()
  // เช่น rawScore 75 -> 75% ของ 20 = 15 คะแนน
  if (ageDays <= 14) rawScore = 100; // 20 คะแนน
  else if (ageDays <= 30) rawScore = 75; // 15 คะแนน
  else if (ageDays <= 60) rawScore = 50; // 10 คะแนน
  else if (ageDays <= 90) rawScore = 25; // 5 คะแนน
  return scaleToWeightedCap(rawScore, 100, RECOMMENDATION_SCORE_CAPS.recency);
}

// ให้คะแนนความนิยมของโพสต์ (Popularity Score)
//
// Popularity เป็นคะแนนเสริมเต็ม 20 คะแนนจากคะแนนรวม 100
// ใช้สะท้อนว่าโพสต์/ติวเตอร์มี engagement หรือความน่าเชื่อถือมากน้อยแค่ไหน
// แต่จะถูกคิดหลังจากผ่าน Relevance แล้ว เพื่อไม่ให้โพสต์ที่ดังแต่ไม่ตรงความต้องการถูกแนะนำ
//
// type='tutor':
// - Favorites 30%: ผู้ใช้กดบันทึก/สนใจโพสต์
// - Joins 30%: มีคนเข้าร่วมหรือตอบรับโพสต์
// - Rating 40%: คะแนนรีวิวของติวเตอร์ สำคัญที่สุดใน popularity เพราะสะท้อนคุณภาพ/ความน่าเชื่อถือ
//
// type='student':
// - Favorites 45% และ Joins 55%
// - ไม่มี rating เพราะเป็นโพสต์ของนักเรียน ไม่ใช่โปรไฟล์ติวเตอร์
//
// หมายเหตุ:
// ใช้ Math.min() จำกัดเพดานจำนวน favorites/joins เพื่อไม่ให้โพสต์ที่ยอดสูงมากเพียงโพสต์เดียว
// ได้เปรียบจนกลบโพสต์อื่นมากเกินไป
function popularityScore(
  { favCount = 0, reviewCount = 0, joinCount = 0, rating = 0 },
  type = 'tutor'
) {
  let rawScore = 0;
  let rawMax = 100;

  if (type === 'student') {
    // Popularity ของโพสต์นักเรียนใช้ Favorites และ Joins
    // favCount ถูก cap ที่ 20 ครั้ง และ joinCount ถูก cap ที่ 30 ครั้ง
    // ถ้าเกินกว่านี้จะถือว่าได้คะแนนส่วนนี้เต็มแล้ว เพื่อกันคะแนนพุ่งเกินสมดุล
    rawScore =
      (Math.min(Number(favCount || 0), 20) / 20) * STUDENT_POPULARITY_FIELD_POINTS.favorites +
      (Math.min(Number(joinCount || 0), 30) / 30) * STUDENT_POPULARITY_FIELD_POINTS.joins;
    rawMax = sumConfigPoints(STUDENT_POPULARITY_FIELD_POINTS);
  } else {
    // ตัวแปรย่อย Popularity ของติวเตอร์: Favorites, Joins, Rating
    // ตัวอย่าง:
    // favCount 10 จาก cap 20 = ได้ 50% ของคะแนน Favorites
    // joinCount 15 จาก cap 30 = ได้ 50% ของคะแนน Joins
    // rating 4.5 จาก 5 = ได้ 90% ของคะแนน Rating
    rawScore =
      (Math.min(Number(favCount || 0), 20) / 20) * TUTOR_POPULARITY_FIELD_POINTS.favorites +
      (Math.min(Number(joinCount || 0), 30) / 30) * TUTOR_POPULARITY_FIELD_POINTS.joins +
      (Math.min(Number(rating || 0), 5) / 5) * TUTOR_POPULARITY_FIELD_POINTS.rating;
    rawMax = sumConfigPoints(TUTOR_POPULARITY_FIELD_POINTS);
  }

  return scaleToWeightedCap(rawScore, rawMax, RECOMMENDATION_SCORE_CAPS.popularity);
}

//เช็คว่าโพสต์เลยเวลาเรียนมาแล้วหรือยัง
// ตรวจว่าโพสต์หมดอายุหรือยัง
// ถ้ามีวัน/เวลาเรียน จะดูจาก session ทั้งหมด
// ถ้าไม่มีวัน/เวลาเรียน จะ fallback เป็นโพสต์เกิน 45 วันถือว่าหมดอายุ
function calculateIsExpired(post) {
  const createdAt = post.created_at || post.createdAt;
  const sessions = getPostSessionTimes(post);

  if (sessions.length) return !sessions.some((session) => session.getTime() >= Date.now());

  return daysSince(createdAt) > 45;
}

// ใช้ชื่อวิชาที่ normalize แล้วเป็น key สำหรับกระจายรายการไม่ให้หัวข้อเดิมซ้ำมากเกินไป
function getCanonicalSubject(subject) {
  return normalizeText(subject);
}

// ---------------------------------------------------------------------------
// 7) Diversify / cold start
// ใช้จัดรายการให้ไม่ซ้ำติวเตอร์หรือวิชาเดิมมากเกินไป
// และใช้ fallback สำหรับผู้ใช้ใหม่ที่ยังไม่มีข้อมูลพอ
// ---------------------------------------------------------------------------

// ไม่ให้ขึ้นติวเตอร์ซ้ำหรือวิชาเดิมซ้ำมากเกินไป
// เลือกจากลำดับคะแนนที่เรียงแล้ว แต่จำกัดจำนวนโพสต์ต่อ tutor และต่อ subject
function diversifyTutorRows(rows, limit) {
  const selected = [];
  const tutorCounts = new Map();
  const subjectCounts = new Map();

  const sorted = [...rows].sort(compareTutorRecommendationRows);
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
// รวมรายการหลักกับรายการเสริมสำหรับปุ่ม "ดูเพิ่มเติม"
// primaryRows คือรายการที่ดีที่สุด ส่วน fallbackRows คือรายการรอง/หมดอายุที่ยังเกี่ยวข้อง
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

// จัดอันดับโพสต์สำหรับผู้ใช้ใหม่ที่ไม่มีข้อมูลความสนใจพอ
// ใช้โพสต์ใหม่ + โพสต์นิยม และ diversify เพื่อให้หน้าแรกยังมีข้อมูลแสดง
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

// อ่าน role ของ user จากตาราง register
// ใช้ตัดสินว่าจะสร้าง signals แบบนักเรียนหรือแบบติวเตอร์
async function getUserRole(pool, userId) { //รับค่า Role ของผู้ใช้งานเพื่อเอาไปใช้ใน fn getUserSignals
  const [[row]] = await pool.query('SELECT type FROM register WHERE user_id = ? LIMIT 1', [userId]);
  return String(row?.type || '').toLowerCase();
}

// ---------------------------------------------------------------------------
// 8) User signal builders
// กลุ่มนี้สร้าง profile ของความสนใจผู้ใช้จาก Bio, โพสต์, search history และ interaction
// ผลลัพธ์คือ Map ของ keyword -> weight ซึ่งจะถูกนำไปใช้คิด relevance
// ---------------------------------------------------------------------------

// สร้าง signals ของนักเรียน
// แหล่งข้อมูล: Bio/Profile, วิชาที่สนใจ, ระดับชั้น, โพสต์เก่า, search history, interactions
// ผลลัพธ์ถูกใช้แนะนำโพสต์ติวเตอร์ให้นักเรียน
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
  const primaryInterestTerms = buildPrimaryInterestTerms(profile?.interested_subjects);

  if (profile?.grade_level) { //โค้ดที่เช็คว่ามีข้อมูลระดับชั้นหรือไม่ ถ้ามีจะเพิ่มคะแนนความสนใจด้วย
    addSignal(signals, profile.grade_level, STUDENT_PROFILE_SIGNAL_WEIGHTS.gradeLevel);
      (GRADE_GROUPS[profile.grade_level] || []).forEach((gradeAlias) => addSignal(signals, gradeAlias, STUDENT_PROFILE_SIGNAL_WEIGHTS.gradeGroup));
    reasons.push(`ระดับชั้น ${profile.grade_level}`);
  }
  addSignal(signals, profile?.institution, STUDENT_PROFILE_SIGNAL_WEIGHTS.institution); // ตัดสถานศึกษาออกจากการคิดคะแนน
  addSignal(signals, profile?.faculty, STUDENT_PROFILE_SIGNAL_WEIGHTS.faculty); // คณะ
  addSignal(signals, profile?.major, STUDENT_PROFILE_SIGNAL_WEIGHTS.major); // สาขา
  addSignal(signals, profile?.interested_subjects, STUDENT_PROFILE_SIGNAL_WEIGHTS.interestedSubjects); // วิชาที่สนใจ
  addSignal(signals, profile?.about, STUDENT_PROFILE_SIGNAL_WEIGHTS.about); // about ใช้เสริมบริบท

  // โพสต์เก่า ๆ จะมีผลน้อยกว่าโพสต์ใหม่ แต่ก็ยังมีผลอยู่บ้าง เพราะแสดงถึงความสนใจในอดีต
  // ดึงโพสต์ที่นักเรียนเคยสร้าง เพื่อดูว่าเคยสนใจวิชาอะไร
  const [myPosts] = await pool.query(
    `SELECT subject, description, grade_level
     FROM student_posts
     WHERE student_id = ?
     ORDER BY created_at DESC
     LIMIT 15`,
    [userId]
  );
  // โพสต์เก่า ๆ จะมีผลน้อยกว่าโพสต์ใหม่ แต่ก็ยังมีผลอยู่บ้าง เพราะแสดงถึงความสนใจในอดีต
  myPosts.forEach((post) => {
    addSignal(signals, post.subject, STUDENT_POST_HISTORY_SIGNAL_WEIGHTS.subject); // วิชาที่เคยโพสต์หาเรียน
    addSignal(signals, post.description, STUDENT_POST_HISTORY_SIGNAL_WEIGHTS.description); // รายละเอียดโพสต์เก่า
    addSignal(signals, post.grade_level, STUDENT_POST_HISTORY_SIGNAL_WEIGHTS.gradeLevel); // ระดับชั้นที่เคยหาเรียน
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
    addSignal(signals, row.keyword, 1.2 * positionWeight * recencyWeight); // ใช้เป็นสัญญาณเสริม ไม่ให้กลบโปรไฟล์หลัก
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
      ? INTERACTION_SIGNAL_WEIGHTS.favorite
      : row.action_type === 'open_post'
        ? INTERACTION_SIGNAL_WEIGHTS.openPost
        : row.action_type === 'open_recommendation'
          ? INTERACTION_SIGNAL_WEIGHTS.openRecommendation
          : row.action_type === 'open_explore_recommendation'
            ? INTERACTION_SIGNAL_WEIGHTS.openExploreRecommendation
            : row.action_type === 'search_open_post'
              ? INTERACTION_SIGNAL_WEIGHTS.searchOpenPost
              : row.action_type === 'search_open_tutor'
                ? INTERACTION_SIGNAL_WEIGHTS.searchOpenTutor
                : INTERACTION_SIGNAL_WEIGHTS.default;
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
  favoriteSubjects.forEach((row) => addSignal(signals, row.subject, 4)); // ใช้เสริมแนววิชาที่ชอบ แต่ไม่แรงกว่าโปรไฟล์

  return {
    role: 'student', // ระบุว่าชุดข้อมูลนี้เป็นของนักเรียน
    signals, // map คำสำคัญพร้อมคะแนนรวม
    reasons, // ข้อความสรุปสั้น ๆ สำหรับอธิบาย recommendation
    hasProfileInfo, // นักเรียนมีข้อมูลโปรไฟล์กรอกไว้หรือยัง
    isColdStart: signals.size === 0, // ถ้าไม่มีคำสำคัญเลย ถือว่าเป็นผู้ใช้ใหม่
    topTerms: serializeReasonTerms(signals), // คำสำคัญอันดับต้น ๆ ที่ระบบมองว่าเด่น
    primaryInterestTerms,
    gradeLevel: profile?.grade_level || '', // ส่งระดับชั้นออกไปใช้ต่อ
    institution: profile?.institution || '', // ส่งสถานศึกษาออกไปใช้ต่อ
    faculty: profile?.faculty || '', // ส่งคณะออกไปใช้ต่อ
    major: profile?.major || '', // ส่งสาขาออกไปใช้ต่อ
    semanticProfileText: [
      profile?.interested_subjects,
      profile?.major,
      profile?.faculty,
      profile?.about,
      ...serializeReasonTerms(signals, 8),
    ].filter(Boolean).join(' | '),
    primaryInterestText: profile?.interested_subjects || '',
  };
}

// สร้าง signals ของติวเตอร์
// แหล่งข้อมูล: วิชาที่สอนได้, ระดับชั้นที่รับสอน, about_me, โพสต์เก่า, search history, interactions
// ผลลัพธ์ถูกใช้แนะนำโพสต์นักเรียนให้ติวเตอร์
async function getTutorSignals(pool, userId) {
  const signals = new Map(); // เก็บคำสำคัญของติวเตอร์พร้อมคะแนนสะสม
  // ดึงข้อมูลหลักของติวเตอร์ เช่น วิชาที่สอนได้ ระดับชั้นที่รับสอน และ about_me
  const [[profile]] = await pool.query(
    `SELECT can_teach_subjects, can_teach_grades, address, about_me
     FROM tutor_profiles
    WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  addSignal(signals, profile?.can_teach_subjects, TUTOR_PROFILE_SIGNAL_WEIGHTS.canTeachSubjects); // วิชาที่สอนได้ สำคัญที่สุดสำหรับฝั่งติวเตอร์
  addSignal(signals, profile?.can_teach_grades, TUTOR_PROFILE_SIGNAL_WEIGHTS.canTeachGrades); // ระดับชั้นที่รับสอน
  addSignal(signals, profile?.about_me, TUTOR_PROFILE_SIGNAL_WEIGHTS.aboutMe); // about_me ใช้ช่วยเสริมบริบท

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
    addSignal(signals, row.subject, TUTOR_POST_HISTORY_SIGNAL_WEIGHTS.subject); // หัวข้อวิชาของโพสต์เก่า
    addSignal(signals, row.description, TUTOR_POST_HISTORY_SIGNAL_WEIGHTS.description); // รายละเอียดโพสต์เก่า
    addSignal(signals, row.target_student_level, TUTOR_POST_HISTORY_SIGNAL_WEIGHTS.targetStudentLevel); // กลุ่มผู้เรียนที่เคยเปิดรับสอน
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
    addSignal(signals, row.keyword, 1.2 * positionWeight * recencyWeight); // เพิ่มคำค้นเป็นสัญญาณเสริม
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
    const baseWeight = row.action_type === 'favorite'
      ? INTERACTION_SIGNAL_WEIGHTS.favorite
      : row.action_type === 'open_post'
        ? INTERACTION_SIGNAL_WEIGHTS.openPost
        : INTERACTION_SIGNAL_WEIGHTS.default; // favorite หนักกว่า open_post
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
    canTeachSubjects: profile?.can_teach_subjects || '', // ส่งวิชาที่ติวเตอร์สอนได้กลับไปใช้กรองโพสต์นักเรียน
    canTeachGrades: profile?.can_teach_grades || '', // ส่งระดับชั้นที่ติวเตอร์รับสอนกลับไปใช้ต่อ
    semanticProfileText: [
      profile?.can_teach_subjects,
      profile?.about_me,
      ...serializeReasonTerms(signals, 8),
    ].filter(Boolean).join(' | '),
  };
}

//ดูว่าผู้ใช้เป็นนักเรียนหรือติวเตอร์ เพื่อไปดูข้อมูลส่วนตัวของเขา
// เลือกว่าจะใช้ getStudentSignals หรือ getTutorSignals ตาม role ของ user
// roleHint ใช้บังคับกรณี endpoint รู้อยู่แล้วว่าต้องการมุมมองนักเรียนหรือติวเตอร์
async function getUserSignals(pool, userId, roleHint = '') {
  const role = roleHint || await getUserRole(pool, userId); //ถ้าไม่รู้บทบาทของผู้ใช้ ก็ไปเช็คจากฐานข้อมูล
  if (role === 'tutor' || role === 'teacher') return getTutorSignals(pool, userId); //เป็นติวเตอร์ก็ไปดูข้อมูลของติวเตอร์
  return getStudentSignals(pool, userId); //เป็นนักเรียนก็ไปดูข้อมูลของนักเรียน
}

// ---------------------------------------------------------------------------
// 9) Candidate queries
// กลุ่มนี้ดึงโพสต์จากฐานข้อมูลมาเป็น candidate ก่อนนำไปคำนวณคะแนนใน memory
// เหตุผลที่ดึงหลายรายการกว่าจำนวนที่แสดงจริง เพราะหลังกรอง relevance/level/expired แล้ว
// รายการที่เหลืออาจลดลงมาก
// ---------------------------------------------------------------------------

// ดึงโพสต์ติวเตอร์พร้อมข้อมูลประกอบจาก DB
// รวมข้อมูลโปรไฟล์ติวเตอร์, rating, favorite count, join count และสถานะ join ของ user ปัจจุบัน
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
        myj.my_join_status
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
       SELECT
         tutor_post_id,
         CASE
           WHEN MAX(CASE WHEN status = 'approved' THEN 2 WHEN status = 'pending' THEN 1 ELSE 0 END) = 2 THEN 'approved'
           WHEN MAX(CASE WHEN status = 'approved' THEN 2 WHEN status = 'pending' THEN 1 ELSE 0 END) = 1 THEN 'pending'
           ELSE NULL
         END AS my_join_status
       FROM tutor_post_joins
       WHERE user_id = ?
       GROUP BY tutor_post_id
     ) myj ON myj.tutor_post_id = tp.tutor_post_id
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

// ดึงโพสต์นักเรียนพร้อมข้อมูลประกอบจาก DB
// ใช้สำหรับฝั่งติวเตอร์ที่ต้องการหาโพสต์นักเรียนที่เหมาะกับตนเอง
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

// ตัด row ซ้ำตาม key ที่กำหนด
// เช่น tutor_post_id หรือ student_post_id เพื่อไม่ให้โพสต์เดียวกันขึ้นหลายครั้ง
function dedupeRows(rows, keyFn) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFn(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// 10) Response mappers
// กลุ่มนี้แปลง row จากฐานข้อมูลให้เป็นรูปแบบเดียวกับที่ frontend ใช้งาน
// ช่วยให้ frontend ไม่ต้องรู้ชื่อ column จริงของ database ทุกตัว
// ---------------------------------------------------------------------------

// แปลง row ของโพสต์ติวเตอร์ให้ frontend ใช้งานง่าย
// รวม field ชื่อผู้ใช้ รูป โปรไฟล์ คะแนน และสถานะหมดอายุให้อยู่ใน object เดียว
function mapTutorRow(row) {
  const lastSession = getPostLastSessionTime(row);
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
    is_expired: row.is_expired ?? calculateIsExpired(row),
    expired_at: lastSession ? lastSession.toISOString() : null,
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
    relevance_score: Number(row.relevance_score || 0),
    relevance_percent: Number(row.relevance_percent || 0),
    popularity_score: Number(row.popularity_score || 0),
    recency_score: Number(row.recency_score || 0),
    recommendation_score: Number(row.recommendation_score || 0),
    score_breakdown: row.score_breakdown || null,
  };
}

// แปลง row ของโพสต์นักเรียนให้ frontend ใช้งานง่าย
// จัด user object และ normalize field เช่น budget, join_count, createdAt
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

// ---------------------------------------------------------------------------
// 11) Recommendation endpoints
// กลุ่มนี้คือ flow หลักของระบบแนะนำ:
// - getTutorRecommendations: นักเรียนเห็นโพสต์ติวเตอร์
// - getStudentRecommendationsForTutor: ติวเตอร์เห็นโพสต์นักเรียน
// - getMixedFeedRecommendations: ฟีดรวม
// - smartSearch: ค้นหาแบบใช้ query + profile signal
// - getHomepageFeed: feed รูปแบบ matched/expired สำหรับหน้าหลัก
// ---------------------------------------------------------------------------

async function addTutorSemanticScores(rows, queryText, primaryInterestText = '') {
  const coreQuery = primaryInterestText || queryText;
  const semanticRows = await scoreTextVariants(coreQuery, rows, [
    {
      key: 'semantic_subject_similarity',
      buildText: (row) => row.subject || '',
    },
    {
      key: 'semantic_can_teach_similarity',
      buildText: (row) => [row.can_teach_subjects, row.subject].filter(Boolean).join(' | '),
    },
  ]);

  const scoredRows = await scoreTextVariants(coreQuery, semanticRows, [
    {
      key: 'semantic_core_similarity',
      buildText: (row) => [
        row.subject,
        row.can_teach_subjects,
        row.description,
      ].filter(Boolean).join(' | '),
    },
  ]);
  const available = scoredRows.some((row) => Number.isFinite(row.semantic_core_similarity));
  return scoredRows.map((row) => ({ ...row, semantic_embedding_available: available }));
}

async function addStudentSemanticScores(rows, queryText) {
  const scoredRows = await scoreTextVariants(queryText, rows, [
    {
      key: 'semantic_subject_similarity',
      buildText: (row) => row.subject || '',
    },
    {
      key: 'semantic_profile_similarity',
      buildText: (row) => [
        row.subject,
        row.description,
        row.major,
        row.faculty,
      ].filter(Boolean).join(' | '),
    },
  ]);
  const available = scoredRows.some((row) => Number.isFinite(row.semantic_profile_similarity));
  return scoredRows.map((row) => ({ ...row, semantic_embedding_available: available }));
}

// แนะนำโพสต์ติวเตอร์ให้ผู้ใช้ที่เป็นนักเรียน
// Flow:
// 1. สร้าง student signals จาก Bio/Profile
// 2. ดึง candidate โพสต์ติวเตอร์
// 3. เติม semantic similarity ให้ candidate แต่ละโพสต์
// 4. คิด Relevance จาก SubjectMatch, CanTeachMatch และ LevelMatch
// 5. ถ้า Relevance ผ่าน จึงคิด Recency และ Popularity แล้วรวมเป็นคะแนน 100
// 6. แยก active กับ expired
// 7. แสดง active ที่ผ่านเงื่อนไขก่อน แล้วตามด้วย expired ที่ยังเกี่ยวข้อง
async function getTutorRecommendations(pool, userId, options = {}) {
  const limit = Number(options.limit || 12); //เริ่มต้น 12 โพสต์
  const candidateLimit = Math.max(500, limit * 50);
  if (!userId) { //ยังไม่รู้ว่าเป็นใคร ไม่มีข้อมูลอะไรเลย ให้ใช้โพสต์ใหม่และโพสต์นิยมแทน
    const latest = await getTutorRecommendationCandidates(pool, 0, candidateLimit); //ดึงโพสต์ติวเตอร์ให้กว้างพอรวมโพสต์หมดอายุ
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
  const rawCandidates = await getTutorRecommendationCandidates(pool, userId, candidateLimit); //ดึงโพสต์ติวเตอร์ให้กว้างพอรวมโพสต์หมดอายุที่เกี่ยวข้อง
  const candidates = await addTutorSemanticScores(
    rawCandidates,
    signals.semanticProfileText || signals.topTerms.join(' | '),
    signals.primaryInterestText
  );
  if (candidates.length && !candidates[0].semantic_embedding_available) {
    const fallbackRows = buildColdStartTutorRows(candidates, limit);
    return {
      items: fallbackRows.map(mapTutorRow),
      explore_items: [],
      based_on: 'โมเดล semantic embedding ไม่พร้อม จึงแสดงโพสต์ใหม่และโพสต์ยอดนิยมชั่วคราว',
      reason_terms: [],
      recommendation_engine: 'semantic_embeddings_unavailable',
    };
  }

  // คิดคะแนนตามสูตร 100 คะแนน:
  //
  // 1) Relevance 60 คะแนน
  //    - ได้จาก embedding similarity ของ Subject และ CanTeach
  //    - ต้องมี RelevancePercent > 80 ก่อนถึงจะผ่าน
  //
  // 2) Recency 20 คะแนน
  //    - ได้จากอายุโพสต์ เช่น <=14 วัน = 20 คะแนน
  //
  // 3) Popularity 20 คะแนน
  //    - ได้จาก favorites, joins และ rating
  //
  // ถ้า Relevance ไม่ผ่าน ฟังก์ชัน buildTutorRecommendationScore()
  // จะคืน Recency/Popularity เป็น 0 เพื่อกันโพสต์ไม่ตรงเรื่องถูกดันขึ้นด้วยความใหม่หรือความนิยม
  const scoredRows = dedupeRows(candidates, (row) => row.tutor_post_id).map((row) => {
    const score = buildTutorRecommendationScore(row, signals.signals, signals);
    const lastSession = getPostLastSessionTime(row);
    const interestRank = 0;
    const matchesPrimaryInterest = matchesPrimaryInterests(row, signals.primaryInterestTerms);
    return {
      ...row,
      ...score,
      score_breakdown: {
        relevance: score.relevance_score,
        recency: score.recency_score,
        popularity: score.popularity_score,
        subject_match: score.subject_match,
        can_teach_match: score.can_teach_match,
        level_match: score.level_match,
        relevance_percent: score.relevance_percent,
        interest_rank: interestRank,
        matches_primary_interest: matchesPrimaryInterest,
      },
      interest_rank: interestRank,
      matches_primary_interest: matchesPrimaryInterest,
      is_expired: calculateIsExpired(row),
      expired_at: lastSession ? lastSession.toISOString() : null,
    };
  });
  let ranked = scoredRows;

  if (signals.isColdStart) { //เช็คว่าเป็นผู้ใช้ใหม่ที่ไม่มีข้อมูลอะไรเลยไหม ถ้าใช่ก็ให้เรียงตามความนิยมและความใหม่ของโพสต์เหมือนเดิม
    // แยก expired ออกก่อน เพราะ buildColdStartTutorRows จะ filter เฉพาะ active
    const expiredBeforeColdStart = ranked.filter((row) => row.is_expired);
    const coldStartActive = buildColdStartTutorRows(ranked, Math.max(limit * 3, 24)).map((row, index) => ({
      ...row,
      recommendation_score: Math.max(1, 100 - index), //ให้คะแนนเป็นลำดับแทน เพราะมัน personalized ไม่ได้
      is_expired: calculateIsExpired(row),
    }));
    // รวม active จาก coldStart กับ expired กลับเข้าด้วยกัน
    ranked = [...coldStartActive, ...expiredBeforeColdStart];
  } else {
    // ถ้ามีข้อมูลผู้ใช้แล้ว ตัดโพสต์ที่ relevance ไม่ผ่านออกจากรายการหลัก
    ranked = ranked.filter((row) => row.passes_relevance && row.matches_primary_interest);
  }

  //แยกโพสต์ที่ยังเรียนได้ กับโพสต์ที่หมดเวลาแล้วออกจากกัน
  const activeRanked = ranked
    .filter((row) => !row.is_expired)
    .sort(compareTutorRecommendationRows);

  // โพสต์หมดอายุ: แสดงได้ แต่ต้องเรียงจากวันเรียน/วันหมดอายุล่าสุดไปเก่าสุด
  const expiredRanked = scoredRows
    .filter((row) => (
      row.is_expired &&
      row.matches_primary_interest &&
      (signals.isColdStart || matchesTutorRecommendationConditions(row))
    ))
    .sort((a, b) => {
      const bExpiredAt = b.expired_at ? new Date(b.expired_at).getTime() : 0;
      const aExpiredAt = a.expired_at ? new Date(a.expired_at).getTime() : 0;
      return bExpiredAt - aExpiredAt;
    });

  //คัดโพสต์ให้หลากหลาย ไม่ซ้ำติวเตอร์หรือวิชาเดิมมากไป
  let primaryRows = diversifyTutorRows(activeRanked, limit); //โพสต์หลักที่เลือกมาแล้วว่ายัง active อยู่ diversifyTutorRows กันติวเตอร์ซ้ำหรือโพสต์วิชาเดิมๆ

  if (primaryRows.length === 0) {
    primaryRows = activeRanked.slice(0, limit);
  }

  // รายการหน้าหลักมี 2 กลุ่ม: active ที่ผ่าน threshold ก่อน แล้วตามด้วย expired ที่ยังอิง Subject/CanTeach/Level ของผู้ใช้
  primaryRows = [...primaryRows, ...expiredRanked.slice(0, limit)];

  const primaryIds = new Set(primaryRows.map((row) => row.tutor_post_id));
  const exploreSourceRows = signals.isColdStart ? ranked : scoredRows;
  const lowerRelevanceRows = exploreSourceRows
    .filter((row) => !row.is_expired && row.matches_primary_interest && !primaryIds.has(row.tutor_post_id))
    .sort(compareTutorRecommendationRows); // โพสต์คะแนนรองลงมา/ใกล้เคียง ใช้ในปุ่มดูติวเตอร์เพิ่มเติม
  // โพสต์หมดอายุใน explore: แสดงได้และเรียงจากหมดล่าสุดไปเก่าสุด แม้ไม่ผ่าน threshold หลัก
  const expiredForExplore = exploreSourceRows
    .filter((row) => (
      row.is_expired &&
      !primaryIds.has(row.tutor_post_id) &&
      row.matches_primary_interest &&
      (signals.isColdStart || matchesTutorRecommendationConditions(row))
    ))
    .sort((a, b) => {
      const bExpiredAt = b.expired_at ? new Date(b.expired_at).getTime() : 0;
      const aExpiredAt = a.expired_at ? new Date(a.expired_at).getTime() : 0;
      return bExpiredAt - aExpiredAt;
    });
  const exploreRows = buildExploreTutorRows(lowerRelevanceRows, expiredForExplore, Math.min(limit, 12));

  const items = primaryRows.map(mapTutorRow);
  const exploreItems = exploreRows.map((row) => ({
    ...mapTutorRow(row),
    exploration_reason: row.is_expired ? 'expired' : 'low_relevance',
  }));
  const basedOn = signals.isColdStart
    ? 'โปรไฟล์ยังไม่ครบ จึงใช้โพสต์ใหม่ล่าสุดและความนิยมของติวเตอร์'
    : `คัดโพสต์ที่ Subject, CanTeach และ Level ตรงกัน โดย Relevance ต้องมากกว่า 80: ${signals.topTerms.slice(0, 5).join(', ')}`;
  return {
    items,
    explore_items: exploreItems,
    based_on: basedOn,
    reason_terms: signals.topTerms,
    score_policy: {
      total: 100,
      relevance: 60,
      recency: 20,
      popularity: 20,
      relevance_threshold: 80,
      formula: 'Subject + CanTeach * Level',
      text_matching: 'multilingual_semantic_embeddings',
    },
  }; //แสดงสิ่งที่แนะนำมาได้ไป frontend
}

// แนะนำโพสต์นักเรียนให้ผู้ใช้ที่เป็นติวเตอร์
// ใช้วิชาที่ติวเตอร์สอนได้และระดับชั้นที่รับสอนเป็น hard filter
// แล้วจึงเรียงด้วยคะแนนความเกี่ยวข้อง/ความนิยม/ความใหม่ของโพสต์นักเรียน
async function getStudentRecommendationsForTutor(pool, userId, options = {}) {
  const limit = Number(options.limit || 30);
  let signals;
  try {
    signals = await getUserSignals(pool, userId, 'tutor'); //ดึงข้อมูลของติวเตอร์ว่าสอนอะไรได้บ้าง
  } catch (err) {
    console.warn(`getStudentRecommendationsForTutor: fallback to cold start for user ${userId}:`, err.message);
    signals = {
      role: 'tutor',
      signals: new Map(),
      isColdStart: true,
      topTerms: [],
      address: '',
      canTeachGrades: '',
    };
  }

  const rawCandidates = await getStudentRecommendationCandidates(pool, 500); //ดึงโพสต์นักเรียนให้กว้างพอหลังกรองวิชาและระดับชั้น
  const candidates = await addStudentSemanticScores(
    rawCandidates,
    signals.semanticProfileText || signals.topTerms.join(' | ')
  );
  const semanticUnavailable = candidates.length && !candidates[0].semantic_embedding_available;

  // คิดคะแนนว่าโพสต์นักเรียนไหนตรงกับติวเตอร์มากที่สุด
  let ranked = dedupeRows(candidates, (row) => row.student_post_id).map((row) => {
    const fit = buildTutorStudentFitBreakdown(row, signals);
    return {
      ...row,
      ...fit,
      recommendation_score: scoreStudentCandidate(row, signals.signals),
    };
  });

  if (signals.isColdStart || semanticUnavailable) { //isColdStart คือเป็นค่าเริ่มต้นที่ไม่มีอะไรเลย
    // ถ้ายังไม่มีข้อมูลติวเตอร์พอ ให้เรียงตามความนิยมและความใหม่ของโพสต์ เหมือนนักเรียนเลยจ้า
    ranked = ranked.sort((a, b) => (
      (popularityScore({ favCount: b.fav_count, joinCount: b.join_count }, 'student') + recencyScore(b.created_at)) -
      (popularityScore({ favCount: a.fav_count, joinCount: a.join_count }, 'student') + recencyScore(a.created_at))
    ));
  } else {
    // ถ้ามีข้อมูลแล้ว ให้เอาเฉพาะโพสต์ที่ตรงวิชาที่สอนและระดับชั้นที่รับสอนก่อน
    ranked = ranked
      .filter((row) => row.passes_tutor_fit)
      .sort((a, b) => (
        Number(b.tutor_fit_percent || 0) - Number(a.tutor_fit_percent || 0) ||
        Number(b.recommendation_score || 0) - Number(a.recommendation_score || 0) ||
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
      ));
  }

  return { //แสดงผลการแนะนำโพสต์สำหรับติวเตอร์
    items: ranked.slice(0, limit).map(mapStudentRow),
    based_on: signals.isColdStart || semanticUnavailable
      ? 'ยังไม่มีข้อมูลการสอนมากพอ จึงใช้โพสต์ใหม่และโพสต์ที่มีความเคลื่อนไหวสูง'
      : `คัดจากวิชาที่คุณสอนและพฤติกรรมล่าสุด: ${signals.topTerms.slice(0, 5).join(', ')}`,
    reason_terms: signals.topTerms,
    recommendation_engine: semanticUnavailable
      ? 'semantic_embeddings_unavailable'
      : 'multilingual_semantic_embeddings',
  };
}

// สร้าง feed รวมทั้งโพสต์ติวเตอร์และโพสต์นักเรียน
// ใช้กับหน้าที่ต้องการแสดงข้อมูลหลายชนิดในชุดเดียว โดยเรียงจาก recommendation_score
async function getMixedFeedRecommendations(pool, userId, options = {}) {
  const limit = Number(options.limit || 20);
  // ใช้ข้อมูลความสนใจของนักเรียนเป็นตัวกลางสำหรับฟีดรวม ตรงหน้ารายการที่สนใจ
  const signals = await getUserSignals(pool, userId, 'student');
  // ดึงโพสต์ติวเตอร์และโพสต์นักเรียนมาพร้อมกัน
  const [rawTutors, rawStudents] = await Promise.all([
    getTutorRecommendationCandidates(pool, userId, 90),
    getStudentRecommendationCandidates(pool, 90),
  ]);
  const semanticQuery = signals.semanticProfileText || signals.topTerms.join(' | ');
  const [tutors, students] = await Promise.all([
    addTutorSemanticScores(rawTutors, semanticQuery, signals.primaryInterestText),
    addStudentSemanticScores(rawStudents, semanticQuery),
  ]);

  // คิดคะแนนโพสต์ติวเตอร์และโพสต์นักเรียนแยกกันก่อน
  const rankedTutors = dedupeRows(tutors, (row) => `t-${row.tutor_post_id}`).map((row) => ({
    ...mapTutorRow(row),
    recommendation_score: scoreTutorCandidate(row, signals.signals),
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

// รวมโพสต์หลายโพสต์ของติวเตอร์คนเดียวให้เหลือตัวแทนที่คะแนนดีที่สุด
// ใช้ใน smartSearch ส่วนรายชื่อติวเตอร์ เพื่อไม่ให้ติวเตอร์คนเดียวซ้ำหลายใบ
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

// ค้นหาแบบ smart search
// ใช้ keyword ที่ผู้ใช้พิมพ์เป็นสัญญาณหลัก และผสม profile signals เป็นตัวช่วยแบบน้ำหนักรอง
// คืนทั้งรายชื่อติวเตอร์ โพสต์ติวเตอร์ และโพสต์นักเรียนที่เกี่ยวข้องกับคำค้น
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

  const [rawTutors, rawStudents] = await Promise.all([
    getTutorRecommendationCandidates(pool, userId, 120),
    getStudentRecommendationCandidates(pool, 120),
  ]);
  const [tutors, students] = await Promise.all([
    addTutorSemanticScores(rawTutors, query, query),
    addStudentSemanticScores(rawStudents, query),
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

// wrapper สำหรับคิดคะแนนโพสต์ติวเตอร์จาก signals
// ใช้ใน flow ค้นหา/ฟีดรวมที่ต้องการเรียกคะแนนแบบสั้น ๆ
function scoreTutorCandidate(row, signals) {
  return buildTutorRecommendationScore(row, signals).recommendation_score;
}

// คิดคะแนนโพสต์นักเรียนจาก signals ของติวเตอร์
// ถ้า relevance ต่ำ จะลดอิทธิพล popularity/recency เพื่อกันโพสต์ไม่เกี่ยวข้องถูกดันขึ้น
function scoreStudentCandidate(row, signals) {
  let relevanceScore = buildStudentRelevanceRawScore(row, signals);

  const popularity = popularityScore({
    favCount: row.fav_count,
    joinCount: row.join_count,
  }, 'student');
  const recency = recencyScore(row.created_at);
  let popularityFactor = 1;
  let recencyFactor = 1;

  if (signals.size > 0 && relevanceScore === 0) {
    popularityFactor = 0.2;
    recencyFactor = 0.25;
  } else if (signals.size > 0 && relevanceScore < 8) {
    relevanceScore = Math.max(0, relevanceScore - 3);
    popularityFactor = 0.55;
    recencyFactor = 0.7;
  }

  return capRecommendationScore(relevanceScore, popularity * popularityFactor, recency * recencyFactor);
}

// ฟังก์ชันสำหรับหน้าหลัก (Homepage Feed)
// แสดง 2 ส่วน:
// 1. matched_posts: โพสต์ที่ตรงเงื่อนไขทุกอย่าง (Subject, CanTeach, Level) และ relevance ผ่านเกณฑ์ 80%
// 2. expired_posts: โพสต์ที่หมดอายุแล้ว เรียงจากหมดอายุล่าสุดไปเก่าสุด
// ใช้สำหรับ endpoint/flow ที่ต้องการแยกผลลัพธ์ออกเป็นกลุ่ม active และ expired อย่างชัดเจน
async function getHomepageFeed(pool, userId, options = {}) {
  const limit = Number(options.limit || 20);

  // ดึง signals ของผู้ใช้ (ถ้ามี userId)
  const signals = userId
    ? await getUserSignals(pool, userId, 'student').catch(() => ({ signals: new Map(), topTerms: [], isColdStart: true }))
    : { signals: new Map(), topTerms: [], isColdStart: true };

  const rawCandidates = await getTutorRecommendationCandidates(pool, userId || 0, 200);
  const candidates = await addTutorSemanticScores(
    rawCandidates,
    signals.semanticProfileText || signals.topTerms.join(' | '),
    signals.primaryInterestText
  );
  const allRows = dedupeRows(candidates, (row) => row.tutor_post_id);

  // แยกโพสต์ active และ expired
  const activeRows = allRows.filter((row) => !calculateIsExpired(row));
  const expiredRows = allRows.filter((row) => calculateIsExpired(row));

  // ส่วนที่ 1: โพสต์ที่ตรงเงื่อนไขทุกอย่าง
  // - ต้องตรงทั้ง Subject, CanTeach และ TargetLevel
  // - relevance percent ต้องมากกว่า 80 จึงนำ Relevance/Recency/Popularity ไปคิดรวม
  const matchedPosts = activeRows
    .map((row) => {
      const score = buildTutorRecommendationScore(row, signals.signals, signals);
      return {
        ...row,
        ...score,
        is_expired: false,
      };
    })
    .filter((row) => row.passes_relevance)
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, limit)
    .map(mapTutorRow);

  // ส่วนที่ 2: โพสต์ที่หมดอายุแล้ว เรียงจากหมดอายุล่าสุดไปเก่าสุด
  // (ใช้ created_at เป็น proxy เพราะโพสต์ที่สร้างล่าสุดและหมดอายุ = หมดอายุล่าสุด)
  const expiredSorted = expiredRows
    .map((row) => {
      const score = buildTutorRecommendationScore(row, signals.signals, signals);
      const lastSession = getPostLastSessionTime(row);
      return {
        ...row,
        ...score,
        is_expired: true,
        expired_at: lastSession ? lastSession.toISOString() : null,
      };
    })
    .sort((a, b) => {
      const bExpiredAt = b.expired_at ? new Date(b.expired_at).getTime() : 0;
      const aExpiredAt = a.expired_at ? new Date(a.expired_at).getTime() : 0;
      return bExpiredAt - aExpiredAt;
    })
    .slice(0, limit)
    .map(mapTutorRow);

  return {
    matched_posts: matchedPosts,         // โพสต์ที่ตรงเงื่อนไขทุกอย่าง
    expired_posts: expiredSorted,         // โพสต์หมดอายุ เรียงจากล่าสุดไปเก่าสุด
    relevance_threshold_used: 80,
    score_policy: {
      total: 100,
      relevance: 60,
      recency: 20,
      popularity: 20,
      formula: 'Subject + CanTeach * Level',
      text_matching: 'multilingual_semantic_embeddings',
    },
    based_on: signals.isColdStart
      ? 'โพสต์ที่ตรงเงื่อนไขและโพสต์หมดอายุล่าสุด'
      : `ตรงกับความสนใจ: ${signals.topTerms.slice(0, 5).join(', ')}`,
  };
}

module.exports = {
  normalizeText,
  tokenize,
  getUserSignals,
  getTutorRecommendations,
  getStudentRecommendationsForTutor,
  getMixedFeedRecommendations,
  smartSearch,
  getHomepageFeed,
};
