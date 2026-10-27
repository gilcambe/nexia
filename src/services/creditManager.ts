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

export type AuthCheck = (userId: string) => Promise<boolean> | boolean;

const PLANS: Record<PlanId, Plan> = {
  free: { id: 'free', name: 'Gratuito', sites: 1, credits: 10, price: 0 },
  plus: { id: 'plus', name: 'Plus', sites: 3, credits: 50, price: 29 },
  pro: { id: 'pro', name: 'Pro', sites: -1, credits: -1, price: 99 },
};

const STORAGE_KEY = 'nexia-credit-manager';

function loadUsers(): Map<string, UserCredits> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : undefined;
    if (!raw) return new Map();
    const arr: UserCredits[] = JSON.parse(raw);
    return new Map(arr.map((u) => [u.userId, u]));
  } catch {
    return new Map();
  }
}

function saveUsers(users: Map<string, UserCredits>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(users.values())));
}

export class CreditManager {
  private users: Map<string, UserCredits>;
  private authCheck?: AuthCheck;

  constructor(authCheck?: AuthCheck) {
    this.users = loadUsers();
    this.authCheck = authCheck;
  }

  setAuthCheck(authCheck: AuthCheck): void {
    this.authCheck = authCheck;
  }

  private async requireAuth(userId: string): Promise<void> {
    if (!this.authCheck) return;
    const ok = await this.authCheck(userId);
    if (!ok) throw new Error('Usuário não autenticado');
  }

  getPlan(planId: PlanId): Plan | undefined {
    return PLANS[planId];
  }

  listPlans(): Plan[] {
    return Object.values(PLANS);
  }

  async setUserPlan(userId: string, planId: PlanId): Promise<void> {
    await this.requireAuth(userId);
    const plan = PLANS[planId];
    if (!plan) throw new Error('Plano inválido');
    const existing = this.users.get(userId);
    this.users.set(userId, {
      userId,
      planId,
      sitesCreated: existing ? existing.sitesCreated : 0,
      creditsRemaining: plan.credits === -1 ? -1 : plan.credits,
    });
    saveUsers(this.users);
  }

  getUserCredits(userId: string): UserCredits | undefined {
    return this.users.get(userId);
  }

  async canCreateSite(userId: string): Promise<{ allowed: boolean; message?: string }> {
    await this.requireAuth(userId);
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

  async canGenerateOrEdit(userId: string): Promise<{ allowed: boolean; message?: string }> {
    await this.requireAuth(userId);
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

  async consumeCredit(userId: string): Promise<{ success: boolean; message?: string; creditsRemaining?: number }> {
    await this.requireAuth(userId);
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
    saveUsers(this.users);
    return { success: true, creditsRemaining: user.creditsRemaining };
  }

  async canPublish(userId: string): Promise<{ allowed: boolean; message?: string }> {
    return this.canCreateSite(userId);
  }

  async registerSiteCreated(userId: string): Promise<{ success: boolean; message?: string }> {
    const can = await this.canCreateSite(userId);
    if (!can.allowed) return { success: false, message: can.message };
    const user = this.users.get(userId)!;
    user.sitesCreated += 1;
    this.users.set(userId, user);
    saveUsers(this.users);
    return { success: true };
  }
}

export const creditManager = new CreditManager();
