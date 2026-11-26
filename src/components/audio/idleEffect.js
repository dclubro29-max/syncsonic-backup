/** Muting a delay return does not retire its feedback cycle: disconnect the owned edges. */
export function createIdleEffect(context, edges) {
  let active = false, disposed = false, timer = null;
  const clear = () => { clearTimeout(timer); timer = null; };
  const idle = () => {
    clear();
    if (!active) return;
    edges.forEach(([source, destination]) => source.disconnect(destination));
    active = false;
  };
  const wake = () => {
    clear();
    if (active || disposed || context.state === 'closed') return;
    edges.forEach(([source, destination]) => source.connect(destination));
    active = true;
  };
  const sleepAt = (deadline) => {
    clear();
    if (!active || disposed) return;
    const check = () => {
      if (disposed) return;
      if (context.state === 'closed') { idle(); return; }
      const remaining = deadline - context.currentTime;
      // Wall time can advance while the audio clock is suspended. Never cut a pending fade.
      if (remaining > 0) timer = setTimeout(check, Math.max(100, remaining * 1000));
      else idle();
    };
    timer = setTimeout(check, Math.max(0, (deadline - context.currentTime) * 1000));
  };
  const schedule = (segments) => {
    if (disposed || !segments.length) return;
    clear();
    if (segments.some(({ to }) => to > 0)) wake();
    if (segments[segments.length - 1].to > 0) return;
    const now = context.currentTime;
    const end = segments.reduce((time, { after = 0, over = 0.05 }) =>
      Math.max(time, now + Math.max(0, after)) + Math.max(0.02, over), now);
    sleepAt(end + 0.15); // Return gain finishes fading before retiring input, feedback and output.
  };
  return { wake, idle, schedule, sleepAt, dispose: () => { disposed = true; idle(); } };
}