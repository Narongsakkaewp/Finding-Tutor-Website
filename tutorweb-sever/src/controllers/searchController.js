const { smartSearch, SUBJECT_SYNONYMS } = require('../utils/discoveryEngine');

const logSearchHistory = async (pool, userId, keyword) => {
  if (!userId || !keyword || keyword.trim().length < 2) return;

  const cleanKeyword = keyword.trim();
  try {
    const [rows] = await pool.query(
      `SELECT history_id, keyword
       FROM search_history
       WHERE user_id = ?
         AND created_at >= NOW() - INTERVAL 2 MINUTE
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (rows.length > 0) {
      const last = rows[0];
      if (
        cleanKeyword.toLowerCase() === String(last.keyword || '').toLowerCase() ||
        cleanKeyword.toLowerCase().startsWith(String(last.keyword || '').toLowerCase())
      ) {
        await pool.query(
          'UPDATE search_history SET keyword = ?, created_at = NOW() WHERE history_id = ?',
          [cleanKeyword, last.history_id]
        );
        return;
      }
    }

    await pool.query(
      'INSERT INTO search_history (user_id, keyword) VALUES (?, ?)',
      [userId, cleanKeyword]
    );
  } catch (err) {
    console.error('Log Search Error:', err);
  }
};

exports.smartSearch = async (req, res) => {
  try {
    const pool = req.db;
    const query = String(req.query.q || '').trim();
    const userId = Number(req.query.user_id) || 0;

    if (!query) {
      return res.json({ tutors: [], students: [], posts: [], reason_terms: [] });
    }

    await logSearchHistory(pool, userId, query);
    const result = await smartSearch(pool, query, userId);
    res.json(result);
  } catch (err) {
    console.error('Smart Search Error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
};

exports.getMySearchHistory = async (req, res) => {
  try {
    const pool = req.db;
    const { user_id } = req.query;
    if (!user_id) return res.json([]);

    const [rows] = await pool.query(
      `SELECT keyword
       FROM search_history
       WHERE user_id = ?
       GROUP BY keyword
       ORDER BY MAX(created_at) DESC
       LIMIT 6`,
      [user_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Fetch history failed' });
  }
};

exports.deleteSearchHistory = async (req, res) => {
  try {
    const pool = req.db;
    const { user_id, keyword } = req.query;

    if (user_id && keyword) {
      await pool.query('DELETE FROM search_history WHERE user_id = ? AND keyword = ?', [user_id, keyword]);
      return res.json({ success: true });
    }

    if (user_id) {
      await pool.query('DELETE FROM search_history WHERE user_id = ?', [user_id]);
      return res.json({ success: true });
    }

    res.status(400).json({ error: 'Missing user_id' });
  } catch (err) {
    console.error('Delete history error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};

exports.getPopularSubjects = async (req, res) => {
  try {
    const pool = req.db;
    const [rows] = await pool.query(`
      SELECT subject, SUM(score) AS score
      FROM (
        SELECT subject, COUNT(*) * 3 AS score
        FROM student_posts
        WHERE COALESCE(is_active, 1) = 1
        GROUP BY subject
        UNION ALL
        SELECT subject, COUNT(*) * 4 AS score
        FROM tutor_posts
        WHERE COALESCE(is_active, 1) = 1
        GROUP BY subject
        UNION ALL
        SELECT keyword AS subject, COUNT(*) AS score
        FROM search_history
        GROUP BY keyword
      ) popularity
      WHERE subject IS NOT NULL AND TRIM(subject) <> ''
      GROUP BY subject
      ORDER BY score DESC
      LIMIT 8
    `);

    const colorByCanonical = {
      math: 'blue',
      science: 'emerald',
      physics: 'emerald',
      chemistry: 'emerald',
      biology: 'emerald',
      english: 'rose',
      programming: 'indigo',
      web: 'indigo',
      chinese: 'amber',
      japanese: 'amber',
    };

    const iconByCanonical = {
      math: 'Calculator',
      science: 'FlaskConical',
      physics: 'FlaskConical',
      chemistry: 'FlaskConical',
      biology: 'FlaskConical',
      english: 'Languages',
      programming: 'Laptop',
      web: 'Laptop',
    };

    const result = rows.map((row) => {
      const normalized = String(row.subject || '').toLowerCase();
      const canonical = Object.entries(SUBJECT_SYNONYMS).find(([key, aliases]) => {
        return normalized.includes(key) || aliases.some((alias) => normalized.includes(String(alias).toLowerCase()));
      })?.[0];

      return {
        id: row.subject,
        name: row.subject,
        count: Number(row.score || 0),
        icon: iconByCanonical[canonical] || 'BookOpen',
        color: colorByCanonical[canonical] || 'amber',
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Popular Subjects Error:', err);
    res.status(500).json({ error: 'Failed to fetch popular subjects' });
  }
};
