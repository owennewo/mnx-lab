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

