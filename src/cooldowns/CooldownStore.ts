type Awaitable<T> = T | Promise<T>;

export interface CooldownClaim {
  acquired: boolean;
  expiresAt: number;
}

export interface CooldownStore {
  claimCooldown(
    cooldownId: string,
    expiresAt: number,
    now: number,
  ): Awaitable<CooldownClaim>;
  deleteCooldown(cooldownId: string): Awaitable<void>;
  getCooldown(cooldownId: string): Awaitable<number | undefined>;
  setCooldown(cooldownId: string, expiresAt: number): Awaitable<void>;
}
