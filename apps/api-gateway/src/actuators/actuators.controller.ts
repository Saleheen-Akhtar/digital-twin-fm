import { Controller, Post, Param, Body, NotFoundException } from '@nestjs/common';
import { ActuatorsService } from './actuators.service';
import { SendCommandDto } from './dto/send-command.dto';

@Controller('actuators')
export class ActuatorsController {
  constructor(private readonly service: ActuatorsService) {}

  @Post(':id/command')
  async sendCommand(
    @Param('id') id: string,
    @Body() dto: SendCommandDto,
  ) {
    const result = await this.service.sendCommand(id, dto.command, dto.value, dto.unit);
    return { ok: true, ...result };
  }
}
