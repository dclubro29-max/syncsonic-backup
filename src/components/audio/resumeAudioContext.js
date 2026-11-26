/** Each attempt calls resume synchronously, preserving the current user gesture. */
export function resumeAudioContext(context) {
  if (!context || context.state === 'closed') {
    return Promise.reject(new Error('Motorul audio este închis. Reîncarcă aplicația.'));
  }
  if (context.state === 'running') return Promise.resolve(context);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.removeEventListener('statechange', onState);
      if (error) reject(error);
      else resolve(context);
    };
    const onState = () => {
      if (context.state === 'running') finish();
      else if (context.state === 'closed') finish(new Error('Motorul audio a fost închis.'));
    };
    const timer = setTimeout(() => finish(Object.assign(new Error(
      'Browserul nu a pornit sunetul. Apasă din nou Redă pentru a permite redarea.'
    ), { name: 'NotAllowedError' })), 6000);
    context.addEventListener('statechange', onState);
    try {
      context.resume().then(onState, finish);
    } catch (error) {
      finish(error);
    }
  });
}