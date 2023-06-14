import * as mqtt from 'mqtt';
import {MqttAppender} from './appender';
import {Config} from './config';
import {Logger} from './logger';
import {IManager, Manager} from './manager';

export class Client {
  protected readonly manager: IManager;
  protected readonly client: mqtt.Client;
  protected readonly topic: string;

  public constructor(url: string, username: string, password: string, topic: string, config: Config) {
    this.manager = new Manager(config);
    this.client = mqtt.connect(url, {
      username: username,
      password: password,
      protocolVersion: 5
    });

    this.client.on('message', (_topic, payload, packet) => this.handleMessage(payload, packet));

    const normalizedTopic = '/' + topic.split('/').filter(v => v.length > 0).join('/') + '/';
    this.client.subscribe(normalizedTopic + '#');
    this.topic = normalizedTopic;
  }

  protected handleMessage(payload: Buffer, packet: mqtt.IPublishPacket): void {
    const [level, category, instance, timestamp, data] = MqttAppender.decode(this.topic, payload, packet);

    const logger = this.manager.getLogger(category);

    if (logger instanceof Logger || 'append' in logger) {
      logger.append(level, instance, timestamp, ...data);
    }
  }
}
