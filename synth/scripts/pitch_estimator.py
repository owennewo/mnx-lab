"""Reference fundamental estimator (NumPy). The conformance kit's JS fundamental()
in web/contract/conformance/measure.js ports this function exactly and is checked
against it by tests/conformance-measure.test.mjs."""
import numpy as np


def fundamental(signal, rate, expected, window):
    segment = signal[round(window[0]*rate):round(window[1]*rate)]
    nfft = 8*2**int(np.ceil(np.log2(len(segment))))
    amplitude = np.abs(np.fft.rfft(segment*np.hanning(len(segment)), n=nfft))
    frequencies = np.fft.rfftfreq(nfft, 1/rate)
    band = np.flatnonzero((frequencies > expected*.96) & (frequencies < expected*1.04))
    index = int(band[np.argmax(amplitude[band])])
    y = np.log(np.maximum(amplitude[index-1:index+2], 1e-30))
    offset = .5*(y[0]-y[2])/(y[0]-2*y[1]+y[2])
    # Require a substantial fundamental, not a tiny accidental FFT maximum.
    observed_ratio = amplitude[index]/max(1e-30, amplitude.max())
    return float((index+offset)*rate/nfft), float(observed_ratio)
