import SWAG from "../../typings";

class PrefixHandler {
  private _defaultPrefix = "!";
  private _instance: SWAG;

  constructor(instance: SWAG) {
    this._instance = instance;
    if (instance.defaultPrefix) this._defaultPrefix = instance.defaultPrefix;
  }

  public get defaultPrefix() {
    return this._defaultPrefix;
  }

  public async get(guildId?: string): Promise<string> {
    if (!guildId) {
      return this.defaultPrefix;
    }

    return (
      (await this._instance.prefixStore.getPrefix(guildId)) ??
      this.defaultPrefix
    );
  }

  public async set(guildId: string, prefix: string) {
    await this._instance.prefixStore.setPrefix(guildId, prefix);
  }
}

export default PrefixHandler;
