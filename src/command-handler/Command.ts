import SWAG, { CommandObject } from "../../typings";
import { PreconditionContainerArray } from "../preconditions/containers/PreconditionContainerArray";

class Command {
	private _instance: SWAG;
	private _commandName: string;
	private _commandObject: CommandObject;
	private _preconditions: PreconditionContainerArray;

	constructor(
		instance: SWAG,
		commandName: string,
		commandObject: CommandObject,
		preconditions: PreconditionContainerArray,
	) {
		this._instance = instance;
		this._commandName = commandName.toLowerCase();
		this._commandObject = commandObject;
		this._preconditions = preconditions;
	}

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

export default Command;
