import { Test } from '@nestjs/testing';
import { SensorsService } from './sensors.service';
// 'db' was removed from @digital-twin-fm/db; using a minimal mock here
const db: any = {};

describe('SensorsService', () => {
  let service: SensorsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SensorsService,
        { provide: 'DB', useValue: db },
      ],
    }).compile();
    service = module.get(SensorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
