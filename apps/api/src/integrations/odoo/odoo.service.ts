import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OdooClient } from './odoo.client';

export interface OdooProduct {
  id: number;
  name: string;
  default_code: string | false;
  list_price: number;
  qty_available: number;
}

export interface OdooWarehouse {
  id: number;
  name: string;
  code: string;
  delivery_steps: 'ship_only' | 'pick_ship' | 'pick_pack_ship';
  lot_stock_id: [number, string];
  wh_pack_stock_loc_id: [number, string] | false;
  wh_output_stock_loc_id: [number, string] | false;
  pick_type_id: [number, string] | false;
  pack_type_id: [number, string] | false;
  out_type_id: [number, string];
}

interface ChainStep {
  type: number; // picking type id
  src: number; // source location id
  dest: number; // dest location id
  mto: boolean; // make_to_order (supplied by upstream step)
}

interface PushLine {
  sku: string;
  name: string;
  quantity: number;
}

interface PushPartner {
  name: string;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
}

/**
 * Inventory-only Odoo operations. Reads catalog/stock/warehouses and writes
 * approved orders as OUTGOING stock pickings (deliveries) — never sale.order.
 * See docs/ODOO_INTEGRATION.md.
 */
@Injectable()
export class OdooService {
  private readonly logger = new Logger(OdooService.name);
  private readonly cacheTtl: number;

  constructor(
    private readonly odoo: OdooClient,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.cacheTtl = config.get<number>('odoo.cacheTtl')!;
  }

  // ── Reads ───────────────────────────────────────────

  async getProductBySku(sku: string, useCache = true): Promise<OdooProduct | null> {
    if (useCache) {
      const cached = await this.prisma.odooProductCache.findUnique({ where: { sku } });
      if (cached && Date.now() - cached.refreshedAt.getTime() < this.cacheTtl * 1000) {
        return {
          id: cached.odooProductId,
          name: cached.name,
          default_code: sku,
          list_price: Number(cached.price ?? 0),
          qty_available: Number(cached.qtyAvailable ?? 0),
        };
      }
    }

    const [product] = await this.odoo.searchRead<OdooProduct>(
      'product.product',
      [['default_code', '=', sku]],
      ['id', 'name', 'default_code', 'list_price', 'qty_available'],
      { limit: 1 },
    );
    if (!product) return null;

    await this.prisma.odooProductCache.upsert({
      where: { sku },
      update: {
        odooProductId: product.id,
        name: product.name,
        price: product.list_price,
        qtyAvailable: product.qty_available,
        refreshedAt: new Date(),
      },
      create: {
        sku,
        odooProductId: product.id,
        name: product.name,
        price: product.list_price,
        qtyAvailable: product.qty_available,
      },
    });
    return product;
  }

  async getStockAvailability(sku: string): Promise<number> {
    const product = await this.getProductBySku(sku, false);
    return product?.qty_available ?? 0;
  }

  /**
   * Resolve an order line to an Odoo product. Tries SKU (default_code) first;
   * if that's missing/placeholder/unmatched, falls back to matching by product
   * NAME against the Shopify line-item title (exact, then case-insensitive).
   * This is what lets orders flow to Odoo even though most Shopify products
   * have no SKU — the Odoo product names mirror the Shopify titles.
   */
  async resolveProduct(sku: string, name?: string): Promise<OdooProduct | null> {
    const fields = ['id', 'name', 'default_code', 'list_price', 'qty_available'];

    // 1. By SKU (default_code) — only for real-looking SKUs (skip blanks and
    //    common placeholders so they don't mask a needed manual review).
    const s = (sku ?? '').trim();
    if (s && !/^(nosku-|n\/?a|-+|0+|sku|tbd)$/i.test(s) && !s.startsWith('NOSKU-')) {
      const bySku = await this.getProductBySku(s, false);
      if (bySku) return bySku;
    }

    // 2. By product name. NEVER pick arbitrarily among look-alikes/variants —
    //    only accept a SINGLE match; ambiguity returns null so the order is held
    //    for manual review instead of silently shipping the wrong item.
    const title = name?.trim();
    if (!title) return null;
    // Escape pattern wildcards so a title with % or _ can't widen the match.
    const escaped = title.replace(/([\\%_])/g, '\\$1');

    // Exact (case-sensitive), then case-insensitive exact, then "contains" —
    // each must resolve to exactly one product.
    const domains: unknown[][] = [
      [['name', '=', title]],
      [['name', '=ilike', escaped]],
      [['name', 'ilike', escaped]],
    ];
    for (const domain of domains) {
      const rows = await this.odoo.searchRead<OdooProduct>('product.product', domain, fields, {
        limit: 2,
      });
      if (rows.length === 1) return rows[0];
      if (rows.length > 1) {
        this.logger.warn(
          `Ambiguous Odoo match for "${title}" (${rows.length}+ products) — not guessing; order will hold`,
        );
        return null;
      }
    }
    return null;
  }

  async listWarehouses(): Promise<OdooWarehouse[]> {
    return this.odoo.searchRead<OdooWarehouse>(
      'stock.warehouse',
      [],
      [
        'id',
        'name',
        'code',
        'delivery_steps',
        'lot_stock_id',
        'wh_pack_stock_loc_id',
        'wh_output_stock_loc_id',
        'pick_type_id',
        'pack_type_id',
        'out_type_id',
      ],
    );
  }

  async searchProducts(query: string, limit = 20): Promise<OdooProduct[]> {
    return this.odoo.searchRead<OdooProduct>(
      'product.product',
      ['|', ['name', 'ilike', query], ['default_code', 'ilike', query]],
      ['id', 'name', 'default_code', 'list_price', 'qty_available'],
      { limit },
    );
  }

  // ── Writes: approved order → outgoing delivery ──────

  /**
   * Push an approved order to Odoo Inventory. For a multi-step warehouse this
   * explicitly creates the full Pick → Pack → Delivery chain (linked via
   * move_dest_ids) so staff validate each transfer in sequence; validating the
   * final Delivery is what (via an Odoo automation webhook) triggers the Bosta
   * shipment. Returns the FINAL delivery picking id (stored on the order).
   * Never uses sale.order. Idempotency is the caller's responsibility.
   */
  async pushDelivery(params: {
    origin: string;
    partner: PushPartner;
    lines: PushLine[];
    warehouseId?: number;
  }): Promise<number> {
    const warehouse = await this.resolveWarehouse(params.warehouseId);
    const partnerId = await this.resolvePartner(params.partner);
    const customerLoc = await this.customerLocationId();
    const steps = this.deliveryChain(warehouse, customerLoc);

    // Resolve each line's product + unit of measure up front.
    const resolved = [] as { line: PushLine; productId: number; uomId?: number }[];
    for (const line of params.lines) {
      const product = await this.resolveProduct(line.sku, line.name);
      if (!product) {
        throw new NotFoundException(
          `Could not match line "${line.name}" (SKU "${line.sku}") to an Odoo product by SKU or name`,
        );
      }
      const [pdata] = await this.odoo.searchRead<{ uom_id: [number, string] | false }>(
        'product.product',
        [['id', '=', product.id]],
        ['uom_id'],
        { limit: 1 },
      );
      resolved.push({
        line,
        productId: product.id,
        uomId: Array.isArray(pdata?.uom_id) ? pdata.uom_id[0] : undefined,
      });
    }

    // Create pickings from the LAST step (Delivery) back to the FIRST (Pick),
    // chaining each upstream move to the downstream one via move_dest_ids.
    let downstreamMoveByLine: (number | null)[] = resolved.map(() => null);
    const pickingIds: number[] = [];
    let deliveryPickingId = 0;
    let firstPickingId = 0;

    for (let s = steps.length - 1; s >= 0; s--) {
      const seg = steps[s];
      const moveCmds = resolved.map((r, idx) => [
        0,
        0,
        {
          description_picking: r.line.name,
          product_id: r.productId,
          product_uom_qty: r.line.quantity,
          ...(r.uomId ? { uom_id: r.uomId } : {}),
          procure_method: seg.mto ? 'make_to_order' : 'make_to_stock',
          location_id: seg.src,
          location_dest_id: seg.dest,
          ...(downstreamMoveByLine[idx]
            ? { move_dest_ids: [[6, 0, [downstreamMoveByLine[idx]]]] }
            : {}),
        },
      ]);

      const pickingId = await this.odoo.create('stock.picking', {
        partner_id: partnerId,
        picking_type_id: seg.type,
        location_id: seg.src,
        location_dest_id: seg.dest,
        origin: params.origin,
        move_ids: moveCmds,
      });
      pickingIds.push(pickingId);
      if (s === steps.length - 1) deliveryPickingId = pickingId;
      firstPickingId = pickingId;

      // Read back this picking's moves so the next (upstream) step can link to
      // them. Order by id so the read order matches creation order — otherwise
      // two lines sharing one product/SKU could get cross-linked.
      const moves = await this.odoo.searchRead<{ id: number; product_id: [number, string] }>(
        'stock.move',
        [['picking_id', '=', pickingId]],
        ['id', 'product_id'],
        { order: 'id' },
      );
      const used = new Set<number>();
      downstreamMoveByLine = resolved.map((r) => {
        const m = moves.find(
          (mv) => Array.isArray(mv.product_id) && mv.product_id[0] === r.productId && !used.has(mv.id),
        );
        if (m) used.add(m.id);
        return m ? m.id : null;
      });
    }

    // Confirm every transfer (sets the chain to confirmed/waiting), then try to
    // reserve stock on the first (Pick) step.
    for (const pid of pickingIds) {
      await this.odoo
        .callMethod('stock.picking', 'action_confirm', [pid])
        .catch((e) => this.logger.warn(`action_confirm failed for picking ${pid}: ${e}`));
    }
    await this.odoo.callMethod('stock.picking', 'action_assign', [firstPickingId]).catch(() => undefined);

    // Pre-fill the "Done" quantity on every move so each transfer is immediately
    // ready to Validate without manual entry — suited to a no-stock / special-order
    // model where Odoo can't reserve from on-hand stock.
    for (const pid of pickingIds) {
      const moves = await this.odoo.searchRead<{ id: number; product_uom_qty: number }>(
        'stock.move',
        [['picking_id', '=', pid]],
        ['id', 'product_uom_qty'],
      );
      for (const m of moves) {
        await this.odoo
          .write('stock.move', [m.id], { quantity: m.product_uom_qty })
          .catch(() => undefined);
      }
    }

    this.logger.log(
      `Created Odoo ${steps.length}-step chain for ${params.origin}; delivery picking=${deliveryPickingId}`,
    );
    return deliveryPickingId;
  }

  /** Build the location/operation chain for the warehouse's delivery_steps. */
  private deliveryChain(wh: OdooWarehouse, customerLoc: number): ChainStep[] {
    const stock = wh.lot_stock_id[0];
    const out = wh.out_type_id[0];
    const pack = Array.isArray(wh.wh_pack_stock_loc_id) ? wh.wh_pack_stock_loc_id[0] : undefined;
    const output = Array.isArray(wh.wh_output_stock_loc_id) ? wh.wh_output_stock_loc_id[0] : undefined;
    const pickType = Array.isArray(wh.pick_type_id) ? wh.pick_type_id[0] : undefined;
    const packType = Array.isArray(wh.pack_type_id) ? wh.pack_type_id[0] : undefined;

    if (wh.delivery_steps === 'pick_pack_ship' && pickType && packType && pack && output) {
      return [
        { type: pickType, src: stock, dest: pack, mto: false },
        { type: packType, src: pack, dest: output, mto: true },
        { type: out, src: output, dest: customerLoc, mto: true },
      ];
    }
    if (wh.delivery_steps === 'pick_ship' && pickType && output) {
      return [
        { type: pickType, src: stock, dest: output, mto: false },
        { type: out, src: output, dest: customerLoc, mto: true },
      ];
    }
    // ship_only (single step)
    return [{ type: out, src: stock, dest: customerLoc, mto: false }];
  }

  async cancelDelivery(pickingId: number): Promise<void> {
    await this.odoo.callMethod('stock.picking', 'action_cancel', [pickingId]);
  }

  /** Read a picking's state ('draft'|'waiting'|'confirmed'|'assigned'|'done'|'cancel'). */
  async getPickingState(pickingId: number): Promise<string | null> {
    const [p] = await this.odoo.searchRead<{ state: string }>(
      'stock.picking',
      [['id', '=', pickingId]],
      ['state'],
      { limit: 1 },
    );
    return p?.state ?? null;
  }

  // ── private helpers ─────────────────────────────────

  private async resolveWarehouse(warehouseId?: number): Promise<OdooWarehouse> {
    const warehouses = await this.listWarehouses();
    if (!warehouses.length) throw new NotFoundException('No Odoo warehouse configured');
    if (warehouseId) {
      const found = warehouses.find((w) => w.id === warehouseId);
      if (found) return found;
    }
    return warehouses[0];
  }

  private async customerLocationId(): Promise<number> {
    const [loc] = await this.odoo.searchRead<{ id: number }>(
      'stock.location',
      [['usage', '=', 'customer']],
      ['id'],
      { limit: 1 },
    );
    if (!loc) throw new NotFoundException('No customer stock location found in Odoo');
    return loc.id;
  }

  /** Find an existing res.partner by phone/email, else create one (Contacts, not CRM). */
  private async resolvePartner(partner: PushPartner): Promise<number> {
    const domain: unknown[] = [];
    if (partner.email) domain.push(['email', '=', partner.email]);
    if (partner.phone) {
      if (domain.length) domain.unshift('|');
      domain.push(['phone', '=', partner.phone]);
    }
    if (domain.length) {
      const [existing] = await this.odoo.searchRead<{ id: number }>('res.partner', domain, ['id'], {
        limit: 1,
      });
      if (existing) return existing.id;
    }
    // NOTE: `customer_rank` is added by Odoo's Sales/Accounting modules, which we
    // intentionally don't use — so it doesn't exist here. Inventory only needs a
    // plain contact (res.partner).
    return this.odoo.create('res.partner', {
      name: partner.name,
      email: partner.email ?? false,
      phone: partner.phone ?? false,
      street: partner.street ?? false,
      city: partner.city ?? false,
    });
  }
}
