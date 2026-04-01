const SUBJECT_SYNONYMS = {
  physics: ['ฟิสิกส์', 'physics', 'phy', 'physic', 'กลศาสตร์', 'อะตอม', 'atom', 'ไฟฟ้า', 'กล', 'quantum'],
  chemistry: ['เคมี', 'chemistry', 'chem', 'อินทรีย์', 'organic', 'stoichiometry'],
  biology: ['ชีวะ', 'ชีววิทยา', 'biology', 'bio', 'genetics', 'anatomy'],
  science: ['วิทย์', 'วิทยาศาสตร์', 'science', 'sci', 'stem'],
  math: ['คณิต', 'คณิตศาสตร์', 'math', 'mathematics', 'algebra', 'calculus', 'เลข', 'สถิติ', 'stat'],
  english: ['อังกฤษ', 'ภาษาอังกฤษ', 'english', 'eng', 'toeic', 'ielts', 'toefl', 'grammar', 'speaking', 'presentation'],
  chinese: ['จีน', 'ภาษาจีน', 'chinese', 'mandarin', 'hsk', 'pinyin'],
  japanese: ['ญี่ปุ่น', 'ภาษาญี่ปุ่น', 'japanese', 'jlpt', 'n1', 'n2', 'n3', 'n4', 'n5'],
  thai: ['ไทย', 'ภาษาไทย', 'thai'],
  programming: ['เขียนโปรแกรม', 'programming', 'program', 'coding', 'code', 'developer', 'dev', 'software', 'algorithm'],
  web: ['เว็บ', 'web', 'website', 'html', 'css', 'javascript', 'react', 'node', 'frontend', 'backend', 'fullstack', 'php'],
  java: ['java', 'oop', 'object oriented'],
  python: ['python', 'py', 'data science', 'machine learning', 'ml', 'ai'],
  electronics: ['microcontroller', 'arduino', 'esp32', 'วงจร', 'อิเล็กทรอนิกส์', 'embedded'],
  business: ['บัญชี', 'accounting', 'finance', 'economics', 'เศรษฐศาสตร์', 'ธุรกิจ', 'business'],
  design: ['ออกแบบ', 'design', 'ui', 'ux', 'figma', 'illustrator', 'photoshop', 'graphic'],
  music: ['ดนตรี', 'music', 'guitar', 'piano', 'vocal', 'ร้องเพลง'],
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
};

const ALIAS_TO_CANONICAL = Object.entries(SUBJECT_SYNONYMS).reduce((acc, [canonical, aliases]) => {
  acc[canonical] = canonical;
  aliases.forEach((alias) => {
    acc[String(alias).toLowerCase()] = canonical;
  });
  return acc;
}, {});

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s./#+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

  return Array.from(tokens);
}

function expandTerms(text) {
  const tokens = tokenize(text);
  const expanded = new Set(tokens);

  tokens.forEach((token) => {
    const canonical = ALIAS_TO_CANONICAL[token];
    if (canonical) {
      expanded.add(canonical);
      SUBJECT_SYNONYMS[canonical].forEach((alias) => expanded.add(String(alias).toLowerCase()));
    }

    Object.entries(SUBJECT_SYNONYMS).forEach(([key, aliases]) => {
      if (token.includes(key) || aliases.some((alias) => token.includes(String(alias).toLowerCase()))) {
        expanded.add(key);
        aliases.forEach((alias) => expanded.add(String(alias).toLowerCase()));
      }
    });
  });

  return Array.from(expanded);
}

function addSignal(map, rawText, weight) {
  if (!rawText || !weight) return;
  expandTerms(rawText).forEach((term) => {
    if (!term || STOPWORDS.has(term) || term.length < 2) return;
    map.set(term, (map.get(term) || 0) + weight);
  });
}

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

function daysSince(dateValue) {
  const value = new Date(dateValue);
  if (Number.isNaN(value.getTime())) return 365;
  return Math.max(0, (Date.now() - value.getTime()) / (1000 * 60 * 60 * 24));
}

function recencyScore(dateValue) {
  const ageDays = daysSince(dateValue);
  if (ageDays <= 1) return 35;
  if (ageDays <= 3) return 25;
  if (ageDays <= 7) return 18;
  if (ageDays <= 14) return 10;
  if (ageDays <= 30) return 4;
  return 0;
}

function popularityScore({ favCount = 0, reviewCount = 0, joinCount = 0, studentCount = 0, rating = 0 }) {
  return (
    Math.min(Number(favCount || 0), 20) * 1.8 +
    Math.min(Number(reviewCount || 0), 20) * 2.2 +
    Math.min(Number(joinCount || 0), 30) * 1.6 +
    Math.min(Number(studentCount || 0), 60) * 1.2 +
    Number(rating || 0) * 6
  );
}

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

function getCanonicalSubject(subject) {
  const terms = expandTerms(subject);
  return terms.find((term) => SUBJECT_SYNONYMS[term]) || normalizeText(subject);
}

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

    if (tutorCount >= 2 || subjectCount >= 2) continue;

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

function buildColdStartTutorRows(rows, limit) {
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

async function getUserRole(pool, userId) {
  const [[row]] = await pool.query('SELECT type FROM register WHERE user_id = ? LIMIT 1', [userId]);
  return String(row?.type || '').toLowerCase();
}

async function getStudentSignals(pool, userId) {
  const signals = new Map();
  const reasons = [];

  const [[profile]] = await pool.query(
    `SELECT grade_level, institution, faculty, major, about, interested_subjects
     FROM student_profiles
     WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  const hasProfileInfo = !!(
    profile?.grade_level || profile?.institution || profile?.faculty || profile?.major ||
    profile?.about || profile?.interested_subjects
  );

  if (profile?.grade_level) {
    addSignal(signals, profile.grade_level, 10);
    (GRADE_GROUPS[profile.grade_level] || []).forEach((gradeAlias) => addSignal(signals, gradeAlias, 7));
    reasons.push(`ระดับชั้น ${profile.grade_level}`);
  }
  addSignal(signals, profile?.institution, 8);
  addSignal(signals, profile?.faculty, 10);
  addSignal(signals, profile?.major, 10);
  addSignal(signals, profile?.interested_subjects, 16);
  addSignal(signals, profile?.about, 3);

  const [myPosts] = await pool.query(
    `SELECT subject, description, grade_level
     FROM student_posts
     WHERE student_id = ?
     ORDER BY created_at DESC
     LIMIT 15`,
    [userId]
  );
  myPosts.forEach((post) => {
    addSignal(signals, post.subject, 16);
    addSignal(signals, post.description, 4);
    addSignal(signals, post.grade_level, 6);
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
    const positionWeight = Math.max(1, 8 - Math.floor(index / 4));
    const recencyWeight = getRecencyMultiplier(row.created_at, {
      oneDayWeight: 3.2,
      threeDayWeight: 2.7,
      sevenDayWeight: 2.1,
      fourteenDayWeight: 1.4,
      twentyDayWeight: 0.9,
      defaultWeight: 0.4,
    });
    addSignal(signals, row.keyword, 8 * positionWeight * recencyWeight);
  });

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
    const positionWeight = Math.max(1, 10 - Math.floor(index / 6));
    const recencyWeight = getRecencyMultiplier(row.created_at, {
      oneDayWeight: 3.4,
      threeDayWeight: 2.6,
      sevenDayWeight: 1.9,
      fourteenDayWeight: 1.2,
      twentyDayWeight: 0.8,
      defaultWeight: 0.35,
    });
    addSignal(signals, row.subject_keyword, baseWeight * positionWeight * recencyWeight);
  });

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
  favoriteSubjects.forEach((row) => addSignal(signals, row.subject, 12));

  return {
    role: 'student',
    signals,
    reasons,
    hasProfileInfo,
    isColdStart: signals.size === 0,
    topTerms: serializeReasonTerms(signals),
    gradeLevel: profile?.grade_level || '',
    institution: profile?.institution || '',
    faculty: profile?.faculty || '',
    major: profile?.major || '',
  };
}

async function getTutorSignals(pool, userId) {
  const signals = new Map();
  const [[profile]] = await pool.query(
    `SELECT can_teach_subjects, can_teach_grades, address, about_me
     FROM tutor_profiles
     WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  addSignal(signals, profile?.can_teach_subjects, 18);
  addSignal(signals, profile?.can_teach_grades, 8);
  addSignal(signals, profile?.about_me, 3);

  const [myPosts] = await pool.query(
    `SELECT subject, description, target_student_level
     FROM tutor_posts
     WHERE tutor_id = ?
     ORDER BY created_at DESC
     LIMIT 15`,
    [userId]
  );
  myPosts.forEach((row) => {
    addSignal(signals, row.subject, 18);
    addSignal(signals, row.description, 4);
    addSignal(signals, row.target_student_level, 6);
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
    const positionWeight = Math.max(1, 8 - Math.floor(index / 4));
    const recencyWeight = getRecencyMultiplier(row.created_at, {
      oneDayWeight: 3.0,
      threeDayWeight: 2.5,
      sevenDayWeight: 1.9,
      fourteenDayWeight: 1.3,
      twentyDayWeight: 0.85,
      defaultWeight: 0.4,
    });
    addSignal(signals, row.keyword, 7 * positionWeight * recencyWeight);
  });

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
    const baseWeight = row.action_type === 'favorite' ? 14 : row.action_type === 'open_post' ? 12 : 8;
    const positionWeight = Math.max(1, 10 - Math.floor(index / 6));
    const recencyWeight = getRecencyMultiplier(row.created_at, {
      oneDayWeight: 3.2,
      threeDayWeight: 2.4,
      sevenDayWeight: 1.8,
      fourteenDayWeight: 1.2,
      twentyDayWeight: 0.8,
      defaultWeight: 0.35,
    });
    addSignal(signals, row.subject_keyword, baseWeight * positionWeight * recencyWeight);
  });

  return {
    role: 'tutor',
    signals,
    isColdStart: signals.size === 0,
    topTerms: serializeReasonTerms(signals),
    address: profile?.address || '',
    canTeachGrades: profile?.can_teach_grades || '',
  };
}

async function getUserSignals(pool, userId, roleHint = '') {
  const role = roleHint || await getUserRole(pool, userId);
  if (role === 'tutor' || role === 'teacher') return getTutorSignals(pool, userId);
  return getStudentSignals(pool, userId);
}

async function getTutorRecommendationCandidates(pool, userId = 0, limit = 300) {
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

function scoreTutorCandidate(row, signals) {
  const relevanceScore =
    scoreTextAgainstSignals(row.subject, signals, 3.2) +
    scoreTextAgainstSignals(row.can_teach_subjects, signals, 2.4) +
    scoreTextAgainstSignals(row.description, signals, 1.2) +
    scoreTextAgainstSignals(row.about_me, signals, 0.8) +
    scoreTextAgainstSignals(row.target_student_level, signals, 1.1);

  let score = relevanceScore;
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
  if (signals.size > 0 && relevanceScore === 0) score -= 36;
  else if (signals.size > 0 && relevanceScore < 18) score -= 12;

  return score;
}

function scoreStudentCandidate(row, signals) {
  const relevanceScore =
    scoreTextAgainstSignals(row.subject, signals, 3.1) +
    scoreTextAgainstSignals(row.description, signals, 1.2) +
    scoreTextAgainstSignals(row.grade_level, signals, 1.2) +
    scoreTextAgainstSignals(row.institution, signals, 0.8) +
    scoreTextAgainstSignals(row.faculty, signals, 1.0) +
    scoreTextAgainstSignals(row.major, signals, 1.0);

  let score = relevanceScore;
  score += recencyScore(row.created_at);
  score += popularityScore({
    favCount: row.fav_count,
    joinCount: row.join_count,
  });
  if (signals.size > 0 && relevanceScore === 0) score -= 28;
  else if (signals.size > 0 && relevanceScore < 16) score -= 10;
  return score;
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

async function getTutorRecommendations(pool, userId, options = {}) {
  const limit = Number(options.limit || 12);
  if (!userId) {
    const latest = await getTutorRecommendationCandidates(pool, 0, 120);
    const allRows = dedupeRows(latest, (row) => row.tutor_post_id);
    const fallbackRows = buildColdStartTutorRows(allRows, limit);
    const fallbackItems = fallbackRows.map(mapTutorRow);
    const fallbackIds = new Set(fallbackRows.map((row) => row.tutor_post_id));
    const exploreItems = buildExploreTutorRows(
      allRows.filter((row) => !calculateIsExpired(row) && !fallbackIds.has(row.tutor_post_id)),
      allRows.filter((row) => calculateIsExpired(row)),
      Math.min(limit, 12)
    ).map((row) => ({
      ...mapTutorRow(row),
      exploration_reason: calculateIsExpired(row) ? 'expired' : 'low_relevance',
    }));
    return { items: fallbackItems, explore_items: exploreItems, based_on: 'โพสต์ใหม่และโพสต์ยอดนิยมล่าสุด', reason_terms: [] };
  }

  const signals = await getUserSignals(pool, userId, 'student');
  const candidates = await getTutorRecommendationCandidates(pool, userId, 240);

  let ranked = dedupeRows(candidates, (row) => row.tutor_post_id).map((row) => ({
    ...row,
    recommendation_score: scoreTutorCandidate(row, signals.signals),
    is_expired: calculateIsExpired(row),
  }));

  if (signals.isColdStart) {
    ranked = buildColdStartTutorRows(ranked, Math.max(limit * 3, 24)).map((row, index) => ({
      ...row,
      recommendation_score: Math.max(1, 100 - index),
      is_expired: calculateIsExpired(row),
    }));
  } else {
    ranked = ranked.sort((a, b) => b.recommendation_score - a.recommendation_score);
  }

  const activeRanked = ranked.filter((row) => !row.is_expired);
  const expiredRanked = ranked.filter((row) => row.is_expired);
  const primaryRows = diversifyTutorRows(activeRanked, limit);
  const primaryIds = new Set(primaryRows.map((row) => row.tutor_post_id));
  const lowerRelevanceRows = activeRanked.filter((row) => !primaryIds.has(row.tutor_post_id));
  const exploreRows = buildExploreTutorRows(lowerRelevanceRows, expiredRanked, Math.min(limit, 12));

  const items = primaryRows.map(mapTutorRow);
  const exploreItems = exploreRows.map((row) => ({
    ...mapTutorRow(row),
    exploration_reason: row.is_expired ? 'expired' : 'low_relevance',
  }));
  const basedOn = signals.isColdStart
    ? 'โปรไฟล์ยังไม่ครบ จึงใช้โพสต์ใหม่ล่าสุดและความนิยมของติวเตอร์'
    : `วิเคราะห์จากความสนใจล่าสุด: ${signals.topTerms.slice(0, 5).join(', ')}`;

  return { items, explore_items: exploreItems, based_on: basedOn, reason_terms: signals.topTerms };
}

async function getStudentRecommendationsForTutor(pool, userId, options = {}) {
  const limit = Number(options.limit || 30);
  const signals = await getUserSignals(pool, userId, 'tutor');
  const candidates = await getStudentRecommendationCandidates(pool, 240);

  let ranked = dedupeRows(candidates, (row) => row.student_post_id).map((row) => ({
    ...row,
    recommendation_score: scoreStudentCandidate(row, signals.signals),
  }));

  if (signals.isColdStart) {
    ranked = ranked.sort((a, b) => (
      (popularityScore({ favCount: b.fav_count, joinCount: b.join_count }) + recencyScore(b.created_at)) -
      (popularityScore({ favCount: a.fav_count, joinCount: a.join_count }) + recencyScore(a.created_at))
    ));
  } else {
    ranked = ranked.sort((a, b) => b.recommendation_score - a.recommendation_score);
  }

  return {
    items: ranked.slice(0, limit).map(mapStudentRow),
    based_on: signals.isColdStart
      ? 'ยังไม่มีข้อมูลการสอนมากพอ จึงใช้โพสต์ใหม่และโพสต์ที่มีความเคลื่อนไหวสูง'
      : `คัดจากวิชาที่คุณสอนและพฤติกรรมล่าสุด: ${signals.topTerms.slice(0, 5).join(', ')}`,
    reason_terms: signals.topTerms,
  };
}

async function getMixedFeedRecommendations(pool, userId, options = {}) {
  const limit = Number(options.limit || 20);
  const signals = await getUserSignals(pool, userId, 'student');
  const [tutors, students] = await Promise.all([
    getTutorRecommendationCandidates(pool, userId, 160),
    getStudentRecommendationCandidates(pool, 160),
  ]);

  const rankedTutors = dedupeRows(tutors, (row) => `t-${row.tutor_post_id}`).map((row) => ({
    ...mapTutorRow(row),
    recommendation_score: scoreTutorCandidate(row, signals.signals) + 8,
  })).filter((row) => !row.is_expired);
  const rankedStudents = dedupeRows(students, (row) => `s-${row.student_post_id}`).map((row) => ({
    ...mapStudentRow(row),
    recommendation_score: scoreStudentCandidate(row, signals.signals),
  }));

  const merged = [...rankedTutors, ...rankedStudents]
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, limit);

  return {
    posts: merged,
    recommended_subjects: signals.topTerms,
    based_on: signals.isColdStart ? 'โพสต์ใหม่และโพสต์ยอดนิยมล่าสุด' : `ความสนใจล่าสุด: ${signals.topTerms.slice(0, 5).join(', ')}`,
  };
}

function buildTutorAggregateRows(rows) {
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

async function smartSearch(pool, query, userId = 0) {
  const signals = userId ? await getUserSignals(pool, userId).catch(() => ({ signals: new Map() })) : { signals: new Map() };
  const querySignals = new Map();
  addSignal(querySignals, query, 20);
  for (const [term, weight] of (signals.signals || new Map()).entries()) {
    querySignals.set(term, (querySignals.get(term) || 0) + Math.min(weight, 14));
  }

  const [tutors, students] = await Promise.all([
    getTutorRecommendationCandidates(pool, userId, 220),
    getStudentRecommendationCandidates(pool, 220),
  ]);

  const tutorPosts = dedupeRows(tutors, (row) => row.tutor_post_id).map((row) => ({
    ...row,
    recommendation_score: scoreTutorCandidate(row, querySignals),
  })).filter((row) => row.recommendation_score > 0 && !calculateIsExpired(row));

  const studentPosts = dedupeRows(students, (row) => row.student_post_id).map((row) => ({
    ...row,
    recommendation_score: scoreStudentCandidate(row, querySignals),
  })).filter((row) => row.recommendation_score > 0);

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
    tutors: tutorProfiles,
    posts: tutorPosts.sort((a, b) => b.recommendation_score - a.recommendation_score).slice(0, 18).map(mapTutorRow),
    students: studentPosts.sort((a, b) => b.recommendation_score - a.recommendation_score).slice(0, 18).map(mapStudentRow),
    keyword_used: query,
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
