import * as util from '../util';
import {Config, Protocol} from './config';
import {Dispatcher, IDispatcher} from './dispatcher';
import {INSTANCE_ID} from '..';

export type IBuilder<Type> = {
  build(): [Type, Promise<Type>];
}

export type IOptionsBuilder<IDispatcher, Options> = IBuilder<IDispatcher> & {
  [Property in keyof Options as `with${Capitalize<string & Property>}`]: (value: Options[Property]) => IOptionsBuilder<IDispatcher, Options>;
}

export class Builder implements IOptionsBuilder<IDispatcher, Config> {
  private readonly options: util.Writeable<Config>;

  public constructor(envPrefix = '') {
    this.options = Builder.getDefaultConfig(envPrefix);
  }

  public withHost(host: Config['host']): Builder {
    this.options.host = host;

    return this;
  }

  public withPort(port: Config['port']): Builder {
    this.options.port = port;

    return this;
  }

  public withProtocol(protocol: Config['protocol']): Builder {
    this.options.protocol = protocol;

    return this;
  }

  public withUsername(username: Config['username']): Builder {
    this.options.username = username;

    return this;
  }

  public withPassword(password: Config['password']): Builder {
    this.options.password = password;

    return this;
  }

  public withClientId(clientId: Config['clientId']): Builder {
    this.options.clientId = clientId;

    return this;
  }

  public withPath(wsPath: Config['path']): Builder {
    this.options.path = wsPath;

    return this;
  }

  public withTopicPrefix(topicPrefix: Config['topicPrefix']): Builder {
    this.options.topicPrefix = topicPrefix;

    return this;
  }

  public withRevision(revision: Config['revision']): Builder {
    this.options.revision = revision;

    return this;
  }

  public withCompressionThreshold(compressionThreshold: Config['compressionThreshold']): Builder {
    this.options.compressionThreshold = compressionThreshold;

    return this;
  }

  public withCompressionLevel(compressionLevel: Config['compressionLevel']): Builder {
    this.options.compressionLevel = compressionLevel;

    return this;
  }

  public withMinLatency(minLatency: Config['minLatency']): Builder {
    this.options.minLatency = minLatency;

    return this;
  }

  public withMaxLatency(maxLatency: Config['maxLatency']): Builder {
    this.options.maxLatency = maxLatency;

    return this;
  }

  public withDefaultOnEchoCallbackTimeout(timeout: Config['defaultOnEchoCallbackTimeout']): Builder {
    this.options.defaultOnEchoCallbackTimeout = timeout;

    return this;
  }

  public withDefaultOnResponseCallbackTimeout(timeout: Config['defaultOnResponseCallbackTimeout']) {
    this.options.defaultOnResponseCallbackTimeout = timeout;

    return this;
  }

  public build(): [dispatcher: IDispatcher, promise: Promise<IDispatcher>] {
    const config: Config = util.deepClone(this.options);

    return Dispatcher.init(config);
  }

  private static getDefaultConfig(prefix: string): util.Writeable<Config> {
    const host = process.env[`${prefix}WODSS_MQTT_HOST`] as string;
    const port = parseInt(process.env[`${prefix}WODSS_MQTT_PORT`] as string);
    const protocol = process.env[`${prefix}WODSS_MQTT_PROTOCOL`] as Protocol;
    const username = process.env[`${prefix}WODSS_MQTT_USERNAME`] as string;
    const password = process.env[`${prefix}WODSS_MQTT_PASSWORD`] as string;
    const clientId = process.env[`${prefix}WODSS_MQTT_CLIENT_ID`] as string ?? INSTANCE_ID;
    const topicPrefix = process.env[`${prefix}WODSS_MQTT_TOPIC_PREFIX`];
    const path = process.env[`${prefix}WODSS_MQTT_PATH`] as string;
    const revision = process.env[`${prefix}WODSS_REVISION`] as string;
    const compressionThreshold = parseInt(process.env[`${prefix}WODSS_MQTT_COMPRESSION_THRESHOLD`] ?? '-1');
    const compressionLevel = parseInt(process.env[`${prefix}WODSS_MQTT_COMPRESSION_LEVEL`] ?? '6') as Config['compressionLevel'];
    const minLatency = parseInt(process.env[`${prefix}WODSS_MQTT_MIN_LATENCY`] ?? '0');
    const maxLatency = parseInt(process.env[`${prefix}WODSS_MQTT_MAX_LATENCY`] ?? '0');
    const defaultOnEchoCallbackTimeout = parseInt(process.env[`${prefix}WODSS_MQTT_DEFAULT_ECHO_TIMEOUT`] ?? '15000');
    const defaultOnResponseCallbackTimeout = parseInt(process.env[`${prefix}WODSS_MQTT_DEFAULT_RESPONSE_TIMEOUT`] ?? '30000');

    return {
      host: host,
      port: port,
      protocol: protocol,
      username: username,
      password: password,
      clientId: clientId,
      topicPrefix: topicPrefix,
      path: path,
      revision: revision,
      compressionThreshold: compressionThreshold,
      compressionLevel: compressionLevel,
      minLatency: minLatency,
      maxLatency: maxLatency,
      defaultOnEchoCallbackTimeout: defaultOnEchoCallbackTimeout,
      defaultOnResponseCallbackTimeout: defaultOnResponseCallbackTimeout
    };
  }
}
