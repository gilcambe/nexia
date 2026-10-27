import plansData from '../../config/plans.json';

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

const rawPlans: { plans: Plan[] } = plansData as { plans: Plan[] };
const PLANS: Record<PlanId, Plan> = (() => {
  const map: Record<string, Plan> = {};
  for (const p of rawPlans.plans) {
    map[p.id] = p;
  }
  return map as Record<PlanId, Plan>;
})();

const STORAGE_KEY = 'nexia-credit-manager';
const RATE_LIMIT_KEY = 'nexia-credit-manager-ratelimit';
// Chave de assinatura para detectar adulteração de dados no localStorage.
// Não substitui criptografia; impede tampering casual do usuário.
const SIG_KEY = 'nexia-cm-v1';

function sign(payload: string): string {
  let h = 0;
  for (let i = 0; i < payload.length; i++) {
    h = ((h << 5) - h + payload.charCodeAt(i)) | 0;
  }
  return `${SIG_KEY}:${Math.abs(h)}`;
}

function loadRateLimits(): Map<string, number[]> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(RATE_LIMIT_KEY) : undefined;
    if (!raw) return new Map();
    const data: Record<string, number[]> = JSON.parse(raw);
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

function saveRateLimits(limits: Map<string, number[]>): void {
  if (typeof localStorage === 'undefined') return;
  const data: Record<string, number[]> = Object.fromEntries(limits);
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
}

interface SignedPayload {
  users: UserCredits[];
  sig: string;
}

function loadUsers(): Map<string, UserCredits> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : undefined;
    if (!raw) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return new Map();
    const payload = parsed as SignedPayload;
    if (!payload.users || !Array.isArray(payload.users) || !payload.sig) return new Map();
    const expected = sign(JSON.stringify(payload.users));
    if (payload.sig !== expected) return new Map();
    return new Map(payload.users.map((u) => [u.userId, u]));
  } catch {
    return new Map();
  }
}

function saveUsers(users: Map<string, UserCredits>): void {
  if (typeof localStorage === 'undefined') return;
  const usersArr = Array.from(users.values());
  const payload: SignedPayload = { users: usersArr, sig: sign(JSON.stringify(usersArr)) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export class CreditManager {
  private users: Map<string, UserCredits>;
  private authCheck: AuthCheck;

  constructor(authCheck: AuthCheck) {
    if (!authCheck) throw new Error('authCheck é obrigatório');
    this.users = loadUsers();
    this.authCheck = authCheck;
    this.callTimestamps = loadRateLimits();
  }

  private callTimestamps: Map<string, number[]>;

  private checkRateLimit(userId: string, action: string): void {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxCalls = 30;
    const key = `${userId}:${action}`;
    const timestamps = this.callTimestamps.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    if (recent.length >= maxCalls) {
      throw new Error(`Muitas chamadas de ${action}. Tente novamente em instantes.`);
    }
    recent.push(now);
    this.callTimestamps.set(key, recent);
    saveRateLimits(this.callTimestamps);
  }

  setAuthCheck(authCheck: AuthCheck): void {
    this.authCheck = authCheck;
  }

  private async requireAuth(userId: string): Promise<void> {
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
    const sitesCreated = existing ? existing.sitesCreated : 0;
    if (plan.sites !== -1 && sitesCreated > plan.sites) {
      throw new Error(
        `Não é possível mudar para o plano ${plan.name}: você já tem ${sitesCreated} site(s), acima do limite de ${plan.sites} do novo plano.`
      );
    }
    // Nunca recarrega créditos ao trocar de plano: mantém o saldo existente.
    // Um plano pago não é um "refill" de créditos de geração/edição.
    const currentCredits = existing
      ? existing.creditsRemaining
      : plan.credits === -1
        ? -1
        : plan.credits;
    this.users.set(userId, {
      userId,
      planId,
      sitesCreated,
      creditsRemaining: currentCredits,
    });
    saveUsers(this.users);
  }

  getUserCredits(userId: string): UserCredits | undefined {
    return this.users.get(userId);
  }

  async canCreateSite(userId: string): Promise<{ allowed: boolean; message?: string }> {
    await this.requireAuth(userId);
    return this._canCreateSite(userId);
  }

  private _canCreateSite(userId: string): { allowed: boolean; message?: string } {
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
    return this._canGenerateOrEdit(userId);
  }

  private _canGenerateOrEdit(userId: string): { allowed: boolean; message?: string } {
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
    this.checkRateLimit(userId, 'consumeCredit');
    return this._consumeCredit(userId);
  }

  private _consumeCredit(userId: string): { success: boolean; message?: string; creditsRemaining?: number } {
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
    await this.requireAuth(userId);
    return this._canPublish(userId);
  }

  private _canPublish(userId: string): { allowed: boolean; message?: string } {
    const user = this.users.get(userId);
    if (!user) return { allowed: false, message: 'Usuário não encontrado' };
    const plan = PLANS[user.planId];
    if (!plan) return { allowed: false, message: 'Plano inválido' };
    // Publicar exige que o usuário tenha ao menos um site criado e créditos disponíveis.
    if (user.sitesCreated <= 0) {
      return { allowed: false, message: 'Você não tem sites para publicar' };
    }
    if (plan.credits !== -1 && user.creditsRemaining <= 0) {
      return { allowed: false, message: 'Créditos esgotados' };
    }
    return { allowed: true };
  }

  async registerSiteCreated(userId: string): Promise<{ success: boolean; message?: string }> {
    await this.requireAuth(userId);
    this.checkRateLimit(userId, 'registerSiteCreated');
    // Verificar limite de sites primeiro
    const canCreate = this._canCreateSite(userId);
    if (!canCreate.allowed) return { success: false, message: canCreate.message };
    
    // Registrar o site criado (sem consumir crédito)
    const user = this.users.get(userId)!;
    user.sitesCreated += 1;
    this.users.set(userId, user);
    saveUsers(this.users);
    return { success: true };
  }

  async registerGeneration(userId: string): Promise<{ success: boolean; message?: string; creditsRemaining?: number }> {
    await this.requireAuth(userId);
    this.checkRateLimit(userId, 'registerGeneration');
    // Verificar se o usuário tem créditos para geração
    const canGenerate = this._canGenerateOrEdit(userId);
    if (!canGenerate.allowed) return { success: false, message: canGenerate.message };
    
    // Consumir crédito para a geração
    const credited = this._consumeCredit(userId);
    if (!credited.success) return { success: false, message: credited.message };
    
    return { success: true, creditsRemaining: credited.creditsRemaining };
  }

  async registerEdit(userId: string): Promise<{ success: boolean; message?: string; creditsRemaining?: number }> {
    await this.requireAuth(userId);
    this.checkRateLimit(userId, 'registerEdit');
    // Verificar se o usuário tem créditos para edição
    const canEdit = this._canGenerateOrEdit(userId);
    if (!canEdit.allowed) return { success: false, message: canEdit.message };
    
    // Consumir crédito para a edição
    const credited = this._consumeCredit(userId);
    if (!credited.success) return { success: false, message: credited.message };
    
    return { success: true, creditsRemaining: credited.creditsRemaining };
  }
}

// Exporta uma fábrica para injeção de authCheck
export function createCreditManager(authCheck: AuthCheck): CreditManager {
  return new CreditManager(authCheck);
}


