import {ConsoleAppenderConfig, DomAppenderConfig, FileAppenderConfig, MqttAppenderConfig, StandardAppenderConfig} from './appender';
import {Level, levelLookup, Levels} from './level';

export type AttachedAppenderConfig<T extends Level | Levels> = {
  name: string;
  level?: T;
};

export type BaseCategoryConfig<T extends Level | Levels> = {
  level: T;
  appenders: AttachedAppenderConfig<T>[];
}

export type RootCategoryConfig<T extends Level | Levels> = BaseCategoryConfig<T> & {
  name?: string;
}

export type CategoryConfig<T extends Level | Levels> = BaseCategoryConfig<T> & {
  name: string;
}

export type AppenderConfig =
  StandardAppenderConfig |
  ConsoleAppenderConfig |
  DomAppenderConfig |
  MqttAppenderConfig |
  FileAppenderConfig;

export type Config = {
  root: RootCategoryConfig<Levels>;
  categories: CategoryConfig<Levels>[];
  appenders: AppenderConfig[];
}

export type CategoryRegistry = {
  [name: string]: Readonly<CategoryConfig<Level>>;
}

export type AppenderRegistry = {
  [name: string]: Readonly<AppenderConfig>
}

export type InternalConfig = {
  readonly root: Readonly<RootCategoryConfig<Level>>;
  readonly categories: Readonly<CategoryRegistry>;
  readonly appenders: Readonly<AppenderRegistry>;
}

export function levelParser(levelToParse: Levels): Level {
  const level = levelLookup[levelToParse];

  if (!level) {
    throw new Error(`level ${levelToParse} is not a valid log level`);
  }

  return level;
}

export function categoryParser(config: BaseCategoryConfig<Levels>): BaseCategoryConfig<Level> {
  const appenders = config.appenders.map(appender => ({
    ...appender,
    level: appender.level ? levelParser(appender.level) : undefined
  }));

  return {
    ...config,
    level: levelParser(config.level),
    appenders: appenders
  };
}

export function parser(config: Config): InternalConfig {
  const root = categoryParser(config.root) as RootCategoryConfig<Level>;
  const categories: CategoryRegistry = {};
  const appenders: AppenderRegistry = {};

  config.categories
    .map(category => categoryParser(category) as CategoryConfig<Level>)
    .forEach(category => categories[category.name] = category);
  config.appenders.forEach(appender => appenders[appender.name] = appender);

  return {
    root: root,
    categories: categories,
    appenders: appenders
  };
}

export const defaultConfig: Config = {
  root: {
    name: 'app',
    level: Level.TRACE,
    appenders: [{
      name: 'standard'
    }]
  },
  categories: [],
  appenders: [{
    name: 'standard',
    type: 'Standard'
  }]
};
