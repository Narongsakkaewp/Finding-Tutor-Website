import { API_BASE } from '../config';

export async function logUserInteraction({
  userId,
  actionType,
  relatedId = null,
  subjectKeyword = '',
}) {
  const normalizedActionType = String(actionType || '').trim() || 'open_post';
  const normalizedSubjectKeyword = String(subjectKeyword || '').trim();
  if (!userId || !normalizedSubjectKeyword) return;

  try {
    await fetch(`${API_BASE}/api/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        action_type: normalizedActionType,
        related_id: relatedId,
        subject_keyword: normalizedSubjectKeyword,
      }),
    });
  } catch (err) {
    console.error('Interaction log failed', err);
  }
}
