import { AutocompleteInteraction } from "discord.js";

import type SWAG from "../../../../SWAG";
import AutocompleteHandler from "../../../../execution/AutocompleteHandler";

export default async (interaction: AutocompleteInteraction, instance: SWAG) => {
	const handler = new AutocompleteHandler(instance);
	await handler.execute(
		interaction,
		instance.commandHandler,
		instance.subcommandHandler,
	);
};
