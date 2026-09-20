import { Client } from "discord.js";

import CommandHandler from "./command-handler/CommandHandler";
import EventHandler from "./event-handler/EventHandler";
import SWAG, {
  CommandResponse,
  Events,
  Options,
  PreconditionFailureEvent,
  Validations,
} from "../typings";
import FeaturesHandler from "./util/FeaturesHandler";
import { Logger } from "./logger/structures/Logger";
import SubcommandHandler from "./subcommand-handler/SubcommandHandler";
import { PrefixStore } from "./prefixes/PrefixStore";
import { MemoryPrefixStore } from "./prefixes/MemoryPrefixStore";
import { InitializationError } from "./errors/InitializationError";
import { ErrorContext, SwagError } from "./errors/SwagError";
import ResponseHandler from "./execution/ResponseHandler";
import CommandExecutor from "./execution/CommandExecutor";
import { PreconditionHandler } from "./preconditions/PreconditionHandler";
import { PreconditionStore } from "./preconditions/PreconditionStore";

export const logger = new Logger();

export type LifecycleState =
  | "idle"
  | "initializing"
  | "ready"
  | "failed"
  | "destroyed";

class SWAGCommands {
  private _client!: Client;
  private _defaultPrefix!: string;
  private _testServers!: string[];
  private _botOwners!: string[];
  private _validations!: Validations;
  private _commandHandler: CommandHandler | undefined;
  private _subcommandHandler: SubcommandHandler | undefined;
  private _eventHandler!: EventHandler;
  private _isConnectedToDB = false;
  private _prefixStore: PrefixStore;
  private _preconditions: PreconditionStore;
  private _preconditionHandler: PreconditionHandler | undefined;
  private _state: LifecycleState = "idle";
  private _initialization: Promise<void> | undefined;
  private readonly _options: Options;
  private readonly _commandExecutor: CommandExecutor;
  private readonly _responseHandler: ResponseHandler;

  private constructor(options: Options) {
    this._options = {
      ...options,
      botOwners: options.botOwners ? [...options.botOwners] : undefined,
      events: options.events ? { ...options.events } : undefined,
      testServers: options.testServers ? [...options.testServers] : undefined,
      validations: options.validations ? { ...options.validations } : undefined,
    };
    this._prefixStore = options.prefixStore ?? new MemoryPrefixStore();
    this._preconditions = new PreconditionStore();
    this._responseHandler = new ResponseHandler(this);
    this._commandExecutor = new CommandExecutor(this as unknown as SWAG);
  }

  public static async create(options: Options): Promise<SWAGCommands> {
    if (!options) {
      throw new Error("Options are required.");
    }

    const instance = new SWAGCommands(options);
    await instance.initialize();
    return instance;
  }

  private initialize(): Promise<void> {
    this._initialization ??= this.performInitialization();
    return this._initialization;
  }

  private async performInitialization(): Promise<void> {
    this._state = "initializing";

    try {
      await this.init(this._options);
      this._state = "ready";
    } catch (error) {
      this._state = "failed";
      if (error instanceof InitializationError) {
        throw error;
      }
      throw new InitializationError(error);
    }
  }

  private async init(options: Options): Promise<void> {
    let {
      client,
      commandsDir,
      preconditionsDir,
      subcommandsDir,
      featuresDir,
      defaultPrefix = "!",
      testServers = [],
      botOwners = [],
      events = {},
      validations = {},
    } = options;

    botOwners = [...botOwners];
    testServers = [...testServers];

    if (!client) {
      throw new Error("A client is required.");
    }

    // Add the bot owner's ID
    if (botOwners.length === 0) {
      await client.application?.fetch();
      const ownerId = client.application?.owner?.id;
      if (ownerId && botOwners.indexOf(ownerId) === -1) {
        botOwners.push(ownerId);
      }
    }

    this._client = client;
    this._defaultPrefix = defaultPrefix;
    this._testServers = testServers;
    this._botOwners = botOwners;
    this._validations = validations;

    if (preconditionsDir) {
      this._preconditionHandler = new PreconditionHandler(
        this as unknown as SWAG,
        preconditionsDir,
        this._preconditions,
      );
      await this._preconditionHandler.load();
    }

    if (commandsDir) {
      this._commandHandler = new CommandHandler(
        this as unknown as SWAG,
        commandsDir,
        client,
        this._commandExecutor,
      );
      await this._commandHandler.load();
    }

    if (subcommandsDir) {
      this._subcommandHandler = new SubcommandHandler(
        this as unknown as SWAG,
        subcommandsDir,
        client,
        this._commandExecutor,
      );
      await this._subcommandHandler.load();
    }

    if (featuresDir) {
      const featuresHandler = new FeaturesHandler(
        this as unknown as SWAG,
        featuresDir,
        client,
      );
      await featuresHandler.load();
    }

    this._eventHandler = new EventHandler(
      this as unknown as SWAG,
      events as Events,
      client,
    );
    await this._eventHandler.load();
    this._eventHandler.registerEvents();
  }

  public get client(): Client {
    return this._client;
  }

  public get defaultPrefix(): string {
    return this._defaultPrefix;
  }

  public get testServers(): string[] {
    return this._testServers;
  }

  public get botOwners(): string[] {
    return this._botOwners;
  }

  public get commandHandler(): CommandHandler | undefined {
    return this._commandHandler;
  }

  public get subcommandHandler(): SubcommandHandler | undefined {
    return this._subcommandHandler;
  }

  public get eventHandler(): EventHandler {
    return this._eventHandler;
  }

  public get validations(): Validations {
    return this._validations;
  }

  public get isConnectedToDB(): boolean {
    return this._isConnectedToDB;
  }

  public get prefixStore(): PrefixStore {
    return this._prefixStore;
  }

  public get preconditions(): PreconditionStore {
    return this._preconditions;
  }

  public get state(): LifecycleState {
    return this._state;
  }

  public isReady(): boolean {
    return this._state === "ready";
  }

  public get responseHandler(): ResponseHandler {
    return this._responseHandler;
  }

  public async reportError(error: SwagError): Promise<void> {
    if (this._options.onError) {
      await this._options.onError(error, error.context as ErrorContext);
      return;
    }

    logger.error(`[${error.code}] ${error.message}`, error.cause);
  }

  public async handlePreconditionFailure(
    event: PreconditionFailureEvent,
  ): Promise<CommandResponse | void> {
    return await this._options.onPreconditionFailure?.(event);
  }
}

export default SWAGCommands;
