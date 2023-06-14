import {Level} from '../level';
import {ConsoleAppenderConfig} from './console';
import {DomAppenderConfig} from './dom';
import {MqttAppenderConfig} from './mqtt';
import {StandardAppenderConfig} from './standard';
import {FileAppenderConfig} from './file';

export type Loggable = undefined | number | boolean | string | { toJSON(): string } | { toString(): string; };

export type LogMethod = (...data: Loggable[]) => void;

export type Appenders =
    StandardAppenderConfig['type'] |
    ConsoleAppenderConfig['type'] |
    DomAppenderConfig['type'] |
    MqttAppenderConfig['type'] |
    FileAppenderConfig['type'];

export type IAppender = {
  append(level: Level, category: string, instance: string, timestamp: Date, ...data: Loggable[]): void;
}

export type AbstractAppenderConfig = {
  name: string;
  type: string;
}

export abstract class AbstractAppender {
  protected readonly config: AbstractAppenderConfig;

  public constructor(config: AbstractAppenderConfig) {
    this.config = config;
  }
}

export type Formatter = (timestamp: string, instance: string, level: string, category: string, message: Loggable) => string;

