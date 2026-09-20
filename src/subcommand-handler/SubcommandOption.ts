import SWAG, { SubcommandOptionObject } from "../../typings";
import { PreconditionContainerArray } from "../preconditions/containers/PreconditionContainerArray";
import type Subcommand from "./Subcommand";

class SubcommandOption {
	private _instance: SWAG;
	private _optionName: string;
	private _optionObject: SubcommandOptionObject;
	private _parent!: Subcommand;
	private _preconditions: PreconditionContainerArray;

	constructor(
		instance: SWAG,
		optionName: string,
		optionObject: SubcommandOptionObject,
		preconditions: PreconditionContainerArray,
	) {
		this._instance = instance;
		this._optionName = optionName.toLowerCase();
		this._optionObject = optionObject;
		this._preconditions = preconditions;
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

	public get parent() {
		return this._parent;
	}

	public get preconditions() {
		return this._preconditions;
	}

	public setParent(parent: Subcommand) {
		if (this._parent && this._parent !== parent) {
			throw new Error(
				`Subcommand option "${this._optionName}" already has a parent.`,
			);
		}

		this._parent = parent;
	}
}

export default SubcommandOption;
