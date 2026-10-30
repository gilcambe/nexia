import { getUserPlan } from '../config/plans';

interface CreditUsage {
  userId: string;
  creditsUsed: number;
  sitesCreated: number;
}

const creditUsage: Record<string, CreditUsage> = {};

export const initializeCreditUsage = (userId: string) => {
  if (!creditUsage[userId]) {
    creditUsage[userId] = {
      userId,
      creditsUsed: 0,
      sitesCreated: 0,
    };
  }
};

export const getCreditUsage = (userId: string): CreditUsage => {
  initializeCreditUsage(userId);
  return creditUsage[userId];
};

export const consumeCredits = (userId: string, credits: number): boolean => {
  initializeCreditUsage(userId);
  const plan = getUserPlan(userId);
  const maxCredits = plan.features.maxCredits;

  if (creditUsage[userId].creditsUsed + credits > maxCredits) {
    return false;
  }

  creditUsage[userId].creditsUsed += credits;
  return true;
};

export const incrementSitesCreated = (userId: string): boolean => {
  initializeCreditUsage(userId);
  const plan = getUserPlan(userId);
  const maxSites = plan.features.maxSites;

  if (creditUsage[userId].sitesCreated >= maxSites) {
    return false;
  }

  creditUsage[userId].sitesCreated += 1;
  return true;
};

export const canCreateSite = (userId: string): boolean => {
  initializeCreditUsage(userId);
  const plan = getUserPlan(userId);
  const maxSites = plan.features.maxSites;

  return creditUsage[userId].sitesCreated < maxSites;
};
