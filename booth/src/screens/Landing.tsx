// Frontpage — host shares a QR, players join, or anyone can play solo.

interface Props {
  onHost: () => void
  onSolo: () => void
  joinCode: string
  onJoinCode: (v: string) => void
  onJoin: () => void
  joining: boolean
  error: string | null
}

export function Landing({ onHost, onSolo, joinCode, onJoinCode, onJoin, joining, error }: Props) {
  return (
    <div className="screen landing">
      <div className="landing-brand">
        <h1 className="landing-title">PLUG-N-PAY</h1>
        <p className="landing-tag">15-second charge race · same engine, simulation</p>
      </div>

      <div className="landing-actions">
        <button className="primary landing-host" onClick={onHost}>
          HOST THIS ROUND
        </button>
        <p className="landing-host-hint label">Put this on the big screen. Share the QR. Start when ready.</p>

        <div className="landing-divider">
          <span className="label">OR JOIN A ROOM</span>
        </div>

        <form
          className="landing-join"
          onSubmit={(e) => {
            e.preventDefault()
            onJoin()
          }}
        >
          <input
            className="num join-input"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={6}
            placeholder="ROOM CODE"
            value={joinCode}
            onChange={(e) => onJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
          <button type="submit" disabled={joinCode.length < 4 || joining}>
            {joining ? 'JOINING…' : 'JOIN'}
          </button>
        </form>
        {error && <p className="landing-error">{error}</p>}

        <button className="landing-solo" onClick={onSolo}>
          PLAY SOLO
        </button>
      </div>
    </div>
  )
}
