import type { Answer, AnswerStatus } from '@repo/shared';

export interface ReviewPolicy {
  confidenceThreshold: number;
  alwaysReviewSensitive: boolean;
}

export interface ReviewDecision {
  status: Extract<AnswerStatus, 'generated' | 'reviewing'>;
  reason: string;
}

/**
 * Decide whether a generated answer should wait for human review.
 * This is intentionally small and explainable for the foundation phase.
 */
export function routeForReview(
  answer: Pick<Answer, 'confidenceScore'>,
  policy: ReviewPolicy,
  sensitive = false,
): ReviewDecision {
  if (sensitive && policy.alwaysReviewSensitive) {
    return { status: 'reviewing', reason: 'Sensitive answer requires human review.' };
  }

  if (answer.confidenceScore < policy.confidenceThreshold) {
    return { status: 'reviewing', reason: 'Confidence is below the review threshold.' };
  }

  return { status: 'generated', reason: 'Confidence meets the review threshold.' };
}
