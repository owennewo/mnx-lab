import fs from 'node:fs';
import path from 'node:path';
// ── CDP plumbing (no puppeteer: Node's global WebSocket is enough) ──────────
/** Chrome writes the port it actually bound to into the profile directory —
 *  read it rather than guessing, so a busy port can never flake the test. */
export async function devtoolsPort(profileDir) {
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 60; attempt++) {
    if (fs.existsSync(portFile)) {
      const [port] = fs.readFileSync(portFile, 'utf8').split('\n');
      if (port) return Number(port);
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Chrome never reported a DevTools port (is CHROME_BIN correct?)');
}

export async function connect(port) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* chrome still starting */
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('could not reach Chrome DevTools');
}

export function client(ws) {
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    // Console errors and uncaught exceptions are failures: a host page that
    // has to tolerate red console noise has not really been served.
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      logs.push(message.params.args.map(a => a.value ?? a.description).join(' '));
    }
    if (message.method === 'Runtime.exceptionThrown') {
      logs.push(message.params.exceptionDetails.exception?.description ?? 'exception');
    }
  });
  const send = (method, params = {}) =>
    new Promise(resolve => {
      const messageId = ++id;
      pending.set(messageId, resolve);
      ws.send(JSON.stringify({ id: messageId, method, params }));
    });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      userGesture: true,
      returnByValue: true
    });
    const details = result.result?.exceptionDetails;
    if (details) throw new Error(details.exception?.description ?? 'evaluate threw');
    return result.result?.result?.value;
  };
  return { send, evaluate, logs };
}


/** Wait for observable readiness, not a fixed boot delay. Evaluation errors fail loudly. */
export async function waitFor(cdp, expression, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  do {
    if (await cdp.evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}

export const SCORE_READY = `(() => {
  if (document.readyState !== 'complete' || document.fonts.status !== 'loaded') return false;
  const roots = [document];
  while (roots.length) {
    const root = roots.shift();
    for (const element of root.querySelectorAll('*')) {
      if (element.localName === 'mnx-document-viewer' &&
          element.shadowRoot?.querySelector('svg [data-source-id]')) return true;
      if (element.shadowRoot) roots.push(element.shadowRoot);
    }
  }
  return false;
})()`;

/** True once the page has gone quiet after an input: for three frames running,
 *  no DOM mutation anywhere (shadow roots included — a script-driven tween
 *  writes attributes every frame until it removes itself), no Lit update
 *  pending (one that threw counts as finished), no CSS transition running,
 *  and no scroll position moving — which covers the smooth scroll a moved
 *  selection starts from its own frame callback. False if it never does
 *  within 10 s. */
export const SETTLED = `(async () => {
  const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
  let mutated = false;
  const observer = new MutationObserver(() => { mutated = true; });
  const observed = new Set();
  const walk = () => {
    const elements = [];
    const roots = [document];
    for (let i = 0; i < roots.length; i++) {
      if (!observed.has(roots[i])) {
        observed.add(roots[i]);
        observer.observe(roots[i], { subtree: true, childList: true, attributes: true, characterData: true });
      }
      for (const element of roots[i].querySelectorAll('*')) {
        elements.push(element);
        if (element.shadowRoot) roots.push(element.shadowRoot);
      }
    }
    return { elements, roots };
  };
  const scrolls = elements => String(window.scrollX) + ',' + String(window.scrollY) + ';' + elements
    .filter(element => element.scrollTop || element.scrollLeft)
    .map(element => element.localName + ':' + element.scrollTop + ',' + element.scrollLeft)
    .join(';');
  // A CSS transition is a state change still arriving — a width a geometry
  // check would read mid-flight. A keyframed animation is decoration (the
  // focus hint fades for 2.2 s) and never holds the page up.
  const animating = roots => roots.some(root => root.getAnimations().some(animation =>
    animation instanceof CSSTransition && animation.playState === 'running'));
  const deadline = performance.now() + 10000;
  let last = null;
  let quiet = 0;
  try {
    while (performance.now() < deadline) {
      // Waiting, not judging: an update that throws still ends, and whether a
      // throw is a failure is the smoke's assertion to make, not the wait's.
      await Promise.all(walk().elements.map(element => element.updateComplete?.catch(() => {})));
      mutated = false;
      await frame();
      const { elements, roots } = walk();
      if (observer.takeRecords().length) mutated = true;
      const now = scrolls(elements);
      const busy = mutated || elements.some(element => element.isUpdatePending) || animating(roots);
      quiet = !busy && now === last ? quiet + 1 : 0;
      last = now;
      if (quiet >= 3) return true;
    }
    return false;
  } finally {
    observer.disconnect();
  }
})()`;

/** Wait for the page to settle after an input — instead of a guessed sleep. */
export async function settle(cdp) {
  if (!(await cdp.evaluate(SETTLED))) throw new Error('the page never settled (the DOM, an update, an animation or a scroll still moving after 10 s)');
}
