import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface BostaCreateDeliveryInput {
  type: number; // 10 = Send (forward delivery)
  cod: number; // cash on delivery amount (0 for prepaid)
  notes?: string;
  businessReference?: string; // our order number
  receiver: {
    firstName: string;
    lastName?: string;
    phone: string;
    email?: string;
  };
  dropOffAddress: {
    city: string; // Bosta city id or name
    zone?: string;
    firstLine: string;
    secondLine?: string;
  };
}

export interface BostaDelivery {
  _id: string;
  trackingNumber: string;
  state?: { value?: string; code?: number };
  cod?: number;
}

/** Thin Bosta REST client (Bosta API v2). */
@Injectable()
export class BostaClient {
  private readonly logger = new Logger(BostaClient.name);
  private readonly http: AxiosInstance;

  constructor(config: ConfigService) {
    this.http = axios.create({
      baseURL: config.get<string>('bosta.baseUrl'),
      headers: {
        Authorization: config.get<string>('bosta.apiKey')!,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  async createDelivery(input: BostaCreateDeliveryInput): Promise<BostaDelivery> {
    const { data } = await this.http.post('/deliveries', input);
    return data.data ?? data;
  }

  async trackDelivery(trackingNumber: string): Promise<any> {
    const { data } = await this.http.get(`/deliveries/business/${trackingNumber}`);
    return data.data ?? data;
  }

  async cancelDelivery(deliveryId: string): Promise<void> {
    await this.http.delete(`/deliveries/${deliveryId}`).catch((e) => {
      this.logger.warn(`Bosta cancel failed: ${e.message}`);
    });
  }
}
