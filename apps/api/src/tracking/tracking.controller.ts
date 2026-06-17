import { Controller, Get, MessageEvent, NotFoundException, Param, Query, Sse } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { Public } from '../common/decorators/public.decorator';
import { RealtimeService } from '../common/realtime/realtime.service';
import { TrackingService } from './tracking.service';

/**
 * PUBLIC tracking portal API. Mounted outside /api at /track.
 * No auth — but lookups by order number require the customer to know the number,
 * and the SSE stream is keyed by an unguessable publicToken.
 */
@ApiTags('tracking')
@Public()
@Controller('track')
export class TrackingController {
  constructor(
    private readonly tracking: TrackingService,
    private readonly realtime: RealtimeService,
  ) {}

  /** GET /track/lookup?token=... | ?trackingNumber=... | ?orderNumber=... */
  @Get('lookup')
  lookup(
    @Query('token') token?: string,
    @Query('trackingNumber') trackingNumber?: string,
    @Query('orderNumber') orderNumber?: string,
  ) {
    if (!token && !trackingNumber && !orderNumber) {
      throw new NotFoundException('Provide a token, tracking number, or order number');
    }
    return this.tracking.lookup({ token, trackingNumber, orderNumber });
  }

  /** Real-time updates for a shipment via Server-Sent Events. */
  @Sse(':token/stream')
  async stream(@Param('token') token: string): Promise<Observable<MessageEvent>> {
    await this.tracking.resolveToken(token); // 404 if invalid
    return this.realtime.subscribe(`tracking:${token}`) as Observable<MessageEvent>;
  }
}
