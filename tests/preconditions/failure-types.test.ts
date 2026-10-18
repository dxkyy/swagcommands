import { describe, expect, it } from "vitest";

import { CooldownScope } from "../../src/cooldowns/CooldownPrecondition";
import {
  createPreconditionFailure,
  FailureType,
} from "../../src/preconditions/PreconditionResult";

describe("FailureType", () => {
  it.each([
    ["ArgumentCount", "ARGUMENT_COUNT", { actual: 0, maxArgs: 2, minArgs: 1 }, FailureType.ArgumentCount],
    ["GuildOnly", "GUILD_ONLY", undefined, FailureType.GuildOnly],
    ["HasPermissions", "GUILD_REQUIRED", undefined, FailureType.GuildRequired],
    ["HasPermissions", "MISSING_PERMISSIONS", { missingPermissions: [1n] }, FailureType.MissingPermissions],
    ["OwnerOnly", "OWNER_ONLY", undefined, FailureType.OwnerOnly],
    ["TestOnly", "TEST_ONLY", undefined, FailureType.TestOnly],
    ["Cooldown", "COOLDOWN_INVALID_DURATION", { duration: -1 }, FailureType.CooldownInvalidDuration],
    ["Cooldown", "COOLDOWN_SCOPE_UNAVAILABLE", { scope: CooldownScope.Guild }, FailureType.CooldownScopeUnavailable],
    ["Cooldown", "COOLDOWN_ACTIVE", { cooldownId: "id", scope: CooldownScope.User, expiresAt: 100, remaining: 50 }, FailureType.CooldownActive],
    ["Cooldown", "COOLDOWN_COMMIT_INVALID", undefined, FailureType.CooldownCommitInvalid],
    ["PreconditionContainer", "PRECONDITION_EMPTY_OR_GROUP", undefined, FailureType.PreconditionEmptyOrGroup],
    ["Custom", "PRECONDITION_MISSING_MESSAGE_HANDLER", undefined, FailureType.PreconditionMissingMessageHandler],
    ["Custom", "PRECONDITION_MISSING_CHAT_INPUT_HANDLER", undefined, FailureType.PreconditionMissingChatInputHandler],
    ["Custom", "PRECONDITION_MISSING_CONTEXT_MENU_HANDLER", undefined, FailureType.PreconditionMissingContextMenuHandler],
    ["Custom", "PRECONDITION_UNAVAILABLE", undefined, FailureType.PreconditionUnavailable],
    ["Inline", "INLINE_PRECONDITION_FAILED", undefined, FailureType.InlinePreconditionFailed],
  ] as const)("classifies %s / %s", (name, identifier, context, type) => {
    expect(createPreconditionFailure(name, { identifier, context }).failure.type).toBe(type);
  });

  it("leaves arbitrary and malformed failures in Custom", () => {
    expect(createPreconditionFailure("MyGuard", {
      identifier: "MY_REASON",
      context: { details: "bot-defined" },
    }).failure.type).toBe(FailureType.Custom);
    expect(createPreconditionFailure("Cooldown", {
      identifier: "COOLDOWN_ACTIVE",
      context: { remaining: "50" },
    }).failure.type).toBe(FailureType.Custom);
  });
});
