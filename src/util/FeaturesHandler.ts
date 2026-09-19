import { Client } from "discord.js";
import SWAG from "../../typings";
import getAllFiles from "./get-all-files";

class FeaturesHandler {
  private _client: Client;
  private _featuresDir: string;
  private _instance: SWAG;
  private _loading: Promise<void> | undefined;

	constructor(instance: SWAG, featuresDir: string, client: Client) {
		this._instance = instance;
		this._featuresDir = featuresDir;
		this._client = client;
	}

	public load(): Promise<void> {
		this._loading ??= this.readFiles();
		return this._loading;
	}

	private async readFiles() {
		const files = getAllFiles(this._featuresDir);

		for (const file of files) {
			const func = file.fileContents;

			if (func instanceof Function) {
				await func(this._instance, this._client);
			}
		}
	}
}

export default FeaturesHandler;
