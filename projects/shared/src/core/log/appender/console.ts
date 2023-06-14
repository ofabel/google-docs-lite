import {Level} from '../level';
import {AbstractAppenderConfig, Formatter, Loggable} from './abstract';
import {StandardAppender} from './standard';

export type ConsoleAppenderConfig = AbstractAppenderConfig & {
  type: 'Console';
  format?: string;
}

export class ConsoleAppender extends StandardAppender {
  protected readonly formatter: Formatter;

  public constructor(config: ConsoleAppenderConfig) {
    super(config);

    const format = config.format ?? '${timestamp} [${instance}] ${level} ${category} - ${message}';

    this.formatter = new Function('timestamp', 'instance', 'level', 'category', 'message', 'return `' + format + '`') as Formatter;
  }

  public append(level: Level, category: string, instance: string, rawTimestamp: Date, ...data: Loggable[]): void {
    const timestamp = rawTimestamp.toISOString();
    const message = this.formatter(timestamp, instance, Level[level], category, data.join(' '));

    this.logInternal(level, message);
  }
}
