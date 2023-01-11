import channelCommandsSchema from "../models/channel-commands-schema";

class ChannelCommands {
	// `${guildId}-${commandName}`: [channelIds]
	_channelCommands = new Map();

	async action(
		action: string,
		guildId: string,
		commandName: string,
		channelId: string
	) {
		const _id = `${guildId}-${commandName}`;

		const result = await channelCommandsSchema.findOneAndUpdate(
			{ _id },
			{
				_id,
				[action === "add" ? "$addToSet" : "$pull"]: { channels: channelId },
			},
			{ upsert: true, new: true }
		);
		console.log(result);
		this._channelCommands.set(_id, result.channels);
		return result.channels;
	}

	async add(guildId: string, commandName: string, channelId: string) {
		return await this.action("add", guildId, commandName, channelId);
	}

	async remove(guildId: string, commandName: string, channelId: string) {
		return await this.action("remove", guildId, commandName, channelId);
	}

	async getAvailableChannels(guildId: string, commandName: string) {
		const _id = `${guildId}-${commandName}`;
		let channels = this._channelCommands.get(_id);

		if (!channels) {
			console.log("Getting channels from database");
			const results = await channelCommandsSchema.findById(_id);
			channels = results ? results.channels : [];
			this._channelCommands.set(_id, channels);
		}

		return channels;
	}
}

export default ChannelCommands;
