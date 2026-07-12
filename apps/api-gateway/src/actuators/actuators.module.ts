import { Module } from '@nestjs/common';
import { ActuatorsController } from './actuators.controller';
import { ActuatorsService } from './actuators.service';

@Module({
  controllers: [ActuatorsController],
  providers: [ActuatorsService],
})
export class ActuatorsModule {}
