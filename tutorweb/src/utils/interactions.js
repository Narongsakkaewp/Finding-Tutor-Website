import { API_BASE } from '../config';

export function notifyRecommendationRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('recommendation:refresh'));
  }
}

function normalizeRelatedId(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const text = String(value).trim();
  if (!text) return null;

  const direct = Number(text);
  if (Number.isFinite(direct)) return direct;

  const match = text.match(/(\d+)(?!.*\d)/);
  return match ? Number(match[1]) : null;
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
        related_id: normalizeRelatedId(relatedId),
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
