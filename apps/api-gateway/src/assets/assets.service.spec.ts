import { Test } from '@nestjs/testing';
import { AssetsService } from './assets.service';
// 'db' was removed from @digital-twin-fm/db; using a minimal mock here
const db: any = {};

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
