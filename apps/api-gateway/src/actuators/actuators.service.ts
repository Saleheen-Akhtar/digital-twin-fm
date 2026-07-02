import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt from 'mqtt';

@Injectable()
export class ActuatorsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActuatorsService.name);
  private mqttClient: mqtt.MqttClient | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('MQTT_URL', '');
    if (!url) {
      this.logger.warn('MQTT_URL not set — actuator commands will be logged only');
      return;
    }
    this.mqttClient = mqtt.connect(url);
    this.mqttClient.on('connect', () => this.logger.log(`Connected to MQTT broker at ${url}`));
    this.mqttClient.on('error', (err) => this.logger.error({ err }, 'MQTT error'));
  }

  onModuleDestroy() {
    this.mqttClient?.end();
  }

  async sendCommand(actuatorId: string, command: string, value?: number, unit?: string): Promise<{ topic: string; payload: object }> {
    const topic = `actuators/${actuatorId}/command`;
    const payload = { command, value, unit, sentAt: new Date().toISOString() };

    if (this.mqttClient?.connected) {
      this.mqttClient.publish(topic, JSON.stringify(payload));
      this.logger.log(`Published to ${topic}: ${JSON.stringify(payload)}`);
    } else {
      // Log-only mode when MQTT is unavailable (dev / demo)
      this.logger.warn(`MQTT not connected — command would be published to ${topic}: ${JSON.stringify(payload)}`);
    }

    return { topic, payload };
  }
}
