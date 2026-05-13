import { API_BASE } from '../config';

export function notifyRecommendationRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('recommendation:refresh'));
  }
}

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
    const res = await fetch(`${API_BASE}/api/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        user_id: userId,
        action_type: normalizedActionType,
        related_id: relatedId,
        subject_keyword: normalizedSubjectKeyword,
      }),
    });
    if (!res.ok) {
      console.warn('Interaction log request failed:', normalizedActionType, normalizedSubjectKeyword);
      return;
    }
    notifyRecommendationRefresh();
  } catch (err) {
    console.error('Interaction log failed', err);
  }
}
