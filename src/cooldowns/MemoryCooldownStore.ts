import { CooldownClaim, CooldownStore } from "./CooldownStore";

export class MemoryCooldownStore implements CooldownStore {
  private readonly cooldowns = new Map<string, number>();

  public claimCooldown(
    cooldownId: string,
    expiresAt: number,
    now: number,
  ): CooldownClaim {
    const activeExpiration = this.cooldowns.get(cooldownId);
    if (activeExpiration !== undefined && activeExpiration > now) {
      return { acquired: false, expiresAt: activeExpiration };
    }

    this.cooldowns.set(cooldownId, expiresAt);
    return { acquired: true, expiresAt };
  }

  public deleteCooldown(cooldownId: string): void {
    this.cooldowns.delete(cooldownId);
  }

  public getCooldown(cooldownId: string): number | undefined {
    return this.cooldowns.get(cooldownId);
  }

  public setCooldown(cooldownId: string, expiresAt: number): void {
    this.cooldowns.set(cooldownId, expiresAt);
  }
}
