import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCustomerDto, CreateNoteDto, CustomerQueryDto, UpsertAddressDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(q: CustomerQueryDto) {
    const where: Prisma.CustomerWhereInput = {};
    if (q.search) {
      where.OR = [
        { firstName: { contains: q.search, mode: 'insensitive' } },
        { lastName: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search } },
      ];
    }
    const [total, data] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { data, total, page: q.page, pageSize: q.pageSize };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        customerNotes: { include: { author: true }, orderBy: { createdAt: 'desc' } },
        orders: {
          orderBy: { placedAt: 'desc' },
          include: { payments: true, shipments: true },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /** Aggregated history / lifetime stats for a customer profile. */
  async history(id: string) {
    const [orderCount, agg] = await this.prisma.$transaction([
      this.prisma.order.count({ where: { customerId: id } }),
      this.prisma.order.aggregate({
        where: { customerId: id, status: { notIn: ['CANCELLED', 'REJECTED'] } },
        _sum: { grandTotal: true },
        _max: { placedAt: true },
        _min: { placedAt: true },
      }),
    ]);
    return {
      orderCount,
      lifetimeValue: agg._sum.grandTotal ?? 0,
      firstOrderAt: agg._min.placedAt,
      lastOrderAt: agg._max.placedAt,
    };
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  async update(id: string, dto: CreateCustomerDto) {
    await this.assertExists(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  // ── addresses ───────────────────────────────────────
  async addAddress(customerId: string, dto: UpsertAddressDto) {
    await this.assertExists(customerId);
    if (dto.isDefault) {
      await this.prisma.address.updateMany({ where: { customerId }, data: { isDefault: false } });
    }
    return this.prisma.address.create({ data: { customerId, ...dto } });
  }

  async updateAddress(addressId: string, dto: UpsertAddressDto) {
    return this.prisma.address.update({ where: { id: addressId }, data: dto });
  }

  deleteAddress(addressId: string) {
    return this.prisma.address.delete({ where: { id: addressId } });
  }

  // ── notes ───────────────────────────────────────────
  async addNote(customerId: string, authorId: string, dto: CreateNoteDto) {
    await this.assertExists(customerId);
    return this.prisma.customerNote.create({
      data: { customerId, authorId, body: dto.body },
    });
  }

  private async assertExists(id: string) {
    const c = await this.prisma.customer.count({ where: { id } });
    if (!c) throw new NotFoundException('Customer not found');
  }
}
