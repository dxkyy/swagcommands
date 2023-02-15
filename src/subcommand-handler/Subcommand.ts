import SWAG, { SubcommandObject } from "../../typings";
import SubcommandOption from "./SubcommandOption";

class Subcommand {
	private _instance: SWAG;
	private _commandName: string;
	private _commandObject: SubcommandObject;
	private _options: SubcommandOption[];

	constructor(
		instance: SWAG,
		commandName: string,
		commandObject: SubcommandObject,
		options: SubcommandOption[]
	) {
		this._instance = instance;
		this._commandName = commandName.toLowerCase();
		this._commandObject = commandObject;
		this._options = options;
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

	public get options() {
		return this._options;
	}
}

export default Subcommand;
