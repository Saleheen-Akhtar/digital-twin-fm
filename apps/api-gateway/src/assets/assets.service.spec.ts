import { Test } from '@nestjs/testing';
import { AssetsService } from './assets.service';
import { db } from '@digital-twin-fm/db';

describe('AssetsService', () => {
  let service: AssetsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: 'DB', useValue: db },
      ],
    }).compile();
    service = module.get(AssetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
