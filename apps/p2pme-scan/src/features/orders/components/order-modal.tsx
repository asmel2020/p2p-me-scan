import { useState } from 'react';
import { useOrder } from '../hooks/useOrders';
import { OrderTimeline } from './order-timeline';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { Order } from '../types';

function formatLocal(iso: string) {
  return new Date(iso).toLocaleString();
}

interface OrderModalProps {
  order: Order | null;
  onClose: () => void;
}

const statusLabels: Record<string, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  paid: 'Paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const typeLabels: Record<string, string> = {
  BUY: 'Buy',
  SELL: 'Sell',
  RENT: 'Rent',
};

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
  placed: 'default',
  accepted: 'default',
  paid: 'warning',
  completed: 'success',
  cancelled: 'destructive',
};

export function OrderModal({ order, onClose }: OrderModalProps) {
  const { data: orderDetail, isLoading } = useOrder(order?.orderId ?? 0);
  const [showShare, setShowShare] = useState(false);

  if (!order) return null;

  const shareUrl = `${window.location.origin}/?orderId=${order.orderId}`;
  const shareText = `P2P Order ${String(order.orderId).slice(0, 8)}… | ${typeLabels[order.orderType] || order.orderType} · ${order.usdc} USDC · ${order.fiat} ${order.currency}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => setShowShare(false));
  };

  const shareLinks = [
    {
      name: 'Telegram',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
      url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'WhatsApp',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
      url: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
    },
  ];

  return (
    <Dialog open={!!order} onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <DialogContent>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1 }}>
            <DialogTitle style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              Order Details
            </DialogTitle>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)', fontFamily: 'monospace', marginTop: '0.125rem', wordBreak: 'break-all' }}>
              {order.orderId}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.125rem' }}>
            <Badge variant={statusVariant[order.status] || 'default'}>
              {statusLabels[order.status] || order.status}
            </Badge>
            <button
              onClick={() => setShowShare(prev => !prev)}
              title="Share"
              style={{
                width: 32, height: 32, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--color-muted)', border: 'none',
                borderRadius: '50%', cursor: 'pointer',
                color: 'var(--color-muted-foreground)',
                transition: 'color 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              title="Close"
              style={{
                width: 32, height: 32, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--color-muted)', border: 'none',
                borderRadius: '50%', cursor: 'pointer',
                color: 'var(--color-muted-foreground)',
                fontSize: '1rem', fontWeight: 600, lineHeight: 1,
                transition: 'color 0.15s',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {showShare && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 150 }}
              onClick={() => setShowShare(false)}
            />
            <div style={{
              position: 'absolute', top: '3.5rem', right: '2.5rem', zIndex: 200,
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '0.5rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              {shareLinks.map(link => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowShare(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)',
                    textDecoration: 'none', color: 'var(--color-foreground)',
                    fontSize: '0.8125rem', fontWeight: 500,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-muted)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {link.icon}
                  {link.name}
                </a>
              ))}
              <button
                onClick={handleCopyLink}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1rem', borderRadius: 'var(--radius-lg)',
                  border: 'none', background: 'transparent', width: '100%',
                  color: 'var(--color-foreground)', cursor: 'pointer',
                  fontSize: '0.8125rem', fontWeight: 500,
                  fontFamily: 'inherit', transition: 'background 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Copy Link
              </button>
            </div>
          </>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '1px', overflow: 'hidden', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)', marginBottom: '1.5rem',
        }}>
          <DetailRow label="Type" value={typeLabels[order.orderType] || order.orderType} />
          <DetailRow label="Order Type" value={order.orderType} />
          <DetailRow label="USDC Amount" value={`${order.usdc.toLocaleString()} USDC`} />
          <DetailRow label="Fiat Amount" value={`${order.fiat.toLocaleString()} ${order.currency}`} />
          <DetailRow label="User" value={order.user} mono href={`https://basescan.org/address/${order.user}`} />
          <DetailRow label="Merchant" value={order.merchant} mono href={order.merchant !== '-' ? `https://basescan.org/address/${order.merchant}` : undefined} />
          <DetailRow label="Recipient" value={order.recipientAddr} mono href={order.recipientAddr !== '-' ? `https://basescan.org/address/${order.recipientAddr}` : undefined} />
          <DetailRow label="Accepted Merchant" value={order.acceptedMerchant} mono href={order.acceptedMerchant !== '-' ? `https://basescan.org/address/${order.acceptedMerchant}` : undefined} />
          <DetailRow label="Created Block" value={`#${order.createdBlock}`} href={`https://basescan.org/block/${order.createdBlock}`} />
          <DetailRow label="Updated Block" value={`#${order.updatedBlock}`} href={`https://basescan.org/block/${order.updatedBlock}`} />
          <DetailRow label="Block Timestamp" value={formatLocal(order.blockTimestamp)} />
          <DetailRow label="Updated At" value={formatLocal(order.updatedAt)} />
        </div>

        <h3 style={{
          fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 1rem',
          color: 'var(--color-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Order Stages
        </h3>

        {isLoading ? (
          <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--color-muted-foreground)', fontSize: '0.875rem' }}>
            Loading events...
          </div>
        ) : orderDetail?.events ? (
          <OrderTimeline events={orderDetail.events} />
        ) : (
          <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--color-muted-foreground)', fontSize: '0.875rem' }}>
            No events available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value, mono, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  const displayValue = value.length > 36 ? `${value.slice(0, 18)}...${value.slice(-6)}` : value;
  const content = href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
      {displayValue}
    </a>
  ) : (
    displayValue
  );
  return (
    <div style={{
      padding: '0.75rem 1rem',
      background: 'var(--color-background)',
      display: 'flex', flexDirection: 'column', gap: '0.125rem',
    }}>
      <span style={{ fontSize: '0.6875rem', color: 'var(--color-muted-foreground)' }}>{label}</span>
      <span style={{
        fontSize: '0.8125rem', fontWeight: 600,
        fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: 'break-all',
      }}>
        {content}
      </span>
    </div>
  );
}
