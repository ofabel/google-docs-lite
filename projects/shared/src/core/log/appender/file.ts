import * as rfs from 'rotating-file-stream';
import * as util from '../../util';
import {Level} from '../level';
import {AbstractAppender, AbstractAppenderConfig, Formatter, Loggable} from './abstract';

export type FileAppenderConfig = AbstractAppenderConfig & {
  type: 'File';
  path: string;
  format?: string;
  rotations?: number;
  interval?: string;
  size?: string;
}

export class FileAppender extends AbstractAppender {
  protected readonly formatter: Formatter;
  protected readonly stream: rfs.RotatingFileStream;


  public constructor(config: FileAppenderConfig) {
    super(config);

    this.stream = rfs.createStream(FileAppender.getFilename, {
      compress: 'gzip',
      rotate: config.rotations ?? 30,
      interval: config.interval ?? '1d',
      size: config.size ?? '100M',
      path: config.path ?? undefined,
      omitExtension: true,
      mode: 0o644
    });

    const format = config.format ?? '${timestamp} [${instance}] ${level} ${category} - ${message}';

    this.formatter = new Function('timestamp', 'instance', 'level', 'category', 'message', 'return `' + format + '`') as Formatter;
  }

  public append(level: Level, category: string, instance: string, rawTimestamp: Date, ...data: Loggable[]): void {
    const timestamp = rawTimestamp.toISOString();
    const message = this.formatter(timestamp, instance, Level[level], category, data.join(' '));

    this.stream.write(message + '\n');
  }

  public static getFilename(dateOrIndex: number | Date, index?: number): string {
    if (!dateOrIndex) {
      return 'combined.log';
    }

    if (typeof dateOrIndex === 'number') {
      return `combined.log.${dateOrIndex}.gz`;
    }

    const date = util.utc(dateOrIndex);

    return `${date}-combined.log.${index}.gz`;
  }
}
