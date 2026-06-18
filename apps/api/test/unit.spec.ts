/**
 * Starter unit test suite. Uses Node's built-in test runner (node:test) executed
 * via ts-node — zero extra dependencies, so it's stable on this machine.
 *
 * Run:  pnpm --filter @essentials/api test   (→ ts-node test/unit.spec.ts)
 *
 * Covers the pure, high-value logic that other behavior depends on. Extend with
 * more files as the system grows (e.g. order-workflow transitions, mappers).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBostaState } from '../src/integrations/bosta/bosta.mapper';
import { renderTemplate } from '../src/notifications/templates';

test('mapBostaState: delivered', () => {
  assert.equal(mapBostaState({ code: 45 }), 'DELIVERED');
  assert.equal(mapBostaState({ value: 'Delivered' }), 'DELIVERED');
});

test('mapBostaState: received at warehouse → PICKED_UP', () => {
  assert.equal(mapBostaState({ code: 21 }), 'PICKED_UP');
  assert.equal(mapBostaState({ value: 'Received at warehouse' }), 'PICKED_UP');
});

test('mapBostaState: in transit / out for delivery', () => {
  assert.equal(mapBostaState({ code: 24 }), 'IN_TRANSIT');
  assert.equal(mapBostaState({ code: 41 }), 'OUT_FOR_DELIVERY');
});

test('mapBostaState: returned / cancelled / exception', () => {
  assert.equal(mapBostaState({ value: 'Returned to business' }), 'RETURNED');
  assert.equal(mapBostaState({ value: 'Canceled' }), 'CANCELLED');
  assert.equal(mapBostaState({ value: 'Exception occurred' }), 'EXCEPTION');
});

test('mapBostaState: unknown/empty defaults to CREATED (no false downgrade signal)', () => {
  assert.equal(mapBostaState({ value: 'something brand new' }), 'CREATED');
  assert.equal(mapBostaState(undefined), 'CREATED');
});

test('renderTemplate: SHIPMENT_IN_WAREHOUSE has the warehouse copy + order number', () => {
  const { subject, body } = renderTemplate('SHIPMENT_IN_WAREHOUSE', {
    orderNumber: 'ES-10001',
    customerName: 'Sam',
  });
  assert.match(subject, /ES-10001/);
  assert.match(body, /warehouse/i);
});

test('renderTemplate: DELIVERED + SHIPMENT_CREATED render expected subjects', () => {
  assert.match(renderTemplate('DELIVERED', { orderNumber: 'ES-9' }).subject, /delivered/i);
  assert.match(
    renderTemplate('SHIPMENT_CREATED', { orderNumber: 'ES-9', trackingNumber: 'T1' }).subject,
    /shipped/i,
  );
});
