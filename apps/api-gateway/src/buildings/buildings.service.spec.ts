import { Test } from '@nestjs/testing';
import { BuildingsService } from './buildings.service';
import { db } from '@digital-twin-fm/db';

describe('BuildingsService', () => {
  let service: BuildingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BuildingsService,
        { provide: 'DB', useValue: db },
      ],
    }).compile();
    service = module.get(BuildingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
