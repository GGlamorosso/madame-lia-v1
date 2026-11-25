export const ready = (async () => {
  if (document.readyState === 'loading') {
    await new Promise(done => document.addEventListener('DOMContentLoaded', done, {once: true}));
  }
  await window.MadameLia.home?.contentReady;
})();

// Scope listeners and transient effects to the current motion preference.
export async function whenMoving(start) {
  await ready;
  const pref = window.MadameLia.reducedMotion;
  let controller;
  const update = () => {
    controller?.abort();
    if (pref.matches) return;
    controller = new AbortController();
    start(controller.signal);
  };
  pref.addEventListener('change', update);
  update();
}
