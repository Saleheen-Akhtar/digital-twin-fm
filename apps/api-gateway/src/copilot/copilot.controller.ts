import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/jwt-auth.guard';

interface CopilotQueryRequest {
  question: string;
  building_id?: string;
  context?: Record<string, unknown>;
}

interface CopilotQueryResponse {
  answer: string;
  sources: unknown[];
  model: string;
  stub: boolean;
}

@Public()
@Controller('ai')
export class CopilotController {
  private readonly logger = new Logger(CopilotController.name);

  constructor(private configService: ConfigService) {}

  @Post('copilot/query')
  async query(@Body() req: CopilotQueryRequest): Promise<CopilotQueryResponse> {
    const aiServiceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:8000',
    );
    const url = `${aiServiceUrl}/ai/copilot/query`;

    this.logger.log(`Proxying to ai-service: POST ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`ai-service error (${res.status}): ${text.slice(0, 200)}`);
      throw new HttpException(
        `ai-service returned ${res.status}: ${text.slice(0, 200)}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return res.json() as Promise<CopilotQueryResponse>;
  }
}
