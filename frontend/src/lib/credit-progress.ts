export function getCreditProgressPercent(earnedCredits: number, requiredCredits: number): number {
  if (requiredCredits <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((earnedCredits / requiredCredits) * 100)));
}
