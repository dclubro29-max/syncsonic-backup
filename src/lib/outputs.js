/**
 * Clasificarea ieșirilor audio expuse de browser.
 *
 * IMPORTANT: numele unui dispozitiv NU confirmă profilul Bluetooth. Termenii de mai jos
 * doar semnalează ieșiri care, pe Windows/macOS/Android, corespund de obicei profilului
 * pentru voce (HFP/HSP) — mono, bandă îngustă. Sunt un indiciu, nu o dovadă.
 */

export const SYSTEM_DEFAULT_ID = "__system_default__";

export const SYSTEM_DEFAULT_OUTPUT = {
  deviceId: SYSTEM_DEFAULT_ID,
  label: "Ieșirea sistemului",
  systemDefault: true,
};

const COMMS_PATTERNS = [
  /comunic/i,
  /communication/i,
  /hands[\s-]?free/i,
  /handsfree/i,
  /headset/i,
  /head[\s-]?mount/i,
  /ag audio/i,
  /telefon/i,
  /\bsco\b/i,
];

export function isCommunicationsOutput(label) {
  return COMMS_PATTERNS.some((re) => re.test(String(label || "")));
}

/**
 * Ieșirile care ajung la un televizor prin cablu (HDMI) sau la un adaptor video.
 * Pe Windows/macOS, sunetul HDMI apare de obicei ca „NVIDIA High Definition Audio”
 * sau direct cu numele televizorului.
 */
const HDMI_PATTERNS = [
  /hdmi/i,
  /high definition audio/i,
  /display audio/i,
  /television/i,
  /\btv\b/i,
  /\bdraw\b/i,
];

export function isHdmiOutput(label) {
  return HDMI_PATTERNS.some((re) => re.test(String(label || "")));
}

export const HDMI_NOTE =
  "Cablu HDMI sau adaptor video: televizorul primește exact fluxul aplicației — aceeași calitate și același ritm, pe același ceas audio. Nu e nevoie de sincronizare separată. Dacă îl folosești lângă boxele laptopului, televizorul poate întârzia sunetul cu procesarea imaginii: pornește modul „Joc”/„Low latency” al televizorului, apoi reglează întârzierea ieșirii până dispare ecoul.";

export const COMMS_NOTE =
  "Numele conține „Comunicații”, „Hands-Free” sau „Headset”. Pe majoritatea sistemelor aceste ieșiri sunt destinate apelurilor: semnal mono, cu bandă îngustă (profilul de voce Bluetooth). De aceea sunetul poate părea înfundat. Numele singur nu confirmă profilul — compară cu testul izolat de mai jos.";

/**
 * Cheie de grupare: reduce „Comunicații – Headphones (RS-401) (Bluetooth)” și
 * „Headphones (RS-401)” la aceeași cheie („rs 401”), ca să vedem când sistemul
 * expune două ieșiri pentru același dispozitiv.
 */
export function deviceGroupKey(label) {
  let l = String(label || "").toLowerCase();
  l = l.replace(/comunic[a-zăâîșț]*\s*[–—\-:|]+\s*/g, " ");
  l = l.replace(/communication[s]?\s*[–—\-:|]+\s*/g, " ");
  l = l.replace(
    /\([^)]*(bluetooth|hands[\s-]?free|headset|headphones?|stereo|ag audio|sco)[^)]*\)/g,
    " "
  );
  l = l.replace(
    /\b(hands[\s-]?free|handsfree|headset|headphones?|head[\s-]?mounted|stereo|bluetooth|wireless|ag audio|sco)\b/g,
    " "
  );
  l = l.replace(/[^a-z0-9]+/g, " ").trim();
  return l;
}

export function groupOutputs(speakers) {
  const map = new Map();
  (speakers || []).forEach((sp) => {
    if (sp.systemDefault) return;
    const key = deviceGroupKey(sp.label) || sp.deviceId;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(sp);
  });
  return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
}

/**
 * Elimină ieșirile care par destinate apelurilor, dar numai dacă același dispozitiv
 * are și o variantă de redare. Folosit la restaurarea selecției și la „Toate boxele”.
 */
export function dropCommunicationsIfAlternative(ids, speakers) {
  const list = speakers || [];
  const byId = new Map(list.map((s) => [s.deviceId, s]));
  return (ids || []).filter((id) => {
    const sp = byId.get(id);
    if (!sp || !isCommunicationsOutput(sp.label)) return true;
    const key = deviceGroupKey(sp.label);
    return !list.some(
      (o) =>
        o.deviceId !== id &&
        !isCommunicationsOutput(o.label) &&
        deviceGroupKey(o.label) === key
    );
  });
}

/** Doar ieșirile care nu par destinate apelurilor. */
export function playbackOnly(speakers) {
  return (speakers || []).filter((sp) => !sp.systemDefault && !isCommunicationsOutput(sp.label));
}