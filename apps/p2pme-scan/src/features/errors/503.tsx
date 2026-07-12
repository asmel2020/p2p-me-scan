import { useNavigate } from '@tanstack/react-router';

export function ServiceUnavailableError() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '5rem', fontWeight: 800, color: 'var(--color-warning)', lineHeight: 1, marginBottom: '0.5rem' }}>503</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Service Unavailable</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-muted-foreground)', margin: '0 0 1.5rem', maxWidth: 360 }}>The service is temporarily unavailable. Please try again later.</p>
        <button onClick={() => navigate({ to: '/', search: { cursor: undefined, limit: 25 } })} style={{ padding: '0.5rem 1.5rem', background: 'var(--color-primary)', color: 'var(--color-primary-foreground)', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>Back to Home</button>
      </div>
    </div>
  );
}
