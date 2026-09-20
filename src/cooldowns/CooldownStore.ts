type Awaitable<T> = T | Promise<T>;

export interface CooldownStore {
  deleteCooldown(cooldownId: string): Awaitable<void>;
  getCooldown(cooldownId: string): Awaitable<number | undefined>;
  setCooldown(cooldownId: string, expiresAt: number): Awaitable<void>;
}
