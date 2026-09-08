import SWAG from "../../typings";

/**
 * temporary implementation for removing mongodb
 * actual implementation with prefix stores will be added later
 */
class PrefixHandler {
  // <guildId: prefix>
  private _defaultPrefix = "!";
  private _instance: SWAG;

  constructor(instance: SWAG) {
    this._instance = instance;
    if (instance.defaultPrefix) this._defaultPrefix = instance.defaultPrefix;
  }

  public get defaultPrefix() {
    return this._defaultPrefix;
  }

  public get(guildId?: string) {
    // TODO
    return this.defaultPrefix;
  }

  public async set(guildId: string, prefix: string) {
    // TODO
    return;
  }
}

export default PrefixHandler;
