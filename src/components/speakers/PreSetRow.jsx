import React from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

const STYLES = {
  ok: { Icon: CheckCircle2, tone: "text-success" },
  warn: { Icon: AlertTriangle, tone: "text-warning" },
  info: { Icon: Info, tone: "text-muted-foreground" },
};

/** O linie din verificarea de dinaintea setului: trecut, de rezolvat sau informativ. */
export default function PreSetRow({ status = "info", title, detail }) {
  const { Icon, tone } = STYLES[status] || STYLES.info;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/30 px-4 py-3">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{title}</p>
        {detail && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}