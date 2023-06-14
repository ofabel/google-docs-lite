import {LookupTable} from '../util';

export enum Level {
  TRACE = 1,
  DEBUG = 2,
  INFO = 3,
  WARN = 4,
  ERROR = 5,
  SILENT = 6
}

export type Levels = Lowercase<keyof typeof Level> | keyof typeof Level | Level;

export const levelLookup: LookupTable<Levels, Level> = {
  1: Level.TRACE,
  2: Level.DEBUG,
  3: Level.INFO,
  4: Level.WARN,
  5: Level.ERROR,
  6: Level.SILENT,
  TRACE: Level.TRACE,
  DEBUG: Level.DEBUG,
  INFO: Level.INFO,
  WARN: Level.WARN,
  ERROR: Level.ERROR,
  SILENT: Level.SILENT,
  trace: Level.TRACE,
  debug: Level.DEBUG,
  info: Level.INFO,
  warn: Level.WARN,
  error: Level.ERROR,
  silent: Level.SILENT,
}
