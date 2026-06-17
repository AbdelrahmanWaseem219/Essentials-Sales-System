export interface OutboundMessage {
  to: string;
  subject?: string;
  body: string;
}

export interface NotificationChannelAdapter {
  readonly name: 'EMAIL' | 'SMS' | 'WHATSAPP';
  send(msg: OutboundMessage): Promise<void>;
}
