import OrderDetailView from './order-detail-view';

// The detail page is fully client-rendered (fetches the order by id at runtime).
// For static export we pre-build no instances; in server mode unknown ids render
// on demand. Either way the client view handles the actual data fetch.
// Static export needs at least one param. The page fetches its order client-side
// by the real id at runtime, so this placeholder shell is only used by the static
// host; in server mode the route still renders any id on demand.
export function generateStaticParams() {
  return [{ id: 'preview' }];
}

export default function Page() {
  return <OrderDetailView />;
}
