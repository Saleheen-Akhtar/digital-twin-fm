import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { AssetsService, ListAssetsFilter } from './assets.service';
import { AssetDto } from './dto/asset.dto';

@Controller('assets')
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get()
  findAll(@Query() q: ListAssetsFilter): Promise<AssetDto[]> {
    return this.service.findAll(q);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AssetDto> {
    const a = await this.service.findOne(id);
    if (!a) throw new NotFoundException(`Asset ${id} not found`);
    return a;
  }
}
