import { PrefixStore } from "./PrefixStore";

export class MemoryPrefixStore implements PrefixStore {
  private readonly prefixes = new Map<string, string>();

  getPrefix(guildId: string) {
    return this.prefixes.get(guildId);
  }

  setPrefix(guildId: string, prefix: string) {
    this.prefixes.set(guildId, prefix);
  }
}
