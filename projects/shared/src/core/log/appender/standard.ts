import {LookupTable} from '../../util';
import {Level} from '../level';
import {AbstractAppender, AbstractAppenderConfig, IAppender, Loggable, LogMethod} from './abstract';

export type StandardAppenderConfig = AbstractAppenderConfig & {
  type: 'Standard';
}

export class StandardAppender extends AbstractAppender implements IAppender {
  protected readonly levelMethodMapping: LookupTable<Level, LogMethod> = {
    1: console.trace,
    2: console.debug,
    3: console.info,
    4: console.warn,
    5: console.error,
    6: () => void (0),
  };

  public append(level: Level, _category: string, _instance: string, _timestamp: Date, ...data: Loggable[]): void {
    this.logInternal(level, ...data);
  }

  protected logInternal(level: Level, ...data: Loggable[]): void {
    const mappedFunction = this.levelMethodMapping[level];

    mappedFunction(...data);
  }
}
