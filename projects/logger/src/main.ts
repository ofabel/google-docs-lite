import * as wodss from '@fhnw/wodss-shared';
import config from '../log.json';

const host = process.env.WODSS_MQTT_HOST as string;
const port = process.env.WODSS_MQTT_PORT as string;
const protocol = process.env.WODSS_MQTT_PROTOCOL as string;
const path = process.env.WODSS_MQTT_PATH as string;
const username = process.env.WODSS_MQTT_USERNAME as string;
const password = process.env.WODSS_MQTT_PASSWORD as string;
const topic = process.env.WODSS_LOGGER_MQTT_TOPIC as string;

const url = `${protocol}://${host}:${port}${path}`;

new wodss.core.log.Client(url, username, password, topic, config as wodss.core.log.Config);
