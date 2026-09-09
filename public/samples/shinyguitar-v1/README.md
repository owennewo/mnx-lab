# Shinyguitar microphone subset

Source: Karoryfer Shinyguitar, played and mapped by D. Smolken.
https://shop.karoryfer.com/pages/free-shinyguitar
https://github.com/sfzinstruments/karoryfer.shinyguitar
Pinned revision: 57243cca85277dbcc120ce17c6178032f93c80f3

CC0-1.0; full text in LICENSE. This subset contains only derived audio, no upstream
GUI, SFZ engine or bank signature. Original paths/hashes and conversion command
are in manifest.json. The root names use scientific pitch (A4 = MIDI 69 = 440 Hz);
c4 has root 60 even where the upstream mapping leaves pitch_keycenter implicit.

Converted with ffmpeg to mono 24 kHz 16-bit FLAC, retaining at most five seconds
and fading the final 100 ms. No per-file normalization or synthesized loop.
12 root pitches × source velocity layers 2/4 × alternate takes 1/2.
