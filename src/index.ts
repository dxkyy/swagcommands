import { MemoryPrefixStore } from "./prefixes/MemoryPrefixStore";
import { MemoryCooldownStore } from "./cooldowns/MemoryCooldownStore";
import {
  CooldownPrecondition,
  CooldownScope,
  createCooldownId,
} from "./cooldowns/CooldownPrecondition";
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
import { PreconditionExecutionError } from "./errors/PreconditionExecutionError";
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
import {
  ArgumentCountPrecondition,
  GuildOnlyPrecondition,
  HasPermissionsPrecondition,
  OwnerOnlyPrecondition,
  TestOnlyPrecondition,
} from "./preconditions/built-ins/BuiltInPreconditions";

module.exports = SWAG;
module.exports.CommandType = CommandType;
module.exports.MemoryPrefixStore = MemoryPrefixStore;
module.exports.MemoryCooldownStore = MemoryCooldownStore;
module.exports.CooldownPrecondition = CooldownPrecondition;
module.exports.CooldownScope = CooldownScope;
module.exports.createCooldownId = createCooldownId;
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
module.exports.PreconditionExecutionError = PreconditionExecutionError;
module.exports.ResponseHandler = ResponseHandler;
module.exports.SwagError = SwagError;
module.exports.AllFlowsPrecondition = AllFlowsPrecondition;
module.exports.Precondition = Precondition;
module.exports.PreconditionContainerArray = PreconditionContainerArray;
module.exports.PreconditionContainerSingle = PreconditionContainerSingle;
module.exports.PreconditionHandler = PreconditionHandler;
module.exports.PreconditionRunCondition = PreconditionRunCondition;
module.exports.PreconditionStore = PreconditionStore;
module.exports.ArgumentCountPrecondition = ArgumentCountPrecondition;
module.exports.GuildOnlyPrecondition = GuildOnlyPrecondition;
module.exports.HasPermissionsPrecondition = HasPermissionsPrecondition;
module.exports.OwnerOnlyPrecondition = OwnerOnlyPrecondition;
module.exports.TestOnlyPrecondition = TestOnlyPrecondition;
