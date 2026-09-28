import type SWAG from "../SWAG";
import type { ContextMenuCommandObject } from "../types";
import { PreconditionContainerArray } from "../preconditions/containers/PreconditionContainerArray";

class ContextMenuCommand {
  public constructor(
    private readonly _instance: SWAG,
    private readonly _commandName: string,
    private readonly _commandObject: ContextMenuCommandObject,
    private readonly _preconditions: PreconditionContainerArray,
  ) {}

  public get instance() {
    return this._instance;
  }

  public get commandName() {
    return this._commandName;
  }

  public get commandObject() {
    return this._commandObject;
  }

  public get preconditions() {
    return this._preconditions;
  }
}

export default ContextMenuCommand;
