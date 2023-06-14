import * as mqtt from 'mqtt';
import {Level, levelLookup, Levels} from '../level';
import {AbstractAppender, AbstractAppenderConfig, IAppender, Loggable} from './abstract';

export type MqttAppenderConfig = AbstractAppenderConfig & {
  type: 'MQTT';
  url: string;
  topic: string;
}

export class MqttAppender extends AbstractAppender implements IAppender {
  protected readonly broker: mqtt.Client;
  protected readonly baseTopic: string;

  public constructor(config: MqttAppenderConfig) {
    super(config);

    const opts: mqtt.IClientOptions = {
      protocolVersion: 5
    };

    this.broker = mqtt.connect(config.url, opts);
    this.baseTopic = '/' + config.topic.split('/').filter(v => v.length > 0).join('/');
  }

  public append(level: Level, category: string, instance: string, timestamp: Date, ...data: Loggable[]): void {
    const [topic, message, opts] = MqttAppender.encode(this.baseTopic, level, category, instance, timestamp, ...data);

    this.publish(topic, message, opts)
      .catch(error => console.error(error));
  }

  protected async publish(topic: string, message: string, opts: mqtt.IClientPublishOptions): Promise<void> {
    this.broker.publish(topic, message, opts);
  }

  public static encode(baseTopic: string, level: Level, category: string, instance: string, timestamp: Date, ...data: Loggable[]): [string, string, mqtt.IClientPublishOptions] {
    const isString = data.length === 1 && typeof data[0] === 'string';
    const message = isString ? data[0] as string : JSON.stringify(data);
    const topic = `${baseTopic}/${Level[level]}/${category}`;
    const opts: mqtt.IClientPublishOptions = {
      qos: 2,
      properties: {
        contentType: isString ? 'string' : 'json',
        userProperties: {
          instance: instance,
          timestamp: timestamp.toJSON()
        }
      }
    };

    return [topic, message, opts];
  }

  public static decode(baseTopic: string, payload: Buffer, packet: mqtt.IPublishPacket): [level: Level, category: string, instance: string, timestamp: Date, data: Loggable[]] {
    const [rawLevel, category] = packet.topic.replace(baseTopic, '').split('/', 2) as [Levels, string];
    const level = levelLookup[rawLevel];
    const instance = packet.properties?.userProperties?.instance as string;
    const timestamp = new Date(packet.properties?.userProperties?.timestamp as string);
    const message = payload.toString();
    const data: Loggable[] = packet.properties?.contentType === 'string' ? [message] : JSON.parse(message);

    return [level, category, instance, timestamp, data];
  }
}
