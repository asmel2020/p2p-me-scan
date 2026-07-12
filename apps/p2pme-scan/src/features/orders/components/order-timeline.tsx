import type { OrderEvent } from '../types';

interface OrderTimelineProps {
  events: OrderEvent[];
}

type StageName = 'OrderPlaced' | 'OrderAccepted' | 'BuyOrderPaid' | 'OrderCompleted' | 'CancelledOrders';

const stageOrder: StageName[] = ['OrderPlaced', 'OrderAccepted', 'BuyOrderPaid', 'OrderCompleted'];

const stageLabels: Record<StageName, string> = {
  OrderPlaced: 'Order Placed',
  OrderAccepted: 'Order Accepted',
  BuyOrderPaid: 'Payment Sent',
  OrderCompleted: 'Completed',
  CancelledOrders: 'Cancelled',
};

export function OrderTimeline({ events }: OrderTimelineProps) {
  const hasCancelled = events.some(e => e.eventName === 'CancelledOrders');
  const eventMap = new Map(events.map(e => [e.eventName, e]));

  const visibleStages = hasCancelled
    ? stageOrder.filter(s => s !== 'BuyOrderPaid' && s !== 'OrderCompleted')
    : stageOrder;

  const allSteps: StageName[] = [...visibleStages];
  if (hasCancelled) {
    allSteps.push('CancelledOrders');
  }

  return (
    <div style={{ padding: '0.5rem 0' }}>
      {allSteps.map((stageName, index) => {
        const event = eventMap.get(stageName);
        const isActive = !!event;
        const isLast = index === allSteps.length - 1;
        const isCancelled = stageName === 'CancelledOrders';
        const circleBg = isCancelled
          ? 'var(--color-destructive)'
          : isActive
            ? 'var(--color-primary)'
            : 'var(--color-muted)';
        const circleColor = isCancelled
          ? 'white'
          : isActive
            ? 'var(--color-primary-foreground)'
            : 'var(--color-muted-foreground)';
        const labelColor = isCancelled
          ? 'var(--color-destructive)'
          : isActive
            ? 'var(--color-foreground)'
            : 'var(--color-muted-foreground)';

        return (
          <div key={stageName} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: circleBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6875rem', fontWeight: 600,
                color: circleColor,
                flexShrink: 0, zIndex: 1,
                transition: 'all 0.2s',
              }}>
                {isCancelled ? '✕' : isActive ? '✓' : String(index + 1)}
              </div>
              {!isLast && (
                <div style={{
                  width: 2, flex: 1,
                  background: isActive && !isCancelled ? 'var(--color-primary)' : 'var(--color-border)',
                  minHeight: 24,
                }} />
              )}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : '1.5rem', flex: 1 }}>
              <div style={{
                fontWeight: 600, fontSize: '0.8125rem',
                color: labelColor,
              }}>
                {stageLabels[stageName]}
              </div>
              {event && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-muted-foreground)', marginTop: '0.125rem' }}>
                  {new Date(event.createdAt.replace(" ", "T") + "Z").toLocaleString()}
                  {' · '}
                  <a href={`https://basescan.org/tx/${event.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontFamily: 'monospace' }}>
                    {event.txHash.slice(0, 12)}...
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
