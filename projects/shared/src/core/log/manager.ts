import {LookupTable} from '../util';
import {Appenders, ConsoleAppender, ConsoleAppenderConfig, DomAppender, DomAppenderConfig, IAppender, Loggable, MqttAppender, MqttAppenderConfig, StandardAppender, StandardAppenderConfig} from './appender';
import {AppenderConfig, AttachedAppenderConfig, BaseCategoryConfig, CategoryConfig, Config, InternalConfig, parser} from './config';
import {Level, Levels} from './level';
import {AttachedAppender, ILogger, ILoggerInstance, Logger, NullLogger} from './logger';
import {FileAppender, FileAppenderConfig} from './appender';

export type IManager = {
  getLogger(category: string): ILogger;
}

export type IAppenderFactory = (config: AppenderConfig) => IAppender;

export class Manager implements IManager {
  protected readonly config: InternalConfig;
  protected readonly loggerRegistry: Record<string, ILogger> = {};
  protected readonly appenderFactoryRegistry: LookupTable<Appenders, IAppenderFactory> = {
    'Standard': (config) => new StandardAppender(config as StandardAppenderConfig),
    'Console': (config) => new ConsoleAppender(config as ConsoleAppenderConfig),
    'DOM': (config) => new DomAppender(config as DomAppenderConfig),
    'MQTT': (config) => new MqttAppender(config as MqttAppenderConfig),
    'File' : (config) => new FileAppender(config as FileAppenderConfig),
  };
  protected readonly appenderRegistry: Record<string, IAppender> = {};
  protected readonly rootCategoryName: string;
  protected readonly rootCategoryPrefix: string;

  public constructor(config: Config) {
    this.config = this.parseAndVerify(config);

    this.rootCategoryName = config.root.name ?? '';
    this.rootCategoryPrefix = config.root.name ? this.rootCategoryName + ':' : '';
  }

  public getLogger(category = Manager.rootCategoryId): ILogger {
    return this.loggerRegistry[category] ?? this.createLogger(category);
  }

  public static get rootCategoryId(): string {
    return '97b69caa-8065-4197-944f-a8e25f4636bf';
  }

  protected createLogger(category: string): ILogger {
    const normalizedCategory = this.normalizeCategory(category);
    const config = this.getConfig(category);
    const level = config.level;
    const appenders = config.appenders
      .filter(appender => appender.name in this.config.appenders)
      .map(appender => this.createAttachedAppender(appender))
    const instance = appenders.length === 0 ? new NullLogger(normalizedCategory, level, appenders) : new Logger(normalizedCategory, level, appenders);
    const logger = this.createLoggerObjectWrapper(instance);

    this.loggerRegistry[category] = logger;

    return logger;
  }

  protected createLoggerObjectWrapper(logger: ILoggerInstance): ILoggerInstance {
    return {
      category: logger.category,
      get level(): Level {
        return logger.level;
      },
      setLevel(level: Levels): void {
        logger.setLevel(level);
      },
      trace(...args): void {
        logger.trace(...args);
      },
      debug(...args): void {
        logger.debug(...args);
      },
      info(...args): void {
        logger.info(...args);
      },
      warn(...args): void {
        logger.warn(...args);
      },
      error(...args): void {
        logger.error(...args);
      },
      log(level: Level, ...data): void {
        logger.log(level, ...data);
      },
      append(level: Level, instance: string, timestamp: Date, ...data: Loggable[]): void {
        logger.append(level, instance, timestamp, ...data);
      }
    };
  }

  protected getConfig(category: string): CategoryConfig<Level> {
    const config = this.config.categories[category] ?? this.config.root;
    const appenders = config.appenders.length === 0 ? this.config.root.appenders : config.appenders;

    return {
      name: config.name,
      level: config.level,
      appenders: appenders
    };
  }

  protected getAppender(config: AppenderConfig): IAppender {
    return this.appenderRegistry[config.type] ?? this.createAppender(config);
  }

  protected createAppender(config: AppenderConfig): IAppender {
    const factory = this.appenderFactoryRegistry[config.type];

    const appender = factory(config);

    this.appenderRegistry[config.type] = appender;

    return appender;
  }

  protected createAttachedAppender(attachedAppender: AttachedAppenderConfig<Level>): AttachedAppender {
    const config = this.config.appenders[attachedAppender.name];
    const appender = this.getAppender(config);
    const level = attachedAppender.level ?? Level.TRACE;

    return {
      appender: appender,
      level: level
    };
  }

  protected normalizeCategory(category: string): string {
    return category === Manager.rootCategoryId ? this.rootCategoryName : this.rootCategoryPrefix + category
  }

  protected parseAndVerify(config: Config): InternalConfig {
    const internalConfig = parser(config);

    if (internalConfig.root.appenders.length === 0) {
      throw new Error('root logger config has no appenders');
    }

    if (Object.keys(internalConfig.appenders).length === 0) {
      throw new Error('there are no appenders configured');
    }

    this.verifyCategoryConfig(internalConfig, internalConfig.root, 'root');

    for (const category of Object.values(internalConfig.categories)) {
      this.verifyCategoryConfig(internalConfig, category, category.name);
    }

    for (const appender of Object.values(config.appenders)) {
      if (!this.appenderFactoryRegistry[appender.type]) {
        throw new Error(`there is no log appender of type '${appender.type}'`);
      }
    }

    return internalConfig;
  }

  protected verifyCategoryConfig(config: InternalConfig, category: BaseCategoryConfig<Level>, name: string) {
    for (const appender of category.appenders) {
      if (!config.appenders[appender.name]) {
        throw new Error(`log appender with name '${appender.name}' - as listed in category '${name}' - does not exist`);
      }
    }
  }
}
