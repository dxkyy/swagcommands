import SWAGCommands from "..";

class Command {
	_instance;
	_commandName;
	_commandObject;
	constructor(instance: SWAGCommands, commandName: string, commandObject: any) {
		this._instance = instance;
		this._commandName = commandName.toLowerCase();
		this._commandObject = commandObject;
	}

	get instance() {
		return this._instance;
	}

	get commandName() {
		return this._commandName;
	}

	get commandObject() {
		return this._commandObject;
	}
}

export default Command;
