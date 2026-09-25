# Microphone background gate

[Back to fusion log](../fusion-log.md)

- **ID:** microphone-noise-gate
- **Role:** microphone-only level eligibility before normalised pitch scoring.
- **Implementation:** [policy.mjs](../microphone/policy.mjs), wrapping the existing scorer.
- **Evidence:** unit tests and a browser fake-microphone capture check; human guitar trial pending.
- **Disposition:** manual experiment; no frozen F-recipe or production default changed.

## Purpose and fit

Normalised spectra can produce confident-looking coefficients on quiet noise above the
original −80 dBFS floor. Measure the environment before playing, then require a fixed
level margin over it. This measures digital amplitude, not physical sound pressure.
During calibration return zero pitch evidence, while retaining the captured audio and
its original timeline. Thereafter the existing scorer reads the calibrated RMS floor.

## Configuration

| Parameter | Available settings | Current trial | Interaction |
|---|---|---|---|
| Background margin | Off, 6, 12, 18 dB | Default 12; Off restores original floor | Larger margins can reject quiet notes and decaying sound |
| Calibration length | Fixed two seconds, rounded to hops | 173 hops at 22050/256 | Full-window RMS only; startup-padded windows excluded |
| Background statistic | Fixed 90th percentile | Initial silent-room windows | Robust to a few low windows, not to playing during calibration |
| Minimum floor | Original RMS 0.0001 (−80 dBFS) | max(original floor, background × amplitude margin) | Does not amplify or rescale recorded audio |
| Confirmation | Independently Off/original, 50, 75, 100 ms requested | Default 75 → 81.3 ms span | See [temporal events](temporal-events.md#microphone-only-confirmation-trial) |

## Timing, cost and state

No extra FFT or ongoing noise adaptation. Calibration withholds notes for about two
seconds; normal streaming timestamps still begin at capture start. The per-take floor
stays fixed to avoid learning played notes as background. Restart to recalibrate.
Measured settings and actual confirmation span are exported in microphone JSON v2.

## Trial history and limits

MG-001: tests verify suppressed calibration output, below-floor rejection, above-floor
eligibility and a frozen threshold. Browser capture of a quiet 110 Hz background followed
by a loud A4 verifies calibration, live note emission and settings export. Neither is a
real-guitar accuracy evaluation. Other margins are exposed controls, not measured winners.

The gate tests overall frame energy; it cannot prove that each individual pitch rises
above noise. When a loud note opens the gate, background partials may still be attributed
as extra notes. Changing room noise, device gain or playing during calibration can invalidate
the estimate. Next assess false attacks alongside quiet-note, short-note and decay loss,
varying this gate separately from confirmation on preserved recordings.
