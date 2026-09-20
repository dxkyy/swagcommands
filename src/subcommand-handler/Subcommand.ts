import SWAG, { SubcommandObject } from "../../typings";
import SubcommandOption from "./SubcommandOption";
import { PreconditionContainerArray } from "../preconditions/containers/PreconditionContainerArray";

class Subcommand {
	private _instance: SWAG;
	private _commandName: string;
	private _commandObject: SubcommandObject;
	private _options: SubcommandOption[];
	private _preconditions: PreconditionContainerArray;

	constructor(
		instance: SWAG,
		commandName: string,
		commandObject: SubcommandObject,
		options: SubcommandOption[],
		preconditions: PreconditionContainerArray,
	) {
		this._instance = instance;
		this._commandName = commandName.toLowerCase();
		this._commandObject = commandObject;
		this._options = options;
		this._preconditions = preconditions;

		for (const option of options) {
			option.setParent(this);
		}
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

	public get preconditions() {
		return this._preconditions;
	}
}

export default Subcommand;
