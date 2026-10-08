"""Optional NumPy estimator checks; independent of DSP/rendered probe data."""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from pitch_estimator import fundamental


class PitchEstimatorTests(unittest.TestCase):
    def test_known_fundamentals_at_all_three_rates(self):
        for rate in [44100, 48000, 96000]:
            times = np.arange(round(2.2*rate))/rate
            for expected in [60, 329.627557, 1400]:
                with self.subTest(rate=rate, expected=expected):
                    signal = .2*np.sin(2*np.pi*expected*times)+.05*np.sin(4*np.pi*expected*times)
                    actual, ratio = fundamental(signal, rate, expected, [.5, 2.05])
                    self.assertLess(abs(1200*np.log2(actual/expected)), .001)
                    self.assertGreater(ratio, .95)

    def test_missing_fundamental_fails_observability_at_each_rate(self):
        for rate in [44100, 48000, 96000]:
            with self.subTest(rate=rate):
                times = np.arange(round(2.2*rate))/rate
                signal = .2*np.sin(4*np.pi*329.627557*times)
                _, ratio = fundamental(signal, rate, 329.627557, [.5, 2.05])
                self.assertLess(ratio, .05)


if __name__ == '__main__':
    unittest.main()
