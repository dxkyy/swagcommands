import { CooldownStore } from "./CooldownStore";

export class MemoryCooldownStore implements CooldownStore {
  private readonly cooldowns = new Map<string, number>();

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
