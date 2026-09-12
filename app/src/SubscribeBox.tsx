import { useState, type FormEvent } from "react";
import { subscribe as apiSubscribe, type SubscribeResult } from "./api";

export function SubscribeBox() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "done"; msg: string; devUrl?: string } | { kind: "error"; msg: string }>({ kind: "idle" });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = email.trim();
    if (!clean) return;
    setState({ kind: "loading" });
    try {
      const r: SubscribeResult = await apiSubscribe(clean);
      setState({ kind: "done", msg: r.message ?? "ok", devUrl: r.dev_confirm_url });
    } catch (err) {
      setState({ kind: "error", msg: (err as Error).message });
    }
  };

  return (
    <form className="subscribe" onSubmit={onSubmit}>
      <label htmlFor="sub-email">每日兩封簡報訂閱（08:30 開巿 / 16:30 收巿）</label>
      <div className="subscribe-row">
        <input
          id="sub-email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={state.kind === "loading"}>
          {state.kind === "loading" ? "寄緊…" : "訂閱"}
        </button>
      </div>
      {state.kind === "done" && (
        <p className="ok sub-msg">
          {state.msg}
          {state.devUrl && (
            <>
              {" "}
              <a href={state.devUrl} target="_blank" rel="noreferrer">
                （呢度開確認 link）
              </a>
            </>
          )}
        </p>
      )}
      {state.kind === "error" && <p className="bad sub-msg">{state.msg}</p>}
    </form>
  );
}