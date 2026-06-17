import { Injectable } from '@nestjs/common';
import { filter, map, Observable, Subject } from 'rxjs';

interface RealtimeEvent {
  channel: string; // e.g. tracking:<publicToken>
  data: unknown;
}

/**
 * Lightweight in-process pub/sub for Server-Sent Events (tracking portal).
 * For multi-replica deployments back this with a Redis pub/sub adapter.
 */
@Injectable()
export class RealtimeService {
  private readonly stream = new Subject<RealtimeEvent>();

  publish(channel: string, data: unknown) {
    this.stream.next({ channel, data });
  }

  subscribe(channel: string): Observable<{ data: unknown }> {
    return this.stream.asObservable().pipe(
      filter((e) => e.channel === channel),
      map((e) => ({ data: e.data })),
    );
  }
}
