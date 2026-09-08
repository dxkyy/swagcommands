type Awaitable<T> = T | Promise<T>;

export interface PrefixStore {
  getPrefix(guildId: string): Awaitable<string | undefined>;
  setPrefix(guildId: string, prefix: string): Awaitable<void>;
}
