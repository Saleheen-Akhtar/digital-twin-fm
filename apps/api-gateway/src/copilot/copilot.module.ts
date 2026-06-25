import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CopilotController } from './copilot.controller';

@Module({
  imports: [ConfigModule],
  controllers: [CopilotController],
})
export class CopilotModule {}
