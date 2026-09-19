import { MemoryPrefixStore } from "./prefixes/MemoryPrefixStore";
import SWAG from "./SWAG";
import CommandType from "./util/CommandType";
import { CommandDefinitionError } from "./errors/CommandDefinitionError";
import { CommandExecutionError } from "./errors/CommandExecutionError";
import { InitializationError } from "./errors/InitializationError";
import { InteractionResponseError } from "./errors/InteractionResponseError";
import { ModuleLoadError } from "./errors/ModuleLoadError";
import { SwagError } from "./errors/SwagError";

module.exports = SWAG;
module.exports.CommandType = CommandType;
module.exports.MemoryPrefixStore = MemoryPrefixStore;
module.exports.CommandDefinitionError = CommandDefinitionError;
module.exports.CommandExecutionError = CommandExecutionError;
module.exports.InitializationError = InitializationError;
module.exports.InteractionResponseError = InteractionResponseError;
module.exports.ModuleLoadError = ModuleLoadError;
module.exports.SwagError = SwagError;
