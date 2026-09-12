import type { NewsEventCard } from "@world-news/shared";
import { sourceName, relativeTime, formatHkt, STATUS_LABELS } from "./ui";

interface Props {
  event: NewsEventCard;
  onSelect: (id: string) => void;
}

export function EventCard({ event, onSelect }: Props) {
  return (
    <article
      className={`card${event.pinned ? " card-pinned" : ""}`}
      onClick={() => onSelect(event.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(event.id);
      }}
    >
      <div className="card-head">
        <span className={`pill pill-${event.status}`}>{STATUS_LABELS[event.status]}</span>
        {event.pinned && <span className="pill pill-pin">置頂</span>}
        <span className="card-time">
          {event.article_count} 稿 · {relativeTime(event.last_seen_at)}
        </span>
      </div>
      <h3 className="card-title">{event.title}</h3>
      {event.summary ? <p className="card-summary">{event.summary}</p> : <p className="card-degraded">暫無摘要（degraded）</p>}
      {event.latest.length > 0 && (
        <ul className="card-latest">
          {event.latest.map((a) => (
            <li key={a.id}>
              <span className="src">{sourceName(a.source)}</span>
              <a href={a.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                {a.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}