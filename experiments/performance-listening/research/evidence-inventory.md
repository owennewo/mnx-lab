# Real-source evidence inventory — R1

Read-only audit, 2026-09-25. No ingestion, golden, listening candidate, reserved access, recording download, library write or annotation correction.

## Scope and evidence

The local Soundslice cache contains 99 distinct pieces in the cached library/list pages, 84 sync sidecars and 103 recording entries. All cached list pages have no next-page URL. 15 listed pieces lack a sync sidecar and are explicitly excluded below. Cache page fetch dates range from 2026-09-11T22:19:25.513262+00:00 to 2026-09-13T22:14:06.905186+00:00. This is a complete census of this available snapshot, not proof that the live library has not changed.

Inputs: `/home/williao/dev/soundslice-cli/gp/index.sqlite` opened with `mode=ro`, and its sibling `files/*.sync.json`, `*.lists.json`, and GP exports. No credentials were read. The production clean-room GP importer and `linearizePasses` read all 84 available paired scores; no score was modified. Score and sidecar SHA-256 identities below make this inventory traceable without committing private sources or annotations.

## Eligibility decision

**No real-source set is ready to freeze from this evidence yet.** A guitar-only score does not prove that the recording is solo, that its performer follows this score version, or that its sync labels are accurate. All rows remain unqualified for those reasons unless an additional concrete exclusion is shown. No row is silently counted as independent real-performance evidence.

First hand-check shortlist (inference from titles/credits, not an acoustic finding): Romanza `ptkHc`, Anji `SYxHc`, Dust In The Wind `qrpHc`, Imagine `D6dbc`, and Sign of the Times `ZBGdc`. Anji has cached audio as well as a video entry. Check solo status, performer identity, actual route and score correspondence independently before selecting any of them; all variants of a piece and performer/session must stay in one partition. Mixed or vocal recordings remain possible later following evidence, not note-assessment evidence.

## Common limits applied to every row

- **Score/version:** the paired GP hash identifies the score inspected today. Sidecars name a score filename, not a score-version hash at annotation time. A structural range fit is necessary, not proof of correspondence.
- **Route:** bars are performed-bar indices, zero based; `W/P` is written/performed bar count from the current score walk. A bar equal to P can be a final boundary; it is not an extra performed bar. A range exceeding P, missing jumps or sparse anchors requires investigation. No repeat correspondence is inferred from an interpolation.
- **Precision:** anchors are observed bar/inner-bar positions with no measured uncertainty. Decimal seconds are not evidence of millisecond precision. `inner` counts nonzero 0–480 offsets; `gaps` counts adjacent bar jumps greater than one. Regions outside the first/last anchor remain unknown; interpolated positions would be separately labelled, with bounded uncertainty only after calibration/independent checks. No pitch/onset labels exist.
- **Rights/access:** cache availability or a YouTube URL does not supply a reuse licence. Rights and extraction/access permission are unestablished for every library row; no media is copied or committed here. Uploaded local files are available for inspection but their licence is likewise unrecorded. Remote URLs have not been tested or fetched in this audit.
- **Calibration:** every real row still needs decoded media duration, time-origin/crop reconciliation, offset and drift checks against audible landmarks, an independently checked anchor sample, and the tolerance that sample supports. `cropped_duration` is export metadata, not authoritative decoded duration.
- **Population/profile:** the score may be guitar-only while the recording includes vocals/other instruments. Solo/mixed status, player/session identity, timbre, room/noise and musical freedoms are unverified. These missing facts prevent qualification, not the inventory itself.

## Every available recording

All rows inherit the common precision, rights, calibration and solo-status limits above. “range fits” only checks endpoints against the current unrolled score length. “local” means a named media file exists.

| Piece / recording | Score W/P | Anchors: count; seconds; bars; inner/gaps | Access | Route compatibility / exclusion |
|---|---|---|---|---|
| ABBA — The Winner Takes It All (`F2msc` / `1872366`, Video) | 75/91 | 91; 2.464–218.520s; 0–90; 0/0 | [YouTube](https://www.youtube.com/watch?v=K643ZIiG-18) | range fits; score version and actual route unverified |
| A-Ha — Take On Me (melody) (`42CHc` / `1662005`, Video) | 59/59 | 60; 0.969–123.797s; 0–59; 0/0 | [YouTube](https://www.youtube.com/watch?v=GhlyDeOZM-g) | range fits; score version and actual route unverified |
| A-Ha — Take on me (`tgkHc` / `1653867`, End video) | 34/62 | 48; 41.058–134.654s; 12–59; 0/0 | [YouTube](https://www.youtube.com/watch?v=R0GaGp0C7DU) | range fits; score version and actual route unverified |
| A-Ha — Take on me (`tgkHc` / `1653798`, Main video) | 34/62 | 63; 3.304–140.091s; 0–62; 0/0 | [YouTube](https://www.youtube.com/watch?v=R0GaGp0C7DU) | range fits; score version and actual route unverified |
| All About Eve — Martha's Harbour (`mTwJc` / `1754014`, Video 2) | 41/55 | 88; 62.361–218.290s; 0–87; 0/0 | [YouTube](https://www.youtube.com/watch?v=jNL8CS9-iVs) | HOLD: anchors exceed current performed route |
|  — Autumn Leaves (`z7Wsc` / `1857326`, Video) | 32/32 | 33; 0.256–79.432s; 0–32; 0/0 | [YouTube](https://www.youtube.com/watch?v=sRkf2enwm5k) | range fits; score version and actual route unverified |
|  — Baby Please Don't Go (`NWhsc` / `1872321`, Video) | 40/95 | 96; 0.160–156.944s; 0–95; 0/0 | local Baby_Please_Don_t_Go_NWhsc.mp4 | range fits; score version and actual route unverified |
| Bananarama — Cruel Summer (`vFlHc` / `1659098`, Video) | 72/72 | 73; 0.560–143.351s; 0–72; 0/0 | [YouTube](https://www.youtube.com/watch?v=54VkpaPCVEA) | range fits; score version and actual route unverified |
| Beatles — Blackbird (`87NHc` / `1647169`, Video) | 39/58 | 58; 0.000–135.014s; 0–57; 0/0 | [YouTube](https://www.youtube.com/watch?v=Man4Xw8Xypo) | range fits; score version and actual route unverified |
| Bert Jansch — Blackwaterside (`3Hy8c` / `1915566`, Video) | 40/37 | 96; 0.672–187.921s; 0–95; 0/0 | [YouTube](https://www.youtube.com/watch?v=Xj4MvRNnqtQ) | HOLD: anchors exceed current performed route |
| Bert Jansch — Blackwaterside lesson (`9Bw8c` / `1916259`, Video) | 32/63 | 3; 930.576–938.796s; 0–2; 0/0 | [YouTube](https://www.youtube.com/watch?v=2o1psTvQncg) | range fits; score version and actual route unverified |
| Bert Jansch — Blackwaterside lesson (`9Bw8c` / `1916325`, Video 2) | 32/63 | 109; 0.010–219.707s; 0–108; 0/0 | [YouTube](https://www.youtube.com/watch?v=hG8gVzrhllM) | HOLD: anchors exceed current performed route |
| Bert Jansch (Chris Brain) — Fresh as a sweet sunday morning (`GrMJc` / `1750927`, Video) | 34/100 | 101; 0.623–181.916s; 0–100; 0/0 | [YouTube](https://www.youtube.com/watch?v=HDXvJ7Coa6I) | range fits; score version and actual route unverified |
| Bert Jansch (Chris Brain) — Fresh as a sweet sunday morning (`GrMJc` / `1811010`, Video 2) | 34/100 | 101; 5.382–199.417s; 0–100; 0/0 | [YouTube](https://www.youtube.com/watch?v=JU9H5kloykA) | range fits; score version and actual route unverified |
| Bert Jansch — Needle Of Death (`9lRdc` / `1964368`, Audio) | 42/148 | 151; 0.584–194.905s; 0–150; 0/0 | local Bert_Jansch_Needle_Of_Death_9lRdc.mp3 | HOLD: anchors exceed current performed route |
| Bert Jansch — Running From Home (`gn-8c` / `1933324`, Video) | 101/101 | 102; 2.179–141.085s; 0–101; 0/0 | [YouTube](https://www.youtube.com/watch?v=pFRjF8C-rJw) | range fits; score version and actual route unverified |
| Bert Jansch — Strolling Down the highway (`wB-dc` / `1990513`, Audio) | 15/99 | 99; 0.024–180.379s; 0–98; 0/0 | local Bert_Jansch_Strolling_Down_the_highway_wB-dc.mp3 | range fits; score version and actual route unverified |
| Bert Jansch — Tell Me What Is True Love (`ZtD8c` / `1914429`, Video) | 29/67 | 68; 0.328–114.603s; 0–67; 0/0 | [YouTube](https://www.youtube.com/watch?v=d-x9kbLJKhw) | range fits; score version and actual route unverified |
| Billy Joel — Lullabye (Goodnight, My Angel) (`DfMbc` / `1794987`, Video) | 64/64 | 65; 2.469–215.923s; 0–64; 0/0 | [YouTube](https://www.youtube.com/watch?v=aABtMexWA5w) | range fits; score version and actual route unverified |
|  — Bizarre Love Triangle (`NbCHc` / `1662295`, Video) | 59/59 | 60; 2.328–118.775s; 0–59; 0/0 | [YouTube](https://www.youtube.com/watch?v=ISKQDCLpDSY) | range fits; score version and actual route unverified |
| Bob Dylan (Carson McKee) — Simple Twist Of Fate (`368Jc` / `1767782`, Video) | 47/43 | 152; 46.583–367.538s; 0–151; 0/0 | [YouTube](https://www.youtube.com/watch?v=okR9bmT3fnw) | HOLD: anchors exceed current performed route |
| Bob Dylan — Don't Think Twice, It's Alright (`cvrdc` / `1997331`, Video) | 33/26 | 101; 2.496–218.483s; 0–100; 0/0 | [YouTube](https://www.youtube.com/watch?v=LXEARHnUH_g) | HOLD: anchors exceed current performed route |
| Bruce Springsteen (Carson Mckee) — I'm on Fire (`NTYTc` / `1710834`, Video) | 62/98 | 99; 477.437–664.469s; 0–98; 0/0 | [YouTube](https://www.youtube.com/watch?v=rUWvzCWu7_Y) | range fits; score version and actual route unverified |
|  — Candy Man (`f74Hc` / `1654377`, Video) | 17/17 | 18; 0.000–51.117s; 0–17; 0/0 | [YouTube](https://www.youtube.com/watch?v=PDPFePPOWz8) | range fits; score version and actual route unverified |
|  — Candyman (`7R21c` / `1885000`, Video1) | 46/30 | 176; 0.319–215.467s; 0–175; 0/0 | [YouTube](https://www.youtube.com/watch?v=OJI5ePeBGlQ) | HOLD: anchors exceed current performed route |
|  — Candyman (`7R21c` / `1885454`, Video) | 46/30 | 90; 43.214–147.626s; 0–89; 0/0 | [YouTube](https://www.youtube.com/watch?v=_SN7kNg5Q54) | HOLD: anchors exceed current performed route |
| Catatonia — Don't need the sunshine (`4HfTc` / `1705472`, Video) | 98/110 | 111; 9.838–218.154s; 0–110; 0/0 | [YouTube](https://www.youtube.com/watch?v=yBn73BoIQEE) | range fits; score version and actual route unverified |
| Chris Brain (Dick Gaughan) — Now Westlin Winds (`hth1c` / `1907268`, Video) | 31/116 | 37; 0.358–71.842s; 0–36; 0/0 | [YouTube](https://www.youtube.com/watch?v=_MFSbSEzRUs) | range fits; score version and actual route unverified |
| Chris Brain (Dick Gaughan) — Now Westlin Winds (`hth1c` / `1907282`, Video 2) | 31/116 | 117; 0.024–240.828s; 0–116; 0/0 | [YouTube](https://www.youtube.com/watch?v=nTt-aG2sCFQ) | range fits; score version and actual route unverified |
| Chris Brain — Steady Away (`5cBJc` / `1770577`, Video) | 41/20 | 151; 14.478–213.240s; 0–150; 0/0 | [YouTube](https://www.youtube.com/watch?v=J-DtL5OEHvo) | HOLD: anchors exceed current performed route |
| Chris Brain — Sun did glide (`5qcJc` / `1746509`, Video) | 77/55 | 154; 0.504–226.849s; 0–153; 0/0 | [YouTube](https://www.youtube.com/watch?v=iol5eETQsqw) | HOLD: anchors exceed current performed route |
|  — Curragh of Kildare (`PWsdc` / `1969997`, Video) | 22/106 | 107; 0.016–240.833s; 0–106; 0/0 | [YouTube](https://www.youtube.com/watch?v=1tinBOskrts) | range fits; score version and actual route unverified |
| Davy Graham — Anji (`SYxHc` / `1685781`, Video) | 72/90 | 90; 0.228–139.602s; 0–89; 0/0 | [YouTube](https://www.youtube.com/watch?v=RibXYEtVB1Q) | range fits; score version and actual route unverified |
| Davy Graham — Anji (`SYxHc` / `1709786`, Audio) | 72/90 | 0; none | media unavailable in cache | EXCLUDE: no anchors |
| Davy Graham — Anji (`SYxHc` / `1709794`, Audio 2) | 72/90 | 90; 0.288–139.757s; 0–89; 0/0 | local Davy_Graham_Anji_SYxHc.1709794.mp3 | range fits; score version and actual route unverified |
| Donavan (Chris Brain) — Colours (`w8DJc` / `1749808`, Video) | 48/128 | 129; 1.061–162.740s; 0–128; 0/0 | [YouTube](https://www.youtube.com/watch?v=rq-SzBpbd9E) | range fits; score version and actual route unverified |
| Eddie Berman with Laura Marling — Like a rolling stone (`BRLHc` / `1681631`, Video) | 39/141 | 142; 19.707–404.454s; 0–141; 0/0 | [YouTube](https://www.youtube.com/watch?v=USiYjISBoEw) | range fits; score version and actual route unverified |
| Elizabeth Cotton — Freight Train (`yZ4Hc` / `1655405`, Video) | 84/84 | 85; 0.285–202.915s; 0–84; 0/0 | [YouTube](https://www.youtube.com/watch?v=N3brH0rQ2IM) | range fits; score version and actual route unverified |
| Elizabeth Cotton — Freight Train (`yZ4Hc` / `1656407`, Audio) | 84/84 | 87; 0.520–204.490s; 0–85; 1/0 | local Elizabeth_Cotton_Freight_Train_yZ4Hc.mp3 | HOLD: anchors exceed current performed route |
| Erik Satie — Gymnopedie No.1 (`Bd2Hc` / `1661149`, Video) | 46/78 | 80; 0.752–179.473s; 0–78; 1/0 | [YouTube](https://www.youtube.com/watch?v=Dhv4F1pFWGo) | range fits; score version and actual route unverified |
| Extreme — More than words (`-RBHc` / `1678909`, Video) | 85/85 | 86; 2.141–228.095s; 0–85; 0/0 | [YouTube](https://www.youtube.com/watch?v=d0EHT3oEI5g) | range fits; score version and actual route unverified |
| Fionn Regan — Be Good or Be Gone (`pKTTc` / `1719365`, Audio) | 27/75 | 76; 1.096–194.271s; 0–75; 0/0 | local Fionn_Regan_Be_Good_or_Be_Gone_pKTTc.mp3 | range fits; score version and actual route unverified |
| Fleetwood Mac (Corey Heuval) — Never going back again (`xYzJc` / `1757041`, Video) | 62/88 | 97; 4.891–148.983s; 0–96; 0/0 | [YouTube](https://www.youtube.com/watch?v=SzGZU3gmtxs) | HOLD: anchors exceed current performed route |
| Fleetwood Mac — Landslide (Live Version) (`xfQTc` / `1734516`, Video) | 63/65 | 66; 3.008–232.282s; 0–65; 0/0 | [YouTube](https://www.youtube.com/watch?v=WM7-PYtXtJM) | range fits; score version and actual route unverified |
| Fleetwood Mac — Landslide (Live Version) (`xfQTc` / `1736512`, Audio) | 63/65 | 0; none | media unavailable in cache | EXCLUDE: no anchors |
| Fleetwood Mac — Landslide (Live Version) (`xfQTc` / `1736519`, Audio 2) | 63/65 | 0; none | media unavailable in cache | EXCLUDE: no anchors |
| Fleetwood Mac — Landslide (Live Version) (`xfQTc` / `1736520`, Audio) | 63/65 | 66; 3.107–231.733s; 0–65; 0/0 | local Fleetwood_Mac_Landslide_Live_Version_xfQTc.1736520.mp3 | range fits; score version and actual route unverified |
|  — Golden Days (`--YJc` / `1754750`, Video) | 57/89 | 90; 0.812–121.217s; 0–89; 0/0 | [YouTube](https://www.youtube.com/watch?v=DSTszwkfaG4) | range fits; score version and actual route unverified |
| Haley Heynderickx — The Bug Collector (`Ppf7c` / `2004681`, Video) | 85/97 | 98; 0.000–217.781s; 0–97; 0/0 | [YouTube](https://www.youtube.com/watch?v=26SdRPawtC0) | range fits; score version and actual route unverified |
| Harry Styles (Arr. David van Ooijen) — Sign of the Times (`ZBGdc` / `1996315`, Video) | 36/36 | 85; 0.656–336.848s; 0–84; 0/0 | [YouTube](https://www.youtube.com/watch?v=7qv9Sq5oAE8) | HOLD: anchors exceed current performed route |
| Jackson Browne (Ole Kirkeng) — These Days (`DwvHc` / `1699352`, Video) | 33/61 | 62; 1.116–206.882s; 0–61; 0/0 | [YouTube](https://www.youtube.com/watch?v=dftmeyRIjoE) | range fits; score version and actual route unverified |
| Jackson C.Frank (Ole Kirkeng) — Blues Run The Game (`wJPHc` / `1683359`, Video) | 151/151 | 152; 13.018–242.894s; 0–151; 0/0 | [YouTube](https://www.youtube.com/watch?v=XE4NOaCMfmk) | range fits; score version and actual route unverified |
| Jackson C.Frank (Ole Kirkeng) — Blues Run The Game (`wJPHc` / `1683378`, Video 2) | 151/151 | 152; 13.151–243.511s; 0–151; 0/0 | local Jackson_C_Frank_Ole_Kirkeng_Blues_Run_The_Game_wJPHc.mp4 | range fits; score version and actual route unverified |
| John Bramwell — Northern Skies (`62hTc` / `1742472`, Video) | 73/73 | 74; 25.186–188.182s; 0–73; 0/0 | [YouTube](https://www.youtube.com/watch?v=Qhpe7N0SqG4) | range fits; score version and actual route unverified |
| John Lennon (Tim Van Roy) — Imagine (`D6dbc` / `1813051`, Video) | 17/17 | 59; 0.275–216.716s; 0–58; 0/0 | [YouTube](https://www.youtube.com/watch?v=Z4DHY0qbRVg) | HOLD: anchors exceed current performed route |
| Johnny Cash — Hurt (`MbkHc` / `1653406`, Video) | 35/81 | 82; 0.000–215.556s; 0–81; 0/0 | [YouTube](https://www.youtube.com/watch?v=8AHCfZTRGiI) | range fits; score version and actual route unverified |
| Joshua Kadison — Jesse (`jmYTc` / `1711436`, Video) | 94/94 | 96; 7.368–299.682s; 0–94; 1/0 | [YouTube](https://www.youtube.com/watch?v=Drg78iki5fY) | range fits; score version and actual route unverified |
| Joshua Kadison — Jesse (`jmYTc` / `1711902`, Audio) | 94/94 | 96; 7.445–301.413s; 0–94; 1/0 | local Joshua_Kadison_Jesse_jmYTc.mp3 | range fits; score version and actual route unverified |
| Led Zepelin (Justin Johnson) — Going to California (`2C9Hc` / `1684121`, Video) | 131/131 | 132; 0.640–246.358s; 0–131; 0/0 | [YouTube](https://www.youtube.com/watch?v=lkYm7cOPKm0) | range fits; score version and actual route unverified |
| Leonard Cohen — Halelujah (`-qD1c` / `1879806`, Video) | 37/65 | 66; 1.200–142.016s; 0–65; 0/0 | [YouTube](https://www.youtube.com/watch?v=9Ucgmg-4aLg) | range fits; score version and actual route unverified |
| Leonard Cohen — Suzanne (`M-t1c` / `1902921`, Video) | 45/119 | 118; 9.112–230.658s; 0–117; 0/0 | [YouTube](https://www.youtube.com/watch?v=eNZu2yDbWVY) | range fits; score version and actual route unverified |
|  — Let it snow (`W8Mbc` / `1795164`, Video) | 44/28 | 137; 0.573–172.072s; 0–136; 0/0 | [YouTube](https://www.youtube.com/watch?v=Ml6BnkoV8TQ) | HOLD: anchors exceed current performed route |
|  — Little Drummer Boy (`Z7mJc` / `1788135`, Video) | 65/65 | 63; 0.000–156.271s; 0–62; 0/0 | [YouTube](https://www.youtube.com/watch?v=wdfaJ4ZXYc4) | range fits; score version and actual route unverified |
| Luke Edwards — Romanza (`ptkHc` / `1653772`, Video) | 32/64 | 70; 1.280–127.189s; 0–64; 5/0 | [YouTube](https://www.youtube.com/watch?v=FyyBQ5f_JVM) | range fits; score version and actual route unverified |
| Marco Cirillo — cirillo-2025-08-09 (`LvTHc` / `1669669`, Video) | 35/35 | 0; none | [YouTube](https://www.youtube.com/watch?v=PjTkyKa3uNg) | EXCLUDE: no anchors |
| Mason Williams — Classical Gas (`QKRHc` / `1663639`, Audio) | 85/95 | 100; 0.168–148.231s; 0–95; 4/0 | local Mason_Williams_Classical_Gas_QKRHc.mp3 | range fits; score version and actual route unverified |
| Meic Stevens — Erwan (`zykdc` / `1955215`, Video) | 58/93 | 93; 1.067–207.819s; 0–92; 0/0 | [YouTube](https://www.youtube.com/watch?v=bZz07GmUsNM) | range fits; score version and actual route unverified |
| Meic Stevens — Môr o Gariad (`1YnHc` / `1688701`, Video) | 75/75 | 78; 0.000–184.813s; 0–75; 2/0 | [YouTube](https://www.youtube.com/watch?v=vPxPQwcEXvM) | range fits; score version and actual route unverified |
| Mykola Leontovych / Peter J. Wilhousky — Carol of the Bells (`8nSJc` / `1789746`, Video) | 65/89 | 90; 0.488–106.663s; 0–89; 0/0 | [YouTube](https://www.youtube.com/watch?v=nt8-Xrh0DjY) | range fits; score version and actual route unverified |
| Narimasa — Broken Man (`K4Hbc` / `1811050`, Video) | 29/48 | 49; 0.256–98.113s; 0–48; 0/0 | [YouTube](https://www.youtube.com/watch?v=ibRj_Hj2yCE) | range fits; score version and actual route unverified |
| Nick Drake — Day is Done (`lt2Hc` / `1661467`, Video) | 74/74 | 74; 0.320–142.765s; 0–73; 0/0 | [YouTube](https://www.youtube.com/watch?v=9VNfZwvuyBA) | range fits; score version and actual route unverified |
| Nick Drake — One Of These Things First (`kLJ1c` / `1889643`, Video) | 71/184 | 286; 0.245–285.606s; 0–285; 0/0 | [YouTube](https://www.youtube.com/watch?v=vDtsgVgAx6k) | HOLD: anchors exceed current performed route |
| Nick Drake — River Man (`HcpTc` / `1745001`, Video) | 64/96 | 97; 0.576–244.525s; 0–96; 0/0 | [YouTube](https://www.youtube.com/watch?v=EfyZ33NHd-o) | range fits; score version and actual route unverified |
| Nick Drake — Road (`5RlHc` / `1658563`, Audio) | 76/76 | 76; 4.576–120.867s; 0–75; 0/0 | local Nick_Drake_Road_5RlHc.mp3 | range fits; score version and actual route unverified |
| Nick Drake — Things Behind The Sun (`bB3Hc` / `1664778`, Audio) | 81/99 | 101; 0.117–234.163s; 0–100; 0/0 | local Nick_Drake_Things_Behind_The_Sun_bB3Hc.mp3 | HOLD: anchors exceed current performed route |
| Olivia Rodrigo — Begged (`Q2D7c` / `2015339`, Video) | 43/81 | 84; 1.605–214.783s; 0–83; 0/0 | [YouTube](https://www.youtube.com/watch?v=NmGGDYyJ8tU) | HOLD: anchors exceed current performed route |
|  — One of these things first (`WCJ1c` / `1889475`, Video) | 68/144 | 145; 0.192–166.052s; 0–144; 0/0 | [YouTube](https://www.youtube.com/watch?v=K0Mv2sT5pwk) | range fits; score version and actual route unverified |
| Pink Floyd — Is There Anybody Out There? (`3TJHc` / `1670022`, Video) | 44/44 | 45; 71.691–160.248s; 0–44; 0/0 | [YouTube](https://www.youtube.com/watch?v=CIxYe3G3Iz4) | range fits; score version and actual route unverified |
| Radiohead — No Surprises (original) (`5BFTc` / `1736551`, Video) | 59/71 | 72; 0.008–225.391s; 0–71; 0/0 | [YouTube](https://www.youtube.com/watch?v=u5CVsCnxyXg) | range fits; score version and actual route unverified |
| Radiohead — No Surprises (tutorial) (`JFbHc` / `1671367`, Video (slow)) | 45/53 | 54; 173.427–438.256s; 0–53; 0/0 | [YouTube](https://www.youtube.com/watch?v=K58zj3cpFDg) | range fits; score version and actual route unverified |
| Radiohead — No Surprises (tutorial) (`JFbHc` / `1671384`, Video (Fast)) | 45/53 | 54; 3.834–165.276s; 0–53; 0/0 | [YouTube](https://www.youtube.com/watch?v=K58zj3cpFDg) | range fits; score version and actual route unverified |
| Radiohead — No Surprises (tutorial) (`JFbHc` / `1736541`, Video) | 45/53 | 72; 0.008–225.391s; 0–71; 0/0 | [YouTube](https://www.youtube.com/watch?v=u5CVsCnxyXg) | HOLD: anchors exceed current performed route |
| Radiohead — Street Spirit (`mFc1c` / `1878232`, Video) | 145/145 | 146; 3.523–279.506s; 0–145; 0/0 | [YouTube](https://www.youtube.com/watch?v=DUi3iaA5MkY) | range fits; score version and actual route unverified |
| Robert Johnson — Kind Hearted Woman Blues (`hVvHc` / `1699284`, Audio) | 61/61 | 0; none | media unavailable in cache | EXCLUDE: no anchors |
| Robert Johnson — Kind Hearted Woman Blues (`hVvHc` / `1699288`, Audio 2) | 61/61 | 62; 0.976–170.844s; 0–61; 0/0 | local Robert_Johnson_Kind_Hearted_Woman_Blues_hVvHc.1699288.mp3 | range fits; score version and actual route unverified |
| Rolling Stones — Angie (`vrMHc` / `1652927`, Video) | 40/40 | 41; 15.872–99.077s; 0–40; 0/0 | [YouTube](https://www.youtube.com/watch?v=xAGWmL00QQk) | range fits; score version and actual route unverified |
| Stefan Grossman — Vestapol (`YZT1c` / `1889160`, Video) | 82/82 | 213; 1.732–279.621s; 0–212; 0/0 | [YouTube](https://www.youtube.com/watch?v=gIwas49B8Rg) | HOLD: anchors exceed current performed route |
| Sungha Jung — Dust In The Wind (`qrpHc` / `1702681`, Video) | 128/154 | 157; 9.032–211.141s; 0–156; 0/0 | [YouTube](https://www.youtube.com/watch?v=6caUN3HLJSI) | HOLD: anchors exceed current performed route |
| Surjan Stevens — Chicago (`PCZHc` / `1680340`, Video) | 53/145 | 146; 1.648–267.056s; 0–145; 0/0 | [YouTube](https://www.youtube.com/watch?v=jk68RQ6mfP8) | range fits; score version and actual route unverified |
|  — Sweet Child O Mine (`B2qHc` / `1666719`, Video) | 82/82 | 139; 0.427–285.956s; 0–138; 0/0 | [YouTube](https://www.youtube.com/watch?v=Pm8btN0cfKk) | HOLD: anchors exceed current performed route |
|  — Sweet Child O Mine (`B2qHc` / `1666722`, Audio) | 82/82 | 138; 0.472–281.054s; 0–137; 0/0 | local Sweet_Child_O_Mine_B2qHc.mp3 | HOLD: anchors exceed current performed route |
| Tears For Fears — Everybody Wants To Rule The World (`RwWHc` / `1677218`, Video) | 111/111 | 111; 1.144–240.615s; 0–110; 0/0 | [YouTube](https://www.youtube.com/watch?v=aqx5AO4fxDU) | range fits; score version and actual route unverified |
| Tears For Fears — Everybody Wants To Rule The World (`RwWHc` / `1678423`, Audio) | 111/111 | 111; 1.400–241.078s; 0–110; 0/0 | local Tears_For_Fears_Everybody_Wants_To_Rule_The_World_RwWHc.mp3 | range fits; score version and actual route unverified |
| The Allman Brothers — Little Martha (`c7J1c` / `1889611`, Video) | 62/130 | 93; 8.004–134.397s; 0–92; 0/0 | [YouTube](https://www.youtube.com/watch?v=kx6luUqp4b0) | EXCLUDE: score route diagnostic; missing jump target |
| The Beatles — Here Comes the Sun (`zvVHc` / `1649660`, Video) | 87/115 | 116; 0.000–182.752s; 0–115; 0/0 | [YouTube](https://www.youtube.com/watch?v=GKdl-GCsNJ0) | range fits; score version and actual route unverified |
| The Cure — Just Like Heaven (`Bd41c` / `1881952`, Video) | 102/110 | 111; 0.000–190.344s; 0–110; 0/0 | [YouTube](https://www.youtube.com/watch?v=AX98XbrqcCo) | range fits; score version and actual route unverified |
| The Las — There she goes (`kMQJc` / `1779267`, Video) | 17/21 | 21; 0.000–39.313s; 0–20; 0/0 | [YouTube](https://www.youtube.com/watch?v=KYllxZWEZR8) | range fits; score version and actual route unverified |
| The Police — Every Breath You Take (`68S1c` / `1909252`, Video) | 101/101 | 102; 2.040–211.035s; 0–101; 0/0 | [YouTube](https://www.youtube.com/watch?v=HAVUckcrH7s) | range fits; score version and actual route unverified |
|  — The Staves - In The Long Run (`YhNTc` / `1703265`, Video) | 66/78 | 79; 34.097–202.361s; 0–78; 0/0 | [YouTube](https://www.youtube.com/watch?v=cQXNUGMERQM) | range fits; score version and actual route unverified |
| Tori Amos — China (`srwqc` / `1619501`, Video) | 78/78 | 80; 2.912–203.560s; 0–79; 0/0 | [YouTube](https://www.youtube.com/watch?v=G3z9hI9P90g) | HOLD: anchors exceed current performed route |
| Tracy Chapman — Fast Car (`vVqHc` / `1666484`, Audio) | 114/114 | 115; 1.320–264.352s; 0–114; 0/0 | local Tracy_Chapman_Fast_Car_vVqHc.mp3 | range fits; score version and actual route unverified |
|  — Wicked game (`FpHHc` / `1668896`, Video) | 102/102 | 104; 4.784–226.823s; 0–103; 0/0 | [YouTube](https://www.youtube.com/watch?v=82p6wSWJ9Xg) | HOLD: anchors exceed current performed route |
|  — Wicked game (`FpHHc` / `1668928`, Audio) | 102/102 | 133; 0.000–284.034s; 0–132; 0/0 | local Wicked_game_FpHHc.mp3 | HOLD: anchors exceed current performed route |

## Listed pieces without a sync sidecar

Each is excluded until a recording and its independently traceable anchors are available. This includes potential solo material; none is omitted based on an assumed genre.

| Piece | Missing evidence |
|---|---|
| Joni Mitchel (Emil Ernebro) — Both Sides Now (`4Rc8c`) | Sync sidecar absent; GP exists; recording identity, route, anchors, precision, rights and access unestablished |
| Beatles (fingerstyle book) — Eleanor Rigby (`Bc9Jc`) | Sync sidecar absent; GP exists; recording identity, route, anchors, precision, rights and access unestablished |
|  — Camptown Races (`Dhgsc`) | Sync sidecar absent; GP exists; recording identity, route, anchors, precision, rights and access unestablished |
| Josh Turner — Eleanor Rigby (The Beatles) (`QfZcc`) | Sync sidecar absent; paired GP absent; recording identity, route, anchors, precision, rights and access unestablished |
| Mike Dawes — Fingerstyle Mastery: Travis Picking Part 2 (`RbYJc`) | Sync sidecar absent; GP exists; recording identity, route, anchors, precision, rights and access unestablished |
| Ben Howard — Old Pine (`RpHHc`) | Sync sidecar absent; GP exists; recording identity, route, anchors, precision, rights and access unestablished |
|  — Yankee Doodle (`W9rsc`) | Sync sidecar absent; GP exists; recording identity, route, anchors, precision, rights and access unestablished |
|  — House of the Rising Sun (`YHGsc`) | Sync sidecar absent; GP exists; recording identity, route, anchors, precision, rights and access unestablished |
|  — Kum-ba-yah (`f4hsc`) | Sync sidecar absent; GP exists; recording identity, route, anchors, precision, rights and access unestablished |
| Professor Rowlands — The Break of Day / Torriad y Dydd (`kQk8c`) | Sync sidecar absent; paired GP absent; recording identity, route, anchors, precision, rights and access unestablished |
|  — Untitled (`n4kdc`) | Sync sidecar absent; paired GP absent; recording identity, route, anchors, precision, rights and access unestablished |
|  — Silent Night 2020 (`pxFJc`) | Sync sidecar absent; GP exists; recording identity, route, anchors, precision, rights and access unestablished |
|  — Oh! Susanna (`v68sc`) | Sync sidecar absent; GP exists; recording identity, route, anchors, precision, rights and access unestablished |
| Marco Cirillo — Simple fingerpicking pattern (`xRFYc`) | Sync sidecar absent; paired GP absent; recording identity, route, anchors, precision, rights and access unestablished |
| Fingerstyle Guitar Manual — Banks of the Ohio (`y87Jc`) | Sync sidecar absent; GP exists; recording identity, route, anchors, precision, rights and access unestablished |

## Score and annotation identities

SHA-256 is recorded in full. These are source snapshot identities, not frozen golden-set identities.

| Piece | Score SHA-256 | Sync sidecar SHA-256 |
|---|---|---|
| `F2msc` | `5d6d05684894b113a88d318ed6a538dbf87d0e806c47ba794796190784408d8e` | `364d561ab113a0657f49133c42fcc689104365d68bc8fae3a599b08600a36f0b` |
| `42CHc` | `4e03cc59065debb3106508d5be10d224949d7ee423849b0dd1b673ef553754f6` | `e657ceeb707d2d19c8e1a526d77c3d943b3a2a35c76182c083b9752bd77a9094` |
| `tgkHc` | `b37a0e6c00d0de71f3ac9de022f93291cb697b08e9cf1b5f11c59721a93d0faf` | `f3e4e5c91b9ac09949a9888aeb87b77228264477d3ef903523e2286369cacdd6` |
| `mTwJc` | `e6ad8ac56b6b1bf5a7a81ccdcdfd11789ef71f0fb9400ec7461cccb50cb77dd5` | `849da16df680a906b53d063657f27249f8b143ab1f665d28dd75afdf897e7cdd` |
| `z7Wsc` | `ebb4117000a40a21c528e8f64bdec1a44a9f7173a7c50802165f3b4af105978b` | `f40672046c51483e39e60b06d261717b7b5d1bbb73da4dac1da74a905523ea8e` |
| `NWhsc` | `96632b6e67b8f5a8351211fc185e17fe6e748e68f308a8fa10653d25027ce73f` | `0f290a60302f1340e7e5ec93218e0361de5e74f7dfdad815fb14dd79d103aaa9` |
| `vFlHc` | `fd1670f95e1269501ceac2c9a311aefa9d0b60a270cd1f5e120f146b4dd8f3a4` | `1dd4f53cd15893c6ab87bab528eeba2cff27c930a4c09d6f239d760b58994abe` |
| `87NHc` | `39aabef5e67466823b70d7a8758e0563dba545c50dbbc7d970d9753dae1e121e` | `c56708230cf43c41fc121c314a82f5d524a0a0d26b0e3ee42d271cf347ce3bf1` |
| `3Hy8c` | `332a62507d51f950951366f369e2bb43585fb83a2b7db441b117fbb0fe25e37f` | `2da968c1af2e8fdfe6fc84b2cd01d0d3ae45a4acc71d5bc023316410c21edd4c` |
| `9Bw8c` | `7ee9a3bd1396589d7aa2fab0437aa96fb592c50660cf7641bee664b8df62c0e7` | `c8774de4b48cc9fd8ff45902140d3ee1c11a9f3bfe719ae477e6fd2795d077a0` |
| `GrMJc` | `0386baef6509402a6620f587c13539315a21f4ccdd9ef6885f3e02cef47ac13f` | `ab9e4d9af04317943654cbb98cb72454872f108d61174f3b7efc0054046bc790` |
| `9lRdc` | `3efac07929074b7206cd5a98069b2946b20224da956e304c51b6e5485510a5c3` | `92414ba970f62da56e704ce3fec8c28a4e54070354cc1e2b7f22faa628345a86` |
| `gn-8c` | `6061ef66906b873f56c29b0f2e97787a4f41973518117244b071ef516fe5622f` | `3b5ed36b6d9798a9726950102c518ade33044055e716bc9e55a474fc54684dae` |
| `wB-dc` | `72261f4629049d1af0383fb444c732b71f2e9f750a412ad15109a2c89d77ee59` | `b95335e6e342ebabbfb45af5c751112e9382f7c616bed69d69656aa1dfca61cb` |
| `ZtD8c` | `654263634bcf5d5cd58858b7cefbe33833195cb7ed160d6cd9763830ffbfdd0d` | `abcede35da8bbea56e835819260758695a2bd0c1967a1e4f5b79df025e97437b` |
| `DfMbc` | `8bb260af8a47a6a103aced9d6bb877698291e514a397b4122ca6a656cd04a3bf` | `b51a1f21a10b10e46880e0927b31a28db2662a5c07bf14bc63c58afc828820b9` |
| `NbCHc` | `c1ec94557860075bce234e5e1c2e7ee3dd289d7b4a22ed969790e30309fa33aa` | `9729c9abe02e7d81f61616782e01cbd78c6ef775709c6b8340f294002085127f` |
| `368Jc` | `6a6f90ddba0040a0ad99054678a1ce382909bd781dab7b479de3495713f0b4cd` | `ed8330148f8c4f8e750206897278f1d4b64eb11da350ce49503d6088e6f9ea26` |
| `cvrdc` | `c0f36438f2cfe4c1b89c2b7051fb6c82825002bb5b1d0e8e1743c748bc41dab8` | `dcba05b006e15fd56938cb0c7f81e34177028c77afff58b14cec1e26b1314e17` |
| `NTYTc` | `d268db4ac624e2b13afcca6f1fc0521ea3c9b3e493a375d9039e4f9d44a8bdf3` | `453691a26058dda7f84982d9634fec56dfa0c41da18c4f9bcbf180844ba23e9d` |
| `f74Hc` | `255a498db82229ab92ae22b0354ece3364bfe3464ae719fb9cac716abcb115db` | `23441d77439572afd53a8b98c87d5b425a83f617a5a6a746c3716deb7dc0e98d` |
| `7R21c` | `4c262300104b6fa23bbedf5250a1420f4a3b804bbf6130d019aef56b5a0b6971` | `4bdfb03e1f1e5c37ce85a7f2705bd2416b66ad0f5e725c3d0c093751f49f990e` |
| `4HfTc` | `ffb78770ec29b6ba7d759132885e196e62e9ee67c00d251fce1e55da207e06da` | `a41f9eb1323ee83e6ef037f36b18573f3e6f2b59cce6612aee2780228e14ac1b` |
| `hth1c` | `3cb7687a8ddcc98cb76193da81a1c36e49908fe32921ca736f9a3a409ab15c78` | `b47223f48c4bf2a0de0e39dcbf20efbbacc4597e1affd7835fe14d21ced8645d` |
| `5cBJc` | `38b2f819ce02bd5dbe642695c9a5bff36f380ed8ccfe2538f7e1b07de689ad4a` | `411cb4ef6a31f630711679e10652aecc1d0c20c79e0f5361018ec7e353de4f34` |
| `5qcJc` | `088eabd425cb591af84f96fa794c11241dee05c1b973f0528bf42e5aa6389647` | `ddd8559b65e3615be00ef8028a0e117308801160d62950b737d81c1d439d52a5` |
| `PWsdc` | `ac0514c7b15e2d872a028a7f2bfb6d4e94b3a3be1b413f72464be2697e35cd70` | `beefdcf85ab29648006919ed0545b9faf36dd8af8ae5c50430ecf33ca3354572` |
| `SYxHc` | `bad33489b9a975df78f5a3613435ceffd10c2e89d0c7370e0a2c004564f7db82` | `0eed4029386d9c525c0302385f5eebf7ed6f7172a9e15898182ef93ca0303b8c` |
| `w8DJc` | `bf57fcaa214d9c8ecb8f79188d349276cbadb60ab2d655f82202c869a0559849` | `4e413e0edbec3dac85004305e207a333bf69b732c4f5261a784ecdc9de6e8bda` |
| `BRLHc` | `07e9a883918cc1bba486b6232214bfc6d703c1e025ef73bc5dc2dd4b9bf04cfc` | `afe94bd4f80857976a5e0352e4a9575469600c47a6fc6249135afe91f82b15e0` |
| `yZ4Hc` | `b5225ee222c8200ed8088ef83c8539cadf41cbf7622bd4b4ba8802233508b762` | `194c6350951b7ecb4966ef608078d073af23e44dba542961364b859663c52ede` |
| `Bd2Hc` | `1efa5e7d40516d9cabb28c37d0816b0b63fd72e1510fad2d8eeada0935b09f9d` | `abfee65c9cba51ec114c631943581f540f0f0c4e7522f6f084d376763458b8be` |
| `-RBHc` | `00ba5f043b496673006a5453ba48e5374d1bd8fc2cbae727fdeb608fe31322be` | `f1ce7e8c1b19829c119455d3f967cee363ff926af7fb72b7deb56f560c6071a2` |
| `pKTTc` | `be51d2e7c58fea9e4374b91d7e4248c973f15c2118b0b7dcb1d6dd9f49bf2914` | `694e22f9f21c242835061a80297d1fd68ffec70302170de76e8383a489227a9f` |
| `xYzJc` | `67bd32ad249d3c597e695589187abb99930b89b50973b187b4cd9bcde89ff2b2` | `5c2d62ca697db9dd339deb75b8fafa1bdb2eaa1b3d0d7088a771e9ff8b234a39` |
| `xfQTc` | `2969d152a04458baf35422b0a10fc1376bc4805310291dc5c7e8663e10baced6` | `5365f8a7528c85b225bb527d8fb38eac0601df338c2bea161e47e55a2e7aa8c0` |
| `--YJc` | `60384a76effba70d818489b44132bcd67fd87e0a2899faf568f8b95bfab5b900` | `f75aa39ee5a7f276f9b91332b81caf530f998f6bc8dcc723e4d7f6dd570eee7e` |
| `Ppf7c` | `a8bd6e6d127185522bd2e4fb906045c636351da3bb6348e6491272642d9c532b` | `66ea623f7692e7bd14c12fb59c028b8e6566d1de2fc659eb210a381c693ab957` |
| `ZBGdc` | `76da99b7bc8e870792d9bc24823bfa71d3bfeadaa3ca933e93d54a1d1f20c993` | `e6c896cc05972ab42899a69e9d0b24f1536580922dd6e8cbcb7a1da560568a30` |
| `DwvHc` | `3641e1f5a6008d9dfba26e4ee48a25e05503fc6096470ef92701221131ccbc46` | `04d19a8cdb6d79e987f27bf6ccef1aa4174748e757878bf7179529007a875d80` |
| `wJPHc` | `f657f3b18f10b65c82a373334a8d11863a2c5756ed4411f96a5f79f8b319bb20` | `9e3c51b5de5961cc124efe7cf387dd0b86582f2b3049f68914325aefee008632` |
| `62hTc` | `e9672846116e56a96ba2b52836dc0d13652cc9fae392850af4cc605ea7b4792d` | `07fa6eafd2a94e11473ca02efadae35315592d323c6deab7fa3f6868508ace69` |
| `D6dbc` | `2ad2a33455fcb805483b6d9a35daa65f6f3f1655184a3f568ce3d7c5ee166180` | `5a4b155b3798719070481ce791b84bc5fb1879e4860b333e3087bc5215cc3856` |
| `MbkHc` | `e00033d37a1e966b37d3e8c6940b25bf2e0a07662195bf4da78a9e5b26774196` | `aef729aa5bf87656d30c7d3315d697fc8327ea2ae0f1ec4ce859a8cdf07e32f4` |
| `jmYTc` | `8d9c66fb73d9fc2a2206037a03b332f324c7f58f2c8d09ff953a0df2c9e95f8b` | `bd099842caab87442f82a0130626bc326ad00ca8692fce5005cb2a0dc122eb88` |
| `2C9Hc` | `bcde73d414812f25f58e2defee8a80382c1848ed6c506de7b89fd1a532bc0191` | `e51e55d39a4fb920587860eaff5523b732fd7939464bef0fb87599dde3cd3a7e` |
| `-qD1c` | `1da7ec9d18700565f90ec4ca11b3352806451ead43e03d6bcb1c7f8e9e76013b` | `a30ac58f90007981258f424e6bce647bf0b9794bd0fa16c7a2b087cb8d2899d6` |
| `M-t1c` | `f587d09d6d3d1cbed1682ad4c4f9a04ac9041805f9abc07632ed5bbe42a47c2d` | `b0400fea81a5d84db411a38467211101b85e5bbc3fa8b17c77d40898c3d6d454` |
| `W8Mbc` | `d1a89fe2e30cf11038e7fe5adc9dceadf2b31345bd661e6c85af15b1fa5ccf71` | `30f4d631d68c5deda770babcc823c97cf837d862b5f6ef2fd2d370f706e36a1b` |
| `Z7mJc` | `fada9d49ca53000b73bb68814209dd5226ee1abeca3927c650d2b8e9163020c1` | `8fe8cf4aebac2de00f6076f129fbea9fb478acab332ae576aa88bccb0cdf69e4` |
| `ptkHc` | `5ea20cdd49d69f06c3600d4fb4307581986dda8f275e4a274c10e3dd0aacdabe` | `6d5cb62303fd7b2619025325d1d0144c188760964631fe6892258c4ed5b2563d` |
| `LvTHc` | `ca1a68a383733db1085850e2f85c22c005c3b2e33f4e61570860c17e2fb34ae4` | `3acabce87654ef262e90c5196d3ba73fa5e73717ba5bab14419bb8aa111fc5fc` |
| `QKRHc` | `86047369749586f58a928bd99129c59242f24393f06c8e5af9f7d3ab0237b30e` | `d4febcec977f0361e72218b92f6e22c2fb4ced63ad3080e098697ed2b6be629c` |
| `zykdc` | `45197cdd99d2ffd3ff6ab02dc0fc162f7df82c6651d9d4f5c9c2ca1e416b9e5e` | `5f798b168d0cc661242ab26b0b792404487c91ca7fae7df664c9ee6bcf3d9b87` |
| `1YnHc` | `c5eb5ef67be97aadf659b511fcf889f06fd635c88f8f769079015170b55cb41c` | `91eb7884cb08b29f0a6f369695aaddec61b58d842bd940ab2d93a36fdb6eb03e` |
| `8nSJc` | `75711ccac13a15955ef89722cab086dfbd95cb4df50918a36576a814b390bac4` | `f6301e2f330956a57121bdf7692116da8bfa629035f8a059d26fbc5fab5fce0e` |
| `K4Hbc` | `29c7781604df55052eec5641c97c6065b8771549c904325085b5a6457589f9e5` | `14443578d3b0db19d8f0036a1502f97b20442bbf31bc49aeb815bfabe75ead99` |
| `lt2Hc` | `544ac1f18164d0be6bd4ce2fbaf7381656865e8212dc1975b6083a1b3ec7acaa` | `fab7b51c98e819367e9a2e5e2edd352d7bc70630f8b23f693590f3e001854227` |
| `kLJ1c` | `8910e94886deceafb4d364cd75b7200ea85a0951c49ec3074d7ae4a62de4ffa5` | `737f03ef69f101da1ad9002cfdb9b5826059ccfc4834b52a91bee13f5e08f3fd` |
| `HcpTc` | `35b61ecda93338b73e36a66dca8169848ffaf8a74829274fc2743ed61f7706c1` | `86e2250bde5f864e5637a3a181f63a814b6049850a7c0133582653ba72e63874` |
| `5RlHc` | `0b56204fdf78a9109d34fe6c771a8a1ad0a6fc5929fba5a6ae74550b3b97c888` | `e1cb06692b93fff25aad123390242c9cbcb82bd69104843e7e38a0104a2ed05b` |
| `bB3Hc` | `c6774a58ee1a3fb5cc551691711954baf008b6d9339a0424c2422129a44c914d` | `ffd73cc1298ccf178493f3b3ae06a6f9bd60a18f3e1eabca31336f54247e119c` |
| `Q2D7c` | `58ef3d6e3484c3e5b50a61a4f8803c1fae5f705807bd35e79d91aaaa4bd1c328` | `15b790393977898290ab30c82d9bb73fb056a0dc0735e98c6466b5a00e5cc74c` |
| `WCJ1c` | `5ccc19e49d97336bd8a4334a97bcac9aa78bf2d9cbadcf2905e5b8c34b9e98af` | `a6672bde98b5e425312f7545ff9652b6a95f221f3d109251ea88d0ecf5fe593c` |
| `3TJHc` | `a94aeb6fc63d3c8ad822cefb5f4df381daa83c7391cf8fe9cbfbaef149e9abd9` | `7e5c0f9f2e86c21bcdc22bee494d8382bfa05abe3eb997db1856c8c8d8ad3d25` |
| `5BFTc` | `7bedeb3dc611687e5c6d355ce8cc940f91e45a53fb61514fe2f208fdd64c3b0a` | `a70de356c3e878c0c98a445e9afcfd781b151e5a101a1f8e07f98a89487a7503` |
| `JFbHc` | `458d65ed3f5a499a2c25179c206abd8536e9a9e91dbae79fe4a7266ea6da7f62` | `8cdf7400505336d3afabea82439f14c548e417da15132ffbf477b81d5e6061c1` |
| `mFc1c` | `711a2d0ec520f4d72591583b5ab0c53f8a32168fe42589e68735431d6bde32b9` | `f3bf305829d568e1c0ff5be965e214b49f3e39c6c1b06e9b120516491d9dc79b` |
| `hVvHc` | `a8d785410bdbae0aac5c9e541c24c42c3ec086738b444d851c1b47ef575f3d4c` | `356c1486fa83ccb53bdfd89aad4975298fd5a2055ae0fb14f2d797267cb5a727` |
| `vrMHc` | `715c627f5d6e9586b504a373b311f00aa4c966d92edf5157b41d9595005e225f` | `5b39df95bcd7221a659782cb90db9dd70a8de5439a45f195efbfd8da59064f69` |
| `YZT1c` | `65eb05111473bb2f8197aae0f9d500623fee6be62af69a2bb064efe049a83d60` | `fe2fa5110bf2d4afa003cb3daa080e117a05271d4b99deaaf08508e73c7f19fe` |
| `qrpHc` | `13a52cbbc25bf4ea1e9bafa50022c1920691c172445286c54612d021eed88f41` | `e333189ef299d9491734842027413abacdce845af532d47130b34dea0e07a23e` |
| `PCZHc` | `061cfd5b38ac94df77f8a8d565362d09b2758e65e3595a580822da871519caed` | `c71c26d3a828636a8e916dbf64728cc601fd1d6fc856b17f4f8ddc7c1897dba0` |
| `B2qHc` | `91d725cfb08d83624728ec29fe020fe8fbec284c854a6a94ea60b5be4148a77e` | `a62869d9946a8b666d9fce440601eab516c87549b0ded27699cdd72f6259c1c3` |
| `RwWHc` | `db7b886720cb0f57743a8f951e263b726d38820870a17a735185655181f8de55` | `153c127e48336dec461035a1344e1a73007cd9cc576920d29bb7300824c85513` |
| `c7J1c` | `d120523db75aa304c470ec33765985c3107971e84b69765c8f13294e7a3aa80c` | `146cd309105f6d4d0b57fb3f7630c7e1ef7a8141c2699c0321b3c7a6771aa9e4` |
| `zvVHc` | `fb96cdc08b02eb09c7aa726b79a110b3863fecf5293124b350b6e01b2ee253c1` | `c4b76272ca155e8b40aa98507661285a88fea89c9bdc3a48c401e2ada2bd6e85` |
| `Bd41c` | `6e0b9bbb181a073658b9547cda4e40748683f72152d61be4d164a049fa678563` | `a2d1c7e42b8b445ad79615c47b7d164ae1d4f54481f21f75f3a5bb2e47e7cc25` |
| `kMQJc` | `33f6176d3cf45d24ab8f9ed979d8cfcd4e512cfa2031895d689ab1ca0191aacf` | `eddfe1d340ab5292f71d0f61aa5b1ba0bf286d32bdbd9cbd7df0901ac0a53f6a` |
| `68S1c` | `f70823bddc81be19a2e6526e6100541f589f6851a31049259765615bbce743cf` | `6d838e7ea9acb296851665f6ac587bc72b1db84db7a7ef999d2f47978d282cc5` |
| `YhNTc` | `9c2f094f71d382a6d9d6641084416a2709bfbfe7fe8c1d5c4fe3b4a30a5db988` | `3c918855e367f4b791b01cea9b850daa15c5650eee2faf9f20c45a1d1f09015c` |
| `srwqc` | `ff7aa3619489ffd722fc8c359d6b04dac261d6de01de87759532b2b45cc9d3da` | `c33b73065e41661d7b528340430a95b255e2e717fb06f915f4ff66fd26f2c89f` |
| `vVqHc` | `aa17e99509220344293ddf2afb0425c42538d5040ba99edea6f49405abd7f1e4` | `9b46e30961569ffe310d6f65671c4d2b26b6b2a90dd8144f914c4a6f38eec321` |
| `FpHHc` | `6ffdd6b37c3346fb237bd8f56583fd8eccb3a2b31ae61e0a67a95f2ebeda6243` | `6d47967a37487ba6f793f2e9ed7b70a6d2b7118c44387a622af23ba51427122b` |

## Re-amplification opportunities

| Candidate | Compatibility / precision / rights and access | Calibration and missing evidence |
|---|---|---|
| Re-amplified harness-v1 p1 | Own synthetic one-bar score/audio; known event recipe; not a human player. Eligible material for a future recording-transfer probe. | Physical speaker, microphone, room and capture device not established; record start/end calibration impulses to estimate delay and drift, recheck audible boundaries, record actual noise/level and uncertainty. No capture exists. |
| Re-amplified harness-v1 p2 | Pinned spec score; generated C4–C5 audio; preserve upstream score attribution. Same one-source limitations as p1. | Same device/room calibration; original exact labels cannot be promoted unchanged through room/release effects. No capture exists. |
| Re-amplified c1-silence | Silence plus actual room/microphone noise becomes the negative control; no musical evidence is invented. | Measure device self-noise, AGC/noise suppression, latency and any calibration sound exclusion. No capture exists. |
| Re-amplified c2-wrong-piece | Keep intended ascending score and descending generated audio distinct; own generated negative control. | Apply the same calibration as positives; assess audibility of the first distinguishing onset independently. No capture exists. |
| Re-amplified t1-tempo-90 | Preserve 90 BPM actual / 60 BPM handed, a tempo probe. | Delay and clock drift must not masquerade as tempo error. No capture exists. |
| Archived generated/sample-pack recordings | Excluded as new real performance evidence: archived experiments used synthetic sources; they do not establish independent players, this intended score or this following contract. | Do not import historical thresholds or reserved partitions. Existing local microphone snippets, if any, have no independently established score route in this inventory. |

The next plan could prepare `reamp-harness-v1` after capture/calibration, and a separate solo-library development set after the shortlist is independently checked. Neither exists or is frozen. Human effort is needed for physical capture, rights/access facts and any unresolved score/anchor/solo evidence; this inventory requests no approval of the provisional research contract.

Audit counts: 99 listed pieces; 84 paired score/sidecar reads; 103 recording rows; 17 recording rows have their named local media; 15 missing-sidecar exclusions. No reserved access.
