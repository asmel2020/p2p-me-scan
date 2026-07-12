import { useState, type ReactNode } from 'react';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { fetchOrder } from '@/features/orders/api/orders';
import { OrderModal } from '@/features/orders/components/order-modal';
import type { Order } from '@/features/orders/types';

export function RootLayout({ children }: { children?: ReactNode }) {
  const [searchValue, setSearchValue] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState('');
  const navigate = useNavigate();

  const handleSearch = async () => {
    const q = searchValue.trim();
    if (!q) return;
    try {
      const detail = await fetchOrder(q);
      setSearchedOrder({
        id: detail.id,
        orderId: detail.orderId,
        user: detail.user,
        merchant: detail.merchant,
        recipientAddr: detail.recipientAddr,
        acceptedMerchant: detail.acceptedMerchant,
        usdc: detail.usdc,
        fiat: detail.fiat,
        orderType: detail.orderType,
        currency: detail.currency,
        status: detail.status,
        createdBlock: detail.createdBlock,
        updatedBlock: detail.updatedBlock,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
      });
      setSearchError('');
    } catch {
      setSearchError('Order not found');
    }
  };

  const handleCloseModal = () => {
    setSearchedOrder(null);
    setSearchValue('');
    setSearchError('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-card)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem',
          height: 60, display: 'flex', alignItems: 'center', gap: '2rem',
        }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flexShrink: 0 }}
            onClick={() => navigate({ to: '/', search: { cursor: undefined, limit: 25 } })}
          >
            <svg width="18" height="24" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.4992 0.92952H23.0781L23.0751 16.0377C23.0751 16.3142 23.0423 16.7652 22.9968 17.0381C22.3274 21.0307 19.4142 23.8918 15.3694 23.897C12.3353 23.9008 5.8469 23.897 5.8469 23.897C5.8469 23.897 5.84391 17.2669 5.84839 14.4051C5.85062 13.1401 6.72653 12.2045 7.94163 12.168C9.14181 12.1315 10.7945 12.1003 10.7945 12.1003V14.0868L15.959 10.285C15.959 10.285 10.5545 10.3251 7.90286 10.3998C5.54871 10.4661 4.02574 12.4528 4.06003 14.5162C4.11818 18.0713 4.07643 22.0893 4.07643 25.6451H12.839L9.54825 29.0705H0C0 29.0705 0.0069885 19.2774 0.00624305 14.4081C0.00624305 14.0622 0.0286067 13.7148 0.066625 13.3712C0.516881 9.30174 3.984 6.17008 8.07879 6.14771C10.9891 6.13206 17.1614 6.13891 17.1614 6.13891C17.1614 9.199 17.1629 12.6227 17.1614 15.6828C17.1607 16.9427 16.2475 17.8693 14.9922 17.8752C13.5929 17.8819 11.8491 17.8774 11.8491 17.8774V15.9505L7.07818 19.6472C7.07818 19.6472 12.1974 19.6845 15.0197 19.6472C17.3128 19.6166 18.9475 17.8872 18.9475 15.5844C18.9475 11.9913 18.9475 4.32731 18.9475 4.32731H10.2578L13.4992 0.92952Z" fill="var(--color-primary)" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-foreground)' }}>P2P.me Scan</span>
          </div>

          <div style={{ flex: 1, maxWidth: 480, position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by Order ID..."
              value={searchValue}
              onChange={e => { setSearchValue(e.target.value); setSearchError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              style={{
                width: '100%', padding: '0.5rem 1rem', paddingRight: '2.5rem',
                background: 'var(--color-background)',
                border: `1px solid ${searchError ? 'var(--color-destructive)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-lg)',
                color: 'var(--color-foreground)',
                fontSize: '0.8125rem', fontFamily: 'var(--font-outfit)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--color-muted-foreground)', padding: '0.25rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {searchError && (
              <div style={{ position: 'absolute', top: '100%', marginTop: 4, fontSize: '0.75rem', color: 'var(--color-destructive)' }}>
                {searchError}
              </div>
            )}
          </div>

          <span className="badge badge-success" style={{ flexShrink: 0 }}>Base Mainnet</span>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 1200, margin: '0 auto', padding: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
        {children ?? <Outlet />}
      </main>

      {searchedOrder && (
        <OrderModal order={searchedOrder} onClose={handleCloseModal} />
      )}
    </div>
  );
}
