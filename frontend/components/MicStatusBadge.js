export default function MicStatusBadge({ state }) {
  const config = {
    idle: { label: "Listening for \u201cHey Tutor\u201d", cls: "idle" },
    wake_heard: { label: "Go ahead, I'm listening...", cls: "wake-listening" },
    processing: { label: "Thinking...", cls: "capturing" },
    muted: { label: "Mic muted", cls: "muted" },
  };
  const c = config[state] || config.idle;

  return (
    <div className={`mic-badge ${c.cls}`}>
      {state !== "muted" && <span className="pulse-dot" />}
      {c.label}
    </div>
  );
}
