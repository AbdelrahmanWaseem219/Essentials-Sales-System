'use client';

/**
 * Root error boundary — catches errors in the root layout itself. Replaces the
 * whole document, so it uses inline styles (global CSS may not be mounted).
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px',
          background: '#0a0c0e',
          color: '#fff',
          textAlign: 'center',
          padding: '24px',
          margin: 0,
        }}
      >
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ opacity: 0.7, margin: 0 }}>Please reload the page to continue.</p>
        <button
          onClick={() => reset()}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: '#fff',
            color: '#0a0c0e',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
