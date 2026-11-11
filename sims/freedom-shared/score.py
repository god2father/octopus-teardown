"""Score for the Freedom teardown film (fan tribute): a cool minor bed at 96 bpm the whole way, a soft click on every
operator press, a rising tone as the phase shift colours the armor, thruster air from lift-off to landing, one riser
into the full-burst volley that lands on five staggered hits, whooshes for the teardown and the reassembly.

    python .claude/skills/teardown/run_sfx.py sims/freedom-shared/score.py

Times mirror freedom-shared/film.js (SCRIPT, TAKEOFF, LANDING) and kin.js (deployT, chargeT): every beat comes from
../freedom-film/timeline.json or from those constants, never a typed guess.
"""

import os

from sfx.score_kit import airy, bang, bed, chords, hz, thud
from sfx.synth import click, impact, riser, whoosh

TIMELINE = "../freedom-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "freedom-score.wav")
TARGET_LUFS = -14.0
SEED = 10

CHORDS = chords("Dm9:D2 A2 C3 E3 F3/D1", "Bbmaj7:Bb2 D3 F3 A3/Bb1", "Fmaj7:F2 C3 E3 A3/F1", "C6:C3 E3 G3 A3/C2")
MOTIF = [(0.5, hz("A4")), (1.5, hz("F4")), (2.5, hz("E4"))]
# film.js
PS_ON = 1.2
TAKEOFF = (2.6, 5.0)
LANDING = (31.0, 33.0)
BURST = 19.2
EXPLODE = 24.0
REASSEMBLE = 28.0
# kin.js
DEPLOY_T = 1.6
CHARGE_T = 1.85


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 96, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(), hats=8, swing=0.0, keys_vel=0.65, keys_lp=3400)
    mix.put_stereo(0, left, right, 0.11)
    mix.put(0, low, 0.11)
    mix.put(0, drums, 0.035)
    # every operator press, the beats in the timeline that are presses (the volley and landing are not)
    volley = BURST + DEPLOY_T + CHARGE_T
    for t in tl["beats"]:
        if abs(t - volley) > 0.05 and abs(t - TAKEOFF[0]) > 0.05 and abs(t - LANDING[0]) > 0.05:
            mix.put(t, click(2400, 0.025), 0.05)
    # the phase shift: a short rising air as the colour comes up
    mix.put(PS_ON, airy(1.4, 300, 2200, 0.7), 0.03)
    # thrusters: air through the flight, a thud as the feet leave and touch the pad
    mix.put(TAKEOFF[0], thud(70, 0.08, 0.4), 0.05)
    mix.put(TAKEOFF[0], airy(TAKEOFF[1] - TAKEOFF[0] + 0.8, 250, 900, 0.8), 0.035)
    mix.put(LANDING[0] - 0.4, airy(LANDING[1] - LANDING[0] + 0.4, 900, 250, 0.8), 0.03)
    mix.put(LANDING[1], thud(62, 0.09, 0.4), 0.06)
    # the volley: one riser through the charge, five hits 40 ms apart, one low impact under them
    mix.put(volley - CHARGE_T, riser(CHARGE_T), 0.05)
    for i in range(5):
        mix.put(volley + i * 0.04, bang(0.9, seed=i), 0.07)
    mix.put(volley, impact(1.4), 0.07)
    # teardown out, reassembly in
    mix.put(EXPLODE, whoosh(1.6, 300, 1800, 0.35), 0.05)
    mix.put(REASSEMBLE, whoosh(1.6, 1800, 300, 0.65), 0.045)
