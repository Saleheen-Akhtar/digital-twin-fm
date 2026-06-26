import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
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

  @Post('copilot/query/stream')
  async queryStream(@Body() req: CopilotQueryRequest, @Res() expressRes: Response) {
    const aiServiceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:8000',
    );
    const url = `${aiServiceUrl}/ai/copilot/query/stream`;

    this.logger.log(`Streaming proxy to ai-service: POST ${url}`);

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      this.logger.error(`ai-service stream error (${upstream.status}): ${text.slice(0, 200)}`);
      throw new HttpException(
        `ai-service returned ${upstream.status}: ${text.slice(0, 200)}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    // Pipe the SSE stream through to the caller
    expressRes.setHeader('Content-Type', 'text/event-stream');
    expressRes.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    expressRes.setHeader('X-Accel-Buffering', 'no');
    expressRes.setHeader('Connection', 'keep-alive');

    const reader = upstream.body?.getReader();
    if (!reader) {
      throw new HttpException('Empty upstream body', HttpStatus.BAD_GATEWAY);
    }

    const pump = async () => {
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            expressRes.end();
            return;
          }
          expressRes.write(value);
        }
      } catch (err) {
        this.logger.error('stream read error', err);
        expressRes.end();
      }
    };

    pump();
  }
}
