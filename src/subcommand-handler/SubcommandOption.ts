import SWAG, { SubcommandOptionObject } from "../../typings";

class SubcommandOption {
	private _instance: SWAG;
	private _optionName: string;
	private _optionObject: SubcommandOptionObject;

	constructor(
		instance: SWAG,
		optionName: string,
		optionObject: SubcommandOptionObject
	) {
		this._instance = instance;
		this._optionName = optionName.toLowerCase();
		this._optionObject = optionObject;
	}

	public get instance() {
		return this._instance;
	}

	public get commandName() {
		return this._optionName;
	}

	public get optionObject() {
		return this._optionObject;
	}
}

export default SubcommandOption;
