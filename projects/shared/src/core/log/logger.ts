import {IAppender, Loggable, LogMethod} from './appender';
import {Level, levelLookup, Levels} from './level';
import {INSTANCE_ID} from '..';

export type ILoggerBase = {
  readonly [Level in keyof Omit<typeof Level, 'SILENT'> as Lowercase<Level>]: LogMethod;
}

export type ILogger = ILoggerBase & {
  readonly category: string;

  get level(): Level;

  setLevel(level: Levels): void;

  log(level: Level, ...data: Loggable[]): void;
}

export type ILoggerInstance = ILogger & {
  append(level: Level, instance: string, timestamp: Date, ...data: Loggable[]): void;
}

export type AttachedAppender = {
  readonly appender: IAppender;
  readonly level: Level;
}

export abstract class AbstractLogger implements ILogger {
  public readonly category: string;

  protected currentLevel: Level;

  protected readonly attachedAppenders: AttachedAppender[];

  public constructor(category: string, level: Level, appenders: AttachedAppender[]) {
    this.category = category;
    this.currentLevel = level;
    this.attachedAppenders = appenders;
  }

  get level(): Level {
    return this.currentLevel;
  }

  setLevel(level: Levels): void {
    this.currentLevel = levelLookup[level];
  }

  public trace(...data: Loggable[]): void {
    this.log(Level.TRACE, ...data);
  }

  public debug(...data: Loggable[]): void {
    this.log(Level.DEBUG, ...data);
  }

  public info(...data: Loggable[]): void {
    this.log(Level.INFO, ...data);
  }

  public warn(...data: Loggable[]): void {
    this.log(Level.WARN, ...data);
  }

  public error(...data: Loggable[]): void {
    this.log(Level.ERROR, ...data);
  }

  public abstract log(level: Level, ...data: Loggable[]): void;
}

export class Logger extends AbstractLogger implements ILoggerInstance {
  public log(level: Level, ...data: Loggable[]): void {
    const timestamp = new Date();

    this.append(level, INSTANCE_ID, timestamp, ...data);
  }

  public append(level: Level, instance: string, timestamp: Date, ...data: Loggable[]): void {
    if (level >= this.currentLevel) {
      this.attachedAppenders
        .filter(config => level >= config.level)
        .map(config => config.appender)
        .forEach(appender => appender.append(level, this.category, instance, timestamp, ...data));
    }
  }
}

export class NullLogger extends AbstractLogger implements ILoggerInstance {
  public trace(): void {
    // NOP
  }

  public debug(): void {
    // NOP
  }

  public info(): void {
    // NOP
  }

  public warn(): void {
    // NOP
  }

  public error(): void {
    // NOP
  }

  public log(): void {
    // NOP
  }

  public append(): void {
    // NOP
  }
}
