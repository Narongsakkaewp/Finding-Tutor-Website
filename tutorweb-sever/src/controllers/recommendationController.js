const {
  getTutorRecommendations,
  getStudentRecommendationsForTutor,
} = require('../utils/discoveryEngine');

exports.getRecommendations = async (req, res) => {
  try {
    const pool = req.db;
    const userId = Number(req.query.user_id) || 0;
    const limit = Number(req.query.limit) || 12;
    const result = await getTutorRecommendations(pool, userId, { limit });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Recommendation Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getStudentRequestsForTutor = async (req, res) => {
  try {
    const pool = req.db;
    const userId = Number(req.query.user_id) || 0;
    if (!userId) return res.json({ items: [], based_on: '', reason_terms: [] });

    const result = await getStudentRecommendationsForTutor(pool, userId, {
      limit: Number(req.query.limit) || 30,
    });
    res.json(result);
  } catch (err) {
    console.error('Tutor Recommendation Error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getRecommendedCourses = async (req, res) => {
  try {
    const pool = req.db;
    const userId = Number(req.query.user_id) || 0;
    const result = await getStudentRecommendationsForTutor(pool, userId, {
      limit: Number(req.query.limit) || 12,
    });
    res.json(result);
  } catch (err) {
    console.error('Recommended Courses Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStudyBuddyRecommendations = async (_req, res) => {
  res.json([]);
};

exports.getTrendingSubjects = async (req, res) => {
  try {
    const pool = req.db;
    const [rows] = await pool.query(`
      SELECT subject, SUM(score) AS score
      FROM (
        SELECT subject, COUNT(*) * 3 AS score
        FROM student_posts
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY subject
        UNION ALL
        SELECT subject, COUNT(*) * 4 AS score
        FROM tutor_posts
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY subject
        UNION ALL
        SELECT keyword AS subject, COUNT(*) AS score
        FROM search_history
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY keyword
      ) popularity
      WHERE subject IS NOT NULL AND TRIM(subject) <> ''
      GROUP BY subject
      ORDER BY score DESC
      LIMIT 8
    `);

    res.json(rows.map((row) => ({
      id: row.subject,
      name: row.subject,
      count: Number(row.score || 0),
      icon: 'BookOpen',
      color: 'indigo',
    })));
  } catch (err) {
    console.error('Trending Error:', err);
    res.status(500).json({ error: err.message });
  }
};