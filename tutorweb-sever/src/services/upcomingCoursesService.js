const { scoreTextVariants, semanticSimilarityToPercent } = require('../utils/semanticEmbedding');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\s./#+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDateToken(dateValue) {
  const dateText = String(dateValue || '').trim();
  if (!dateText) return null;

  const ymd = dateText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmy = dateText.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!ymd && !dmy) return null;

  const year = ymd ? Number(ymd[1]) : (Number(dmy[3]) > 2400 ? Number(dmy[3]) - 543 : Number(dmy[3]));
  const month = ymd ? Number(ymd[2]) - 1 : Number(dmy[2]) - 1;
  const day = ymd ? Number(ymd[3]) : Number(dmy[1]);

  return { year, month, day };
}

function parseTimeToken(timeValue) {
  const timeText = String(timeValue || '').trim();
  const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!timeMatch) return { hour: 23, minute: 59, second: 59 };
  return {
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] || 0),
  };
}

function parseScheduleSessions(rawDays, rawTimes) {
  const dayText = String(rawDays || '');
  const timeText = String(rawTimes || '');
  const extractedDays = dayText.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}/g);
  const extractedTimes = timeText.match(/\d{1,2}:\d{2}(?::\d{2})?/g);
  const days = (extractedDays || dayText.split(',')).map((item) => item.trim()).filter(Boolean);
  const times = (extractedTimes || timeText.split(',')).map((item) => item.trim()).filter(Boolean);

  return days.map((day, index) => {
    const dateParts = parseDateToken(day);
    if (!dateParts) return null;
    const timeParts = parseTimeToken(times[index] || times[0] || '');
    const parsed = new Date(
      dateParts.year,
      dateParts.month,
      dateParts.day,
      timeParts.hour,
      timeParts.minute,
      timeParts.second
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }).filter(Boolean);
}

function getGradeAliases(text) {
  const normalized = normalizeText(text);
  if (!normalized) return new Set();

  const groups = {
    'ประถมศึกษา': ['ประถม', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'primary'],
    'มัธยมศึกษาตอนต้น': ['มัธยมต้น', 'ม.1', 'ม.2', 'ม.3', 'middle school'],
    'มัธยมศึกษาตอนปลาย': ['มัธยมปลาย', 'ม.4', 'ม.5', 'ม.6', 'high school'],
    'ปริญญาตรี': ['มหาวิทยาลัย', 'university', 'bachelor'],
    'บุคคลทั่วไป': ['ทั่วไป', 'general'],
  };

  const set = new Set([normalized]);
  Object.entries(groups).forEach(([grade, aliases]) => {
    const allTerms = [grade, ...aliases];
    const hit = allTerms.some((term) => normalized.includes(normalizeText(term)));
    if (hit) {
      allTerms.forEach((term) => set.add(normalizeText(term)));
    }
  });

  return set;
}

function hasGradeOverlap(studentLevel, tutorLevel) {
  const left = getGradeAliases(studentLevel);
  const right = getGradeAliases(tutorLevel);
  if (!left.size || !right.size) return false;
  return Array.from(left).some((term) => right.has(term));
}

function getStartOfTomorrow() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

function formatUpcomingLabel(sessionDate) {
  if (!(sessionDate instanceof Date) || Number.isNaN(sessionDate.getTime())) return '';
  return sessionDate.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

async function fetchStudentContext(pool, userId) {
  const [[profile]] = await pool.query(
    `SELECT grade_level, institution, faculty, major, about, interested_subjects
     FROM student_profiles
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );

  const [posts] = await pool.query(
    `SELECT subject, description, grade_level, created_at
     FROM student_posts
     WHERE student_id = ?
     ORDER BY created_at DESC
     LIMIT 6`,
    [userId]
  );

  const [searches] = await pool.query(
    `SELECT keyword
     FROM search_history
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 8`,
    [userId]
  ).catch(() => [[]]);

  const [favorites] = await pool.query(
    `SELECT COALESCE(tp.subject, sp.subject) AS subject
     FROM posts_favorites pf
     LEFT JOIN tutor_posts tp ON pf.post_type = 'tutor' AND pf.post_id = tp.tutor_post_id
     LEFT JOIN student_posts sp ON pf.post_type = 'student' AND pf.post_id = sp.student_post_id
     WHERE pf.user_id = ?
     ORDER BY pf.created_at DESC
     LIMIT 8`,
    [userId]
  ).catch(() => [[]]);

  return {
    profile: profile || {},
    posts,
    searches,
    favorites,
  };
}

function buildStudentQueryText(context) {
  const profile = context.profile || {};
  return [
    profile.interested_subjects,
    profile.grade_level,
    profile.faculty,
    profile.major,
    profile.about,
    ...(context.posts || []).flatMap((row) => [row.subject, row.description, row.grade_level]),
    ...(context.searches || []).map((row) => row.keyword),
    ...(context.favorites || []).map((row) => row.subject),
  ].filter(Boolean).join(' | ');
}

async function fetchUpcomingTutorCandidates(pool, userId, limit) {
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
        tp.group_size,
        tp.price,
        tp.contact_info,
        tp.created_at,
        r.name,
        r.lastname,
        r.username,
        r.email,
        tpro.nickname,
        tpro.about_me,
        tpro.phone,
        tpro.education,
        tpro.teaching_experience,
        tpro.can_teach_subjects,
        tpro.can_teach_grades,
        tpro.profile_picture_url,
        COALESCE(rv.avg_rating, 0) AS avg_rating,
        COALESCE(rv.review_count, 0) AS review_count,
        COALESCE(jc.join_count, 0) AS join_count,
        CASE
          WHEN myj.user_id IS NOT NULL AND myj.status = 'approved' THEN 1
          WHEN myj.user_id IS NOT NULL AND myj.status = 'pending' THEN 1
          ELSE 0
        END AS joined,
        CASE
          WHEN myj.user_id IS NOT NULL AND myj.status = 'pending' THEN 1
          ELSE 0
        END AS pending_me
     FROM tutor_posts tp
     JOIN register r ON r.user_id = tp.tutor_id
     LEFT JOIN tutor_profiles tpro ON tpro.user_id = tp.tutor_id
     LEFT JOIN (
       SELECT tutor_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
       FROM reviews
       GROUP BY tutor_id
     ) rv ON rv.tutor_id = tp.tutor_id
     LEFT JOIN (
       SELECT tutor_post_id, COUNT(*) AS join_count
       FROM tutor_post_joins
       WHERE status = 'approved'
       GROUP BY tutor_post_id
     ) jc ON jc.tutor_post_id = tp.tutor_post_id
     LEFT JOIN tutor_post_joins myj
       ON myj.tutor_post_id = tp.tutor_post_id
      AND myj.user_id = ?
      AND myj.status IN ('pending', 'approved')
     WHERE COALESCE(tp.is_active, 1) = 1
     ORDER BY tp.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );

  return rows;
}

function mapTutorPost(row, nextSessionAt, relevancePercent) {
  return {
    ...row,
    id: row.tutor_post_id,
    _id: row.tutor_post_id,
    post_type: 'tutor',
    owner_id: row.tutor_id,
    tutor_id: row.tutor_id,
    subject: row.subject,
    description: row.description,
    first_name: row.name,
    last_name: row.lastname,
    name: `${row.name || ''} ${row.lastname || ''}`.trim(),
    username: row.username,
    nickname: row.nickname || '',
    phone: row.phone || '',
    email: row.email || '',
    education: row.education || [],
    teaching_experience: row.teaching_experience || [],
    image: row.profile_picture_url || '/../blank_avatar.jpg',
    profile_picture_url: row.profile_picture_url || '/../blank_avatar.jpg',
    location: row.location || '',
    price: Number(row.price || 0),
    group_size: Number(row.group_size || 0),
    join_count: Number(row.join_count || 0),
    joined: !!row.joined,
    pending_me: !!row.pending_me,
    can_teach_subjects: row.can_teach_subjects || '',
    can_teach_grades: row.can_teach_grades || '',
    about_me: row.about_me || '',
    target_student_level: row.target_student_level || '',
    teaching_days: row.teaching_days || '',
    teaching_time: row.teaching_time || '',
    is_expired: false,
    rating: Number(row.avg_rating || 0),
    reviews: Number(row.review_count || 0),
    relevance_percent: Number(relevancePercent || 0),
    next_session_at: nextSessionAt.toISOString(),
    next_session_label: formatUpcomingLabel(nextSessionAt),
    user: {
      first_name: row.name || '',
      last_name: row.lastname || '',
      username: row.username || '',
      profile_image: row.profile_picture_url || '/../blank_avatar.jpg',
    },
    meta: {
      target_student_level: row.target_student_level || '',
      teaching_days: row.teaching_days || '',
      teaching_time: row.teaching_time || '',
      location: row.location || '',
      price: Number(row.price || 0),
      contact_info: row.contact_info || '',
    },
  };
}

async function getUpcomingCourseRecommendations(pool, userId, options = {}) {
  const limit = Number(options.limit || 24);
  const candidateLimit = Math.max(80, limit * 20);
  const context = await fetchStudentContext(pool, userId);
  const queryText = buildStudentQueryText(context);
  const profileGradeLevel = context.profile?.grade_level || '';
  const tomorrow = getStartOfTomorrow();

  const rows = await fetchUpcomingTutorCandidates(pool, userId || 0, candidateLimit);

  const candidates = rows
    .map((row) => {
      const sessions = parseScheduleSessions(row.teaching_days, row.teaching_time)
        .filter((session) => session.getTime() >= tomorrow.getTime())
        .sort((a, b) => a.getTime() - b.getTime());
      const nextSessionAt = sessions[0] || null;
      const capacity = Number(row.group_size || 0);
      const joinCount = Number(row.join_count || 0);
      const isFull = capacity > 0 && joinCount >= capacity;
      return {
        ...row,
        nextSessionAt,
        isFull,
      };
    })
    .filter((row) => row.nextSessionAt && !row.isFull);

  if (!candidates.length) {
    return {
      items: [],
      based_on: 'คอร์สเรียนที่ใกล้ถึงวันเรียนและยังมีที่ว่าง',
      reason_terms: [],
    };
  }

  const semanticRows = await scoreTextVariants(queryText, candidates, [
    {
      key: 'semantic_subject_similarity',
      buildText: (row) => row.subject || '',
    },
    {
      key: 'semantic_profile_similarity',
      buildText: (row) => [row.subject, row.description, row.can_teach_subjects, row.about_me, row.target_student_level].filter(Boolean).join(' | '),
    },
  ]);

  const filtered = semanticRows
    .map((row) => {
      const subjectPercent = semanticSimilarityToPercent(row.semantic_subject_similarity) || 0;
      const profilePercent = semanticSimilarityToPercent(row.semantic_profile_similarity) || 0;
      const gradeMatch = profileGradeLevel ? hasGradeOverlap(profileGradeLevel, row.target_student_level || row.can_teach_grades || '') : false;
      const relevancePercent = Math.round((subjectPercent * 0.55) + (profilePercent * 0.45));
      const hasSemanticMatch = relevancePercent >= 28;
      const isRelevant = hasSemanticMatch || gradeMatch;

      return {
        ...row,
        gradeMatch,
        relevancePercent,
        isRelevant,
      };
    })
    .filter((row) => row.isRelevant)
    .sort((a, b) =>
      a.nextSessionAt.getTime() - b.nextSessionAt.getTime() ||
      Number(b.relevancePercent || 0) - Number(a.relevancePercent || 0) ||
      Number(a.join_count || 0) - Number(b.join_count || 0) ||
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    .slice(0, limit)
    .map((row) => mapTutorPost(row, row.nextSessionAt, row.relevancePercent));

  return {
    items: filtered,
    based_on: 'คอร์สเรียนที่กำลังจะมาถึงซึ่งตรงกับวิชาที่สนใจหรือระดับชั้นของคุณ และยังมีที่ว่าง',
    reason_terms: [
      context.profile?.interested_subjects,
      context.profile?.grade_level,
      context.profile?.major,
    ].filter(Boolean),
  };
}

module.exports = {
  getUpcomingCourseRecommendations,
};
