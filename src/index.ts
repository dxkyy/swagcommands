import { MemoryPrefixStore } from "./prefixes/MemoryPrefixStore";
import SWAG from "./SWAG";
import CommandType from "./util/CommandType";
import { AutocompleteError } from "./errors/AutocompleteError";
import { CommandDefinitionError } from "./errors/CommandDefinitionError";
import { CommandExecutionError } from "./errors/CommandExecutionError";
import { EventExecutionError } from "./errors/EventExecutionError";
import { InitializationError } from "./errors/InitializationError";
import { InteractionResponseError } from "./errors/InteractionResponseError";
import { InteractionAlreadyAcknowledgedError } from "./errors/InteractionAlreadyAcknowledgedError";
import { MessageResponseError } from "./errors/MessageResponseError";
import { ModuleLoadError } from "./errors/ModuleLoadError";
import { SwagError } from "./errors/SwagError";
import ResponseHandler from "./execution/ResponseHandler";
import {
  AllFlowsPrecondition,
  Precondition,
} from "./preconditions/Precondition";
import { PreconditionHandler } from "./preconditions/PreconditionHandler";
import { PreconditionStore } from "./preconditions/PreconditionStore";
import {
  PreconditionContainerArray,
  PreconditionRunCondition,
} from "./preconditions/containers/PreconditionContainerArray";
import { PreconditionContainerSingle } from "./preconditions/containers/PreconditionContainerSingle";

module.exports = SWAG;
module.exports.CommandType = CommandType;
module.exports.MemoryPrefixStore = MemoryPrefixStore;
module.exports.AutocompleteError = AutocompleteError;
module.exports.CommandDefinitionError = CommandDefinitionError;
module.exports.CommandExecutionError = CommandExecutionError;
module.exports.EventExecutionError = EventExecutionError;
module.exports.InitializationError = InitializationError;
module.exports.InteractionAlreadyAcknowledgedError =
  InteractionAlreadyAcknowledgedError;
module.exports.InteractionResponseError = InteractionResponseError;
module.exports.MessageResponseError = MessageResponseError;
module.exports.ModuleLoadError = ModuleLoadError;
module.exports.ResponseHandler = ResponseHandler;
module.exports.SwagError = SwagError;
module.exports.AllFlowsPrecondition = AllFlowsPrecondition;
module.exports.Precondition = Precondition;
module.exports.PreconditionContainerArray = PreconditionContainerArray;
module.exports.PreconditionContainerSingle = PreconditionContainerSingle;
module.exports.PreconditionHandler = PreconditionHandler;
module.exports.PreconditionRunCondition = PreconditionRunCondition;
module.exports.PreconditionStore = PreconditionStore;
