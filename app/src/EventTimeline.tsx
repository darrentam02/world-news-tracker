import type { EventTimelineResponse } from "@world-news/shared";
import { sourceName, formatHkt, STATUS_LABELS, REGION_LABELS } from "./ui";

interface Props {
  data: EventTimelineResponse;
  onBack: () => void;
}

export function EventTimeline({ data, onBack }: Props) {
  const ev = data.event;
  return (
    <section>
      <button className="btn-back" onClick={onBack} aria-label="返回">
        ← 返回
      </button>
      <article className="card">
        <div className="card-head">
          <span className={`pill pill-${ev.status}`}>{STATUS_LABELS[ev.status]}</span>
          <span className="pill pill-region">{REGION_LABELS[ev.region]}</span>
          <span className="card-time">
            首見 {formatHkt(ev.first_seen_at)} · 最近 {formatHkt(ev.last_seen_at)}
          </span>
        </div>
        <h1 className="event-title">{ev.title}</h1>
        {ev.summary ? <p className="card-summary">{ev.summary}</p> : <p className="card-degraded">暫無摘要（degraded）</p>}
      </article>
      <ol className="timeline">
        {data.timeline.map((a, i) => (
          <li key={a.id} className="timeline-item">
            <span className="tl-dot">{i + 1}</span>
            <div className="tl-body">
              <div className="tl-meta">
                <span className="src">{sourceName(a.source)}</span>
                <span className="tl-time">{formatHkt(a.fetched_at)}</span>
              </div>
              <a className="tl-link" href={a.url} target="_blank" rel="noreferrer">
                {a.title}
              </a>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}