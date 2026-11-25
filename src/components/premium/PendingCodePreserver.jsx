import { useEffect } from "react";
import { normalizeCode, storePendingCode } from "@/lib/premium";

/**
 * Codul din QR trebuie să supraviețuiască autentificării, dar nu are ce căuta
 * în istoricul public sau în rapoarte. Îl mutăm imediat în sessionStorage și
 * scoatem parametrul din adresă înainte ca aplicația să redirecționeze la login.
 */
export default function PendingCodePreserver() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("code");
    if (!raw) return;
    const code = normalizeCode(raw);
    if (code) storePendingCode(code);
    url.searchParams.delete("code");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }, []);

  return null;
}