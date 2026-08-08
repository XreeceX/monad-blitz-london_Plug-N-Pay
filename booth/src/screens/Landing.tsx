// Frontpage for the presenter only. Players never type a code — they scan the QR.

interface Props {
  onHost: () => void
  hosting: boolean
  error: string | null
}

export function Landing({ onHost, hosting, error }: Props) {
  return (
    <div className="screen landing">
      <div className="landing-glow" aria-hidden />

      <div className="landing-center">
        <p className="label landing-eyebrow">Booth host</p>
        <h1 className="landing-title">Plug-N-Pay</h1>
        <p className="landing-tag">Scan to join · one round · simulated metering</p>

        <button className="primary landing-host" onClick={onHost} disabled={hosting}>
          {hosting ? 'Opening Lobby…' : 'Open Host Lobby'}
        </button>

        <p className="landing-host-hint">
          Open from the Render URL, put it on the projector, share the QR, then start
          when the room is ready.
        </p>

        {error && <p className="landing-error">{error}</p>}
      </div>
    </div>
  )
}
