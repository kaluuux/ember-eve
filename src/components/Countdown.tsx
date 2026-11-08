import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

/** Counts down to a date. `compact` gives a single line ("12 days 4 hours"); otherwise four boxes. */
export function Countdown({ to, compact }: { to: Date; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), compact ? 30000 : 1000);
    return () => window.clearInterval(id);
  }, [compact]);
  const ms = Math.max(0, to.getTime() - now);
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
  if (compact) return <b>{d > 0 ? d + (d === 1 ? ' day ' : ' days ') : ''}{h} {h === 1 ? 'hour' : 'hours'}{d === 0 ? ' ' + m + ' min' : ''}</b>;
  return (
    <div className="countdown" role="timer" aria-label={d + ' days, ' + h + ' hours, ' + m + ' minutes left'}>
      {([['Days', d], ['Hours', h], ['Minutes', m], ['Seconds', s]] as [string, number][]).map(([l, v]) => (
        <div key={l} className="cd-box"><b>{l === 'Days' ? v : pad(v)}</b><span>{l}</span></div>
      ))}
    </div>
  );
}
