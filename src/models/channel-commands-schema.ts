import { Schema, model, models } from "mongoose";

const channelCommandSchema = new Schema({
	_id: {
		type: String,
		required: true,
	},
	channels: {
		type: [String],
		required: true,
	},
});

const name = "channel-commands";
export default models[name] || model(name, channelCommandSchema);
