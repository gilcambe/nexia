export type PlanId = 'free' | 'plus' | 'pro';

export interface Plan {
  id: PlanId;
  name: string;
  sites: number; // -1 = ilimitado
  credits: number; // -1 = ilimitado
  price: number;
}

export interface UserCredits {
  userId: string;
  planId: PlanId;
  sitesCreated: number;
  creditsRemaining: number;
}

const PLANS: Record<PlanId, Plan> = {
  free: { id: 'free', name: 'Gratuito', sites: 1, credits: 10, price: 0 },
  plus: { id: 'plus', name: 'Plus', sites: 3, credits: 50, price: 29 },
  pro: { id: 'pro', name: 'Pro', sites: -1, credits: -1, price: 99 },
};

export class CreditManager {
  private users: Map<string, UserCredits> = new Map();

  getPlan(planId: PlanId): Plan | undefined {
    return PLANS[planId];
  }

  listPlans(): Plan[] {
    return Object.values(PLANS);
  }

  setUserPlan(userId: string, planId: PlanId): void {
    const plan = PLANS[planId];
    if (!plan) throw new Error('Plano inválido');
    this.users.set(userId, {
      userId,
      planId,
      sitesCreated: 0,
      creditsRemaining: plan.credits === -1 ? -1 : plan.credits,
    });
  }

  getUserCredits(userId: string): UserCredits | undefined {
    return this.users.get(userId);
  }

  canCreateSite(userId: string): { allowed: boolean; message?: string } {
    const user = this.users.get(userId);
    if (!user) return { allowed: false, message: 'Usuário não encontrado' };
    const plan = PLANS[user.planId];
    if (!plan) return { allowed: false, message: 'Plano inválido' };
    if (plan.sites === -1) return { allowed: true };
    if (user.sitesCreated >= plan.sites) {
      return { allowed: false, message: 'Limite de sites atingido para o seu plano' };
    }
    return { allowed: true };
  }

  canGenerateOrEdit(userId: string): { allowed: boolean; message?: string } {
    const user = this.users.get(userId);
    if (!user) return { allowed: false, message: 'Usuário não encontrado' };
    const plan = PLANS[user.planId];
    if (!plan) return { allowed: false, message: 'Plano inválido' };
    if (plan.credits === -1) return { allowed: true };
    if (user.creditsRemaining <= 0) {
      return { allowed: false, message: 'Créditos esgotados' };
    }
    return { allowed: true };
  }

  consumeCredit(userId: string): { success: boolean; message?: string; creditsRemaining?: number } {
    const user = this.users.get(userId);
    if (!user) return { success: false, message: 'Usuário não encontrado' };
    const plan = PLANS[user.planId];
    if (!plan) return { success: false, message: 'Plano inválido' };
    if (plan.credits === -1) return { success: true, creditsRemaining: -1 };
    if (user.creditsRemaining <= 0) {
      return { success: false, message: 'Créditos esgotados', creditsRemaining: 0 };
    }
    user.creditsRemaining -= 1;
    this.users.set(userId, user);
    return { success: true, creditsRemaining: user.creditsRemaining };
  }

  registerSiteCreated(userId: string): { success: boolean; message?: string } {
    const can = this.canCreateSite(userId);
    if (!can.allowed) return { success: false, message: can.message };
    const user = this.users.get(userId)!;
    user.sitesCreated += 1;
    this.users.set(userId, user);
    return { success: true };
  }
}

export const creditManager = new CreditManager();
