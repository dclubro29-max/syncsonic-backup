import React, { useMemo, useState } from 'react';
import {
  AlignCenter, ArrowRight, CheckCircle2, Ear, Info, Loader2, Mic, PlayCircle,
  RefreshCw, RotateCcw, Save, SlidersHorizontal, Smartphone, Trash2, TriangleAlert,
} from 'lucide-react';
import { useDj } from '@/lib/djContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Surface, SurfaceHead } from '@/components/ui-kit/Surface';
import StatusPill from '@/components/ui-kit/StatusPill';
import CalibrationMicrophone from '@/components/speakers/CalibrationMicrophone';
import PhoneCalibrationPanel from '@/components/speakers/PhoneCalibrationPanel';
import CalibrationDiagnostics from '@/components/speakers/CalibrationDiagnostics';
import OutputCalibration from '@/components/OutputCalibration';
import { deleteProfile, profilesFor, saveProfile } from '@/lib/alignmentProfiles';

const ZONE_KEY = 'musicsync.alignmentZone';
const readZone = () => {
  try { return localStorage.getItem(ZONE_KEY) || 'Zona principală'; } catch (e) { return 'Zona principală'; }
};
const round = (value) => Math.round(value * 10) / 10;

function Metric({ label, value, hint, tone = 'neutral' }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone === 'good' ? 'border-success/30 bg-success/[0.06]' : 'border-border/60 bg-background/40'}`}>
      <p className="caps">{label}</p>
      <p className={`mt-1 font-heading text-2xl font-semibold tabular-nums ${tone === 'good' ? 'text-success' : ''}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function AlignmentFlow() {
  const dj = useDj();
  const [microphoneId, setMicrophoneId] = useState('');
  const [zone, setZoneState] = useState(readZone);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [manual, setManual] = useState(false);
  const [phoneMode, setPhoneMode] = useState(false);
  const [heardAll, setHeardAll] = useState(false);
  const [version, setVersion] = useState(0);

  const deviceIds = (dj.outputs || []).map((output) => output.deviceId);
  const signature = deviceIds.join('|');
  const profiles = useMemo(() => profilesFor(deviceIds), [signature, version]);
  const phoneOutputs = useMemo(() => (dj.outputs || []).map((output) => ({
    deviceId: output.deviceId,
    label: dj.speakers.find((speaker) => speaker.deviceId === output.deviceId)?.label || 'Ieșire audio',
  })), [signature, dj.speakers]);
  const automatic = dj.autoDj.on || dj.partyMode.on || dj.emergencyPlayback;
  const allActive = (dj.outputs || []).every((output) => output.state === 'active');
  const canMeasure = deviceIds.length >= 2 && allActive && !dj.calibrationBusy && !automatic && !dj.stabilityMode;
  const phoneBlocked = deviceIds.length < 2 || !allActive || automatic || dj.stabilityMode;

  const setZone = (value) => {
    setZoneState(value);
    try { localStorage.setItem(ZONE_KEY, value); } catch (e) { /* ignore */ }
  };

  const labelFor = (deviceId) => dj.speakers.find((speaker) => speaker.deviceId === deviceId)?.label || 'Ieșire audio';

  const run = async () => {
    if (!canMeasure) return;
    setResult(null);
    setHeardAll(false);
    setStatus({ ok: true, text: 'Măsor diferența actuală între boxe…' });
    try {
      const outcome = await dj.alignOutputs({
        microphoneId,
        zone,
        onProgress: (progress) => {
          if (progress.index == null) return;
          const phase = progress.phase === 'baseline'
            ? 'Starea actuală' : progress.phase === 'physical'
              ? 'Diferența fizică' : 'După compensare';
          setStatus({
            ok: true,
            text: `${phase} · boxa ${progress.index + 1}/${progress.total} · impuls ${progress.trial}/3…`,
          });
        },
      });
      setResult(outcome);
      setVersion((value) => value + 1);
      setStatus(outcome.ok
        ? {
            ok: true,
            text: outcome.verified
              ? 'Aliniere verificată: diferența rămasă la microfon este sub 10 ms.'
              : `Aliniere parțială: diferența rămasă este ${round(outcome.after.spread)} ms, peste ținta de 10 ms. Valorile au fost aplicate; poți repeta, regla manual sau asculta beatul.`,
          }
        : { ok: false, text: outcome.reason });
    } catch (error) {
      setStatus({
        ok: false,
        text: error.name === 'NotAllowedError'
          ? 'Accesul la microfon a fost refuzat. Permite-l în browser; reglajele au rămas neschimbate.'
          : error.name === 'AbortError'
            ? 'Aliniere anulată. Reglajele și redarea au revenit la starea de dinainte.'
            : error.message || 'Alinierea nu a reușit; reglajele anterioare au fost păstrate.',
      });
    }
  };

  const save = () => {
    if (!result?.ok || !heardAll) return;
    const saved = saveProfile({
      zone,
      deviceIds: result.deviceIds,
      delays: result.after.results,
      before: result.before.spread,
      after: result.after.spread,
      verified: result.verified,
      uncertainty: result.after.uncertainty,
    });
    setVersion((value) => value + 1);
    setStatus({ ok: true, text: `Profil salvat pentru „${saved.profile.zone}”: ${saved.profile.after} ms după compensare.` });
  };

  const apply = (profile) => {
    const missing = profile.delays.filter((item) => !deviceIds.includes(item.deviceId));
    profile.delays.forEach((item) => {
      if (deviceIds.includes(item.deviceId)) dj.setOutputDelay(item.deviceId, item.delay);
    });
    setStatus({
      ok: true,
      text: missing.length
        ? 'Profil aplicat parțial: o boxă din profil nu mai este selectată. Reverifică alinierea.'
        : `Profil „${profile.zone}” aplicat.`,
    });
  };

  const remove = (profile) => {
    deleteProfile(profile.id);
    setVersion((value) => value + 1);
  };

  return (
    <Surface className="p-5 sm:p-6">
      <SurfaceHead
        icon={AlignCenter}
        title="Aliniere automată"
        hint="Alege boxele → așază microfonul → măsoară → verifică → salvează."
        action={<StatusPill tone={result?.verified ? 'live' : result ? 'warn' : 'neutral'} dot>{result?.verified ? 'aliniere verificată' : result ? 'de verificat' : 'nepornită'}</StatusPill>}
      />

      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {['Alege boxele', 'Așază microfonul', 'Măsoară', 'Verifică', 'Salvează'].map((step, index) => (
          <React.Fragment key={step}>
            {index > 0 && <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />}
            <span className="chip">{step}</span>
          </React.Fragment>
        ))}
      </div>

      {dj.outputMode !== 'separate' && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-info/25 bg-info/[0.06] px-4 py-3 text-xs leading-relaxed text-info">
          <Info className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">Alinierea individuală are nevoie de cel puțin două ieșiri pe care browserul le controlează separat. Acum ești pe „Ieșirea sistemului”.</span>
          <Button size="sm" variant="outline" onClick={() => dj.setOutputMode('separate')}>Treci la ieșiri separate</Button>
        </div>
      )}

      {dj.outputMode === 'separate' && deviceIds.length < 2 && (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-xs leading-relaxed text-warning">
          <p className="flex items-start gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {deviceIds.length === 0
              ? 'Nicio ieșire separată activă. Alege boxele din lista de mai sus.'
              : `Ai ${deviceIds.length} ieșire activă. Conectează încă o boxă sau verifică dacă sistemul le vede ca o singură ieșire — atunci reglajul individual nu este disponibil.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => dj.refreshSpeakers()}><RefreshCw className="h-4 w-4" /> Reîmprospătează</Button>
            <Button size="sm" variant="ghost" onClick={() => {
              dj.setOutputMode('system');
              dj.testBeat('system').catch(() => {});
            }}>Test de ascultare pe ieșirea sistemului</Button>
          </div>
        </div>
      )}

      {deviceIds.length < 2 && profiles.length > 0 && (
        <p className="mt-3 rounded-xl border border-info/25 bg-info/[0.06] px-4 py-3 text-xs leading-relaxed text-info">
          Ai {profiles.length} {profiles.length === 1 ? 'profil salvat' : 'profiluri salvate'} pentru altă configurație de boxe. Conectează același grup și reverifică înainte de a le aplica.
        </p>
      )}

      {deviceIds.length >= 2 && (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <CalibrationMicrophone value={microphoneId} onChange={setMicrophoneId} disabled={dj.calibrationBusy} />
            <div className="flex flex-wrap gap-2">
              <Button className="gap-2" onClick={run} disabled={!canMeasure || phoneMode}>
                {dj.calibrationBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                {dj.calibrationBusy ? 'Se măsoară…' : result ? 'Repetă alinierea' : 'Măsoară și verifică'}
              </Button>
              <Button
                variant={phoneMode ? 'secondary' : 'outline'}
                className="gap-2"
                onClick={() => setPhoneMode((value) => !value)}
                disabled={phoneBlocked}
              >
                <Smartphone className="h-4 w-4" /> {phoneMode ? 'Închide telefonul' : 'Folosește telefonul'}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => dj.testBeat('all').catch(() => {})} disabled={dj.calibrationBusy}>
                <PlayCircle className="h-4 w-4" /> Ascultă toate împreună
              </Button>
              {dj.calibrationBusy && (
                <Button variant="ghost" className="gap-2" onClick={() => dj.cancelCalibration({ restore: true })}>
                  Anulează
                </Button>
              )}
              <Button variant="ghost" className="gap-2" onClick={() => setManual((value) => !value)}>
                <SlidersHorizontal className="h-4 w-4" /> Reglaj manual
              </Button>
            </div>
          </div>

          {automatic && <p className="mt-3 text-xs text-warning">Oprește Auto DJ, modul Petrecere, surpriza sau modul de urgență înainte de aliniere; redarea nu este întreruptă automat.</p>}
          {!allActive && <p className="mt-3 text-xs text-warning">O ieșire încă pornește sau a fost refuzată. Verifică starea ieșirilor înainte de măsurare.</p>}

          {status && (
            <div className={`mt-4 flex items-start gap-3 rounded-xl px-4 py-3 text-xs leading-relaxed ${
              status.ok ? 'bg-primary/10 text-primary' : 'border border-warning/30 bg-warning/[0.06] text-warning'
            }`} role="status" aria-live="polite">
              {status.ok ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{status.text}</span>
            </div>
          )}

          {phoneMode && (
            <PhoneCalibrationPanel
              zone={zone}
              outputs={phoneOutputs}
              disabled={phoneBlocked}
              onStatus={setStatus}
              onResult={(outcome) => {
                setResult(outcome);
                setHeardAll(false);
                setVersion((value) => value + 1);
              }}
              onClose={() => setPhoneMode(false)}
            />
          )}

          <div className="mt-4">
            <CalibrationDiagnostics />
          </div>

          {result && (
            <div className="mt-4 space-y-4 rounded-2xl border border-border/60 bg-background/30 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Înainte" value={`${round(result.before.spread)} ms`} hint="Diferența măsurată cu reglajele de dinainte." />
                <Metric
                  label="După compensare"
                  value={`${round(result.after.spread)} ms`}
                  hint={`${result.applied ? 'Diferența rămasă la microfon' : 'Măsurat provizoriu, apoi anulat'} · incertitudine ±${round(result.after.uncertainty)} ms.`}
                  tone={result.verified ? 'good' : 'neutral'}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Diferența fizică fără compensare: <span className="font-mono tabular-nums text-foreground">{round(result.physical?.spread ?? result.before.spread)} ms</span>.
              </p>
              {result.unmeasured?.length ? (
                <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-3 py-2 text-[11px] leading-relaxed text-warning">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {result.unmeasured.length} {result.unmeasured.length === 1 ? 'boxă rămâne necalibrată' : 'boxe rămân necalibrate'}; reglajele lor anterioare au fost păstrate. Poți relua doar acea boxă din sesiunea telefonului.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {result.verified
                  ? <StatusPill tone="live" icon={CheckCircle2}>Aliniere verificată</StatusPill>
                  : <StatusPill tone="warn" icon={TriangleAlert}>{result.applied ? 'Aliniere parțială' : 'Reglaje anterioare păstrate'}</StatusPill>}
                <span className="text-[11px] text-muted-foreground">
                  {result.verified
                    ? 'Ținta pentru două boxe este de cel mult 10 ms la punctul de ascultare.'
                    : 'Ținta este de cel mult 10 ms. Repetă măsurătoarea sau folosește reglajul manual.'}
                </span>
              </div>
              {result.applied && (
                <div className="space-y-1.5">
                  <p className="caps">Întârzieri aplicate</p>
                  {result.after.results.map((item) => (
                    <div key={item.deviceId} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-muted-foreground">{labelFor(item.deviceId)}</span>
                      <span className="font-mono tabular-nums">{item.delay} ms</span>
                    </div>
                  ))}
                </div>
              )}
              {result.ok && (
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <p className="text-[11px] text-muted-foreground">
                    Ascultă beatul pe toate boxele, apoi confirmă. Reverifică după 30 de minute sau după reconectarea boxelor.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[180px] flex-1 space-y-1 text-xs text-muted-foreground">
                      <span>Zonă / configurație</span>
                      <Input value={zone} onChange={(event) => setZone(event.target.value)} maxLength={40} className="h-9" />
                    </label>
                    <button
                      type="button"
                      onClick={() => setHeardAll((value) => !value)}
                      aria-pressed={heardAll}
                      className={`chip h-9 ${heardAll ? 'border-success/40 text-success' : ''}`}
                    >
                      <Ear className="h-3.5 w-3.5" />
                      Am ascultat beatul pe toate boxele
                    </button>
                    <Button size="sm" className="gap-2" onClick={save} disabled={!heardAll}><Save className="h-4 w-4" /> Salvează profilul</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {manual && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => dj.outputs.forEach((output) => dj.setOutputDelay(output.deviceId, 0))}>
                  <RotateCcw className="h-3.5 w-3.5" /> Resetează la 0 ms
                </Button>
              </div>
              <OutputCalibration
                outputs={dj.outputs}
                speakers={dj.speakers}
                onDelayChange={dj.setOutputDelay}
                onTest={(id) => dj.playTestTone(id)}
                onTestAll={() => dj.playTestTone(null, 500)}
                supported={dj.setSinkSupported}
              />
            </div>
          )}

          {profiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="caps">Profiluri salvate</p>
              {profiles.map((profile) => (
                <div key={profile.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{profile.zone}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {profile.before} ms → {profile.after} ms · {profile.verified ? 'verificat' : 'neverificat'}
                      {!profile.matches && ' · altă configurație de boxe — reverifică înainte de a aplica'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" disabled={!profile.matches} onClick={() => apply(profile)}>Aplică</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(profile)} aria-label={`Șterge profilul ${profile.zone}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Muzica este pusă pe pauză doar cât măsoară, apoi revine la poziția și volumul de dinainte. Recalibrarea pornește de la întârzierile fizice, deci nu adaugă de două ori aceeași compensare. Bluetooth poate varia după reconectare: reverifică înainte de un set lung.
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-warning">
        Proba cu boxe reale rămâne necesară: aplicația poate confirma doar semnalul trimis și măsurătoarea cu microfon, nu și felul în care se aude în cameră.
      </p>
    </Surface>
  );
}