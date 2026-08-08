// Frontpage for the presenter only. Players never type a code — they scan the QR.

interface Props {
  onHost: () => void
  hosting: boolean
  error: string | null
}

export function Landing({ onHost, hosting, error }: Props) {
  return (
    <div className="screen landing">
      <div className="landing-brand">
        <h1 className="landing-title">PLUG-N-PAY</h1>
        <p className="landing-tag">Host screen · scan-to-join · one round</p>
      </div>

      <div className="landing-actions">
        <button className="primary landing-host" onClick={onHost} disabled={hosting}>
          {hosting ? 'OPENING LOBBY…' : 'OPEN HOST LOBBY'}
        </button>
        <p className="landing-host-hint label">
          Open this page from the Render URL (not localhost), put it on the projector,
          share the QR, then start when the room is ready.
        </p>
        {error && <p className="landing-error">{error}</p>}
      </div>
    </div>
  )
}
