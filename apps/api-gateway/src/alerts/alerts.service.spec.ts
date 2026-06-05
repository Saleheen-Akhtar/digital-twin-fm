import { Test } from '@nestjs/testing';
import { AlertsService } from './alerts.service';
// 'db' was removed from @digital-twin-fm/db; using a minimal mock here
const db: any = {};

describe('AlertsService', () => {
  let service: AlertsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: 'DB', useValue: db },
      ],
    }).compile();
    service = module.get(AlertsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
