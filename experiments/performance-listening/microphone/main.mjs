import captureURL from "./capture.mjs?url";
const $ = (id) => document.getElementById(id);
const rate = 22050,
  maxSamples = rate * 300;
let session = null,
  urls = [];
const name = (pitch) =>
  ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][
    pitch % 12
  ] +
  (Math.floor(pitch / 12) - 1);
const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
function cleanup(s) {
  s.stream?.getTracks().forEach((t) => t.stop());
  s.source?.disconnect();
  s.node?.disconnect();
  if (s.context && s.context.state !== "closed") void s.context.close();
  clearTimeout(s.watchdog);
}
function fail(s, message) {
  if (session !== s) return;
  cleanup(s);
  s.worker?.terminate();
  session = null;
  $("record").disabled = false;
  $("stop").disabled = true;
  $("recipe").disabled = false;
  $("status").textContent = message;
  $("active").textContent = "Not listening";
  $("level").value = 0;
}
function stop(message = "Stopped. Preparing your recording…") {
  const s = session;
  if (!s || s.stopping) return;
  s.stopping = true;
  s.stopReason = message;
  cleanup(s);
  $("stop").disabled = true;
  $("status").textContent = message;
  $("active").textContent = "Not listening";
  $("level").value = 0;
  if (!s.ready) {
    fail(s, "Recording cancelled.");
    return;
  }
  s.worker.postMessage({ type: "finish" });
  s.watchdog = setTimeout(
    () => fail(s, "The listener stopped responding. Please try another take."),
    5000,
  );
}
function wav(pcm) {
  const bytes = new ArrayBuffer(44 + pcm.length * 2),
    v = new DataView(bytes);
  const text = (offset, s) =>
    [...s].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  pcm.forEach((x, i) =>
    v.setInt16(
      44 + 2 * i,
      Math.round(Math.max(-1, Math.min(1, x)) * (x < 0 ? 32768 : 32767)),
      true,
    ),
  );
  return new Blob([bytes], { type: "audio/wav" });
}
function download(id, blob, filename) {
  const url = URL.createObjectURL(blob);
  urls.push(url);
  $(id).href = url;
  $(id).download = filename;
  $(id).hidden = false;
  return url;
}
$("record").onclick = async () => {
  const s = {
    received: 0,
    processed: 0,
    lastPaint: 0,
    started: new Date().toISOString(),
    recipe: $("recipe").value,
  };
  session = s;
  $("record").disabled = true;
  $("stop").disabled = false;
  $("recipe").disabled = true;
  $("status").textContent = "Allow microphone access in your browser…";
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode)
      throw Error(
        "Use a current browser on localhost or HTTPS with microphone support.",
      );
    s.context = new AudioContext({
      sampleRate: rate,
      latencyHint: "interactive",
    });
    await s.context.resume();
    if (session !== s) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    if (session !== s) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    s.stream = stream;
    const track = stream.getAudioTracks()[0];
    s.settings = track.getSettings();
    track.addEventListener("ended", () =>
      stop("Microphone disconnected. Preparing captured audio…"),
    );
    if (s.context.sampleRate !== rate)
      throw Error(
        "This browser cannot capture at the listener’s 22,050 Hz rate. Try Chrome.",
      );
    await s.context.audioWorklet.addModule(captureURL);
    if (session !== s) return;
    s.worker = new Worker(new URL("./listener.worker.mjs", import.meta.url), {
      type: "module",
    });
    s.worker.onerror = (e) => fail(s, `Listener error: ${e.message}`);
    s.worker.onmessage = ({ data }) => {
      if (session !== s) return;
      if (data.type === "error") {
        fail(s, `Listener error: ${data.message}`);
        return;
      }
      if (data.type === "ready") {
        s.ready = true;
        urls.forEach(URL.revokeObjectURL);
        urls = [];
        $("playback").pause();
        $("playback").removeAttribute("src");
        $("playback").hidden = true;
        $("audioDownload").hidden = true;
        $("notesDownload").hidden = true;
        $("stream").replaceChildren();
        $("health").textContent = "";
        $("elapsed").textContent = "0:00";
        $("device").textContent = track.label || "Default microphone";
        $("status").textContent =
          "Recording — pluck a note. Stop when you’re finished.";
        s.node = new AudioWorkletNode(s.context, "listening-capture");
        s.source = s.context.createMediaStreamSource(stream);
        s.node.port.onmessage = ({ data: pcm }) => {
          if (session !== s || s.stopping) return;
          if (s.received - s.processed > rate) {
            stop("Listener fell behind. Stopped rather than dropping audio.");
            return;
          }
          s.received += pcm.length;
          s.worker.postMessage({ type: "audio", samples: pcm }, [pcm.buffer]);
          if (s.received >= maxSamples)
            stop("Five-minute limit reached. Preparing your recording…");
        };
        s.source.connect(s.node);
        s.node.connect(s.context.destination);
        s.context.onstatechange = () => {
          if (!s.stopping && session === s && s.context.state !== "running")
            stop("Audio capture was interrupted. Preparing captured audio…");
        };
      } else if (data.type === "update") {
        s.processed = data.samples;
        for (const e of data.events) {
          const li = document.createElement("li"),
            time = document.createElement("time"),
            note = document.createElement("strong");
          time.textContent = `${e.detectedAt.toFixed(2)} s`;
          note.textContent = name(e.pitch);
          li.append(time, note);
          if (e.kind === "restrike") li.append("Repeated attack");
          $("stream").prepend(li);
        }
        while ($("stream").children.length > 200)
          $("stream").lastChild.remove();
        if (!s.stopping && performance.now() - s.lastPaint > 80) {
          s.lastPaint = performance.now();
          $("elapsed").textContent = clock(data.samples / rate);
          $("level").value = Math.max(
            0,
            (20 * Math.log10(Math.max(data.rms, 1e-8)) + 60) / 60,
          );
          $("signal").textContent =
            data.peak >= 0.98
              ? "Clipping — move farther away"
              : data.rms < 0.0001
                ? "Very quiet / no input"
                : "Signal received";
          $("active").replaceChildren(
            ...data.active
              .sort((a, b) => a - b)
              .map((p) => {
                const el = document.createElement("span");
                el.className = "note";
                el.textContent = name(p);
                return el;
              }),
          );
          if (!data.active.length)
            $("active").textContent = "No confirmed notes";
          $("health").textContent =
            `${Math.round(data.cpuMs / (data.samples / rate) / 10)}% processing time · ${Math.round(((s.received - s.processed) / rate) * 1000)} ms queued · latest 200 events shown`;
        }
      } else if (data.type === "finished") {
        cleanup(s);
        s.worker.terminate();
        session = null;
        const stem = `guitar-${s.started.replaceAll(":", "-")}`;
        $("playback").src = download(
          "audioDownload",
          wav(data.pcm),
          `${stem}.wav`,
        );
        $("playback").hidden = false;
        download(
          "notesDownload",
          new Blob(
            [
              JSON.stringify(
                {
                  version: 1,
                  recipe: s.recipe,
                  started: s.started,
                  sampleRate: rate,
                  duration: data.pcm.length / rate,
                  inputSettings: s.settings,
                  config: data.config,
                  cpuMs: data.cpuMs,
                  events: data.events,
                },
                null,
                2,
              ),
            ],
            { type: "application/json" },
          ),
          `${stem}.json`,
        );
        $("elapsed").textContent = clock(data.pcm.length / rate);
        $("status").textContent =
          `${s.stopReason?.startsWith("Stopped.") ? "Stopped." : (s.stopReason ?? "Stopped.")} ${data.events.length} detected attacks. Listen back or download this take.`;
        $("record").disabled = false;
        $("recipe").disabled = false;
      }
    };
    s.worker.postMessage({ type: "init", recipe: s.recipe });
    s.watchdog = setTimeout(() => {
      if (!s.ready)
        fail(s, "The listener could not start. Please reload and try again.");
    }, 15000);
  } catch (error) {
    const message =
      error.name === "NotAllowedError"
        ? "Microphone access was denied. Allow it in your browser’s site settings, then try again."
        : error.name === "NotFoundError"
          ? "No microphone found. Connect one and try again."
          : error.message;
    fail(s, message);
  }
};
$("stop").onclick = () => stop();
window.addEventListener("pagehide", () => {
  if (session) {
    cleanup(session);
    session.worker?.terminate();
  }
});
