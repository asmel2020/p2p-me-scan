import { useNavigate } from '@tanstack/react-router';

export function NotFoundError() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '5rem', fontWeight: 800, color: 'var(--color-warning)', lineHeight: 1, marginBottom: '0.5rem' }}>404</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Not Found</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-muted-foreground)', margin: '0 0 1.5rem', maxWidth: 360 }}>The page you're looking for doesn't exist.</p>
        <button onClick={() => navigate({ to: '/', search: { cursor: undefined, limit: 25 } })} style={{ padding: '0.5rem 1.5rem', background: 'var(--color-primary)', color: 'var(--color-primary-foreground)', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>Back to Home</button>
      </div>
    </div>
  );
}
