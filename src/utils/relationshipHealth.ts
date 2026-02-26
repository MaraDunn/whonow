import type { Contact } from "@/types/contact";

export type HealthStatus = "Healthy" | "At Risk" | "Cold";

export interface HealthResult {
  score: number;
  status: HealthStatus;
}

/**
 * Deterministic, O(1) relationship health score for a single client contact.
 *
 * Inputs used:
 *   - lastContactedAt           → days since last contact
 *   - preferredContactIntervalDays (default 30) → expected contact cadence
 *   - recentInteractionCount    → caller must supply count of interactions in last 90 days
 *   - clientWeight (default 1.0) → per-client multiplier
 *
 * Formula:
 *   intervalRatio  = daysSince / interval
 *   recencyScore   = 70 if ratio ≤ 1, linear decay to 0 between ratio 1–2, 0 above 2
 *   frequencyScore = min(recentInteractionCount, 10) * 3   (max 30)
 *   rawScore       = (recencyScore + frequencyScore) * weight
 *   finalScore     = min(round(rawScore), 100)
 *
 * Status thresholds:
 *   ≥ 70 → Healthy   |   ≥ 40 → At Risk   |   < 40 → Cold
 */
export function computeHealthScore(
  contact: Pick<Contact, "lastContactedAt" | "preferredContactIntervalDays" | "clientWeight">,
  recentInteractionCount: number,
  now: Date = new Date()
): HealthResult {
  const interval = sanitizeInterval(contact.preferredContactIntervalDays);
  const weight = sanitizeWeight(contact.clientWeight);

  // No interaction ever → instant Cold
  if (!contact.lastContactedAt) {
    return { score: 0, status: "Cold" };
  }

  let lastDate: Date;
  try {
    lastDate = new Date(contact.lastContactedAt);
    if (isNaN(lastDate.getTime())) return { score: 0, status: "Cold" };
  } catch {
    return { score: 0, status: "Cold" };
  }

  const daysSince = Math.max(0, (now.getTime() - lastDate.getTime()) / 86_400_000);
  const intervalRatio = daysSince / interval;

  // Recency score: 0–70
  let recencyScore: number;
  if (intervalRatio <= 1) {
    recencyScore = 70;
  } else if (intervalRatio <= 2) {
    recencyScore = 70 * (2 - intervalRatio);
  } else {
    recencyScore = 0;
  }

  // Frequency score: 0–30 (capped at 10 interactions × 3)
  const frequencyScore = Math.min(Math.max(0, recentInteractionCount), 10) * 3;

  const rawScore = (recencyScore + frequencyScore) * weight;
  const finalScore = Math.min(Math.round(rawScore), 100);

  return { score: finalScore, status: scoreToStatus(finalScore) };
}

export function scoreToStatus(score: number): HealthStatus {
  if (score >= 70) return "Healthy";
  if (score >= 40) return "At Risk";
  return "Cold";
}

function sanitizeInterval(value: number | undefined): number {
  if (!value || !isFinite(value) || value <= 0) return 30;
  return Math.max(1, Math.round(value));
}

function sanitizeWeight(value: number | undefined): number {
  if (!value || !isFinite(value) || value <= 0) return 1.0;
  return value;
}

/**
 * Annotate a contact with its computed health fields.
 * Only mutates clients (isClient === true). Returns the contact unchanged otherwise.
 * recentInteractionCount should be the number of interactions in the last 90 days.
 */
export function annotateContactHealth<T extends Contact>(
  contact: T,
  recentInteractionCount: number,
  now: Date = new Date()
): T {
  if (!contact.isClient) return contact;

  const { score, status } = computeHealthScore(contact, recentInteractionCount, now);
  return {
    ...contact,
    relationshipHealthScore: score,
    relationshipHealthStatus: status,
  };
}
