import type { SearchResult } from '@repo/shared';

export interface ConfidenceBreakdown {
  contextRelevance: number;  // 0-40: based on chunk similarity scores
  answerLength: number;      // 0-10: length appropriateness
  sourceCount: number;       // 0-20: citations count & quality
  specificity: number;       // 0-20: concrete numbers, acronyms, standards
  linguistic: number;        // 0-10: structure, tone, punctuation
  total: number;             // 0-100 sum
  flaggedReasons: string[];
}

export function calculateExplainableConfidence(
  answerText: string,
  chunks: SearchResult[],
  questionType: string = 'general'
): ConfidenceBreakdown {
  let contextRelevance = 0;
  let answerLength = 0;
  let sourceCount = 0;
  let specificity = 0;
  let linguistic = 0;
  const flaggedReasons: string[] = [];

  // 1. Context relevance (0-40)
  if (chunks.length > 0) {
    const avgScore = chunks.reduce((acc, c) => acc + (c.similarityScore || 0), 0) / chunks.length;
    contextRelevance = Math.min(40, Math.round(avgScore * 40));
    if (avgScore < 0.65) {
      flaggedReasons.push('Low knowledge match relevance (<65%)');
    }
  } else {
    flaggedReasons.push('No sources retrieved from knowledge base');
  }

  // 2. Answer length appropriateness (0-10)
  const words = answerText.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 20 && words <= 250) {
    answerLength = 10;
  } else if (words < 10) {
    answerLength = 2;
    flaggedReasons.push('Answer is unusually short (<10 words)');
  } else if (words > 400) {
    answerLength = 6;
  } else {
    answerLength = 7;
  }

  // 3. Source count (0-20)
  if (chunks.length >= 3) {
    sourceCount = 20;
  } else if (chunks.length === 2) {
    sourceCount = 14;
  } else if (chunks.length === 1) {
    sourceCount = 8;
  } else {
    sourceCount = 0;
  }

  // 4. Specificity & factual indicators (0-20)
  const hasStandardsOrAcronyms = /\b(SOC|ISO|HIPAA|GDPR|API|SDK|TLS|AES|OAuth|JWT|SLA|AES-256|SHA-256)\b/i.test(answerText);
  const hasNumbersOrMetrics = /\b\d+(\.\d+)?(%|ms|s|h|days?|uptime|Gbps|Mbps)?\b/.test(answerText);
  if (hasStandardsOrAcronyms && hasNumbersOrMetrics) {
    specificity = 20;
  } else if (hasStandardsOrAcronyms || hasNumbersOrMetrics) {
    specificity = 12;
  } else {
    specificity = 5;
  }

  // 5. Linguistic quality (0-10)
  const endsWell = /[.!?]$/.test(answerText.trim());
  const hasNoHedging = !/^(i\s+think|probably|maybe|as\s+an\s+ai)/i.test(answerText.trim());
  if (endsWell && hasNoHedging) {
    linguistic = 10;
  } else if (endsWell || hasNoHedging) {
    linguistic = 6;
  } else {
    linguistic = 3;
  }

  // Sensitive category check
  if (questionType === 'security' || questionType === 'legal') {
    if (contextRelevance < 30) {
      flaggedReasons.push(`High scrutiny: ${questionType} answer requires rigorous verification`);
    }
  }

  const total = Math.max(0, Math.min(100, contextRelevance + answerLength + sourceCount + specificity + linguistic));

  return {
    contextRelevance,
    answerLength,
    sourceCount,
    specificity,
    linguistic,
    total,
    flaggedReasons,
  };
}
