# Container test pass — 2026-10-04/05

Everything that can be tested without a real PC, run in a cloud container: Ubuntu 24.04, 4 vCPU,
QEMU in software emulation (no KVM), OVMF with Microsoft's keys and Secure Boot enforcing where the
test asks for it. Each row's transcript is the `.txt` of the same name in this directory; failing
transcripts that proved a fix are in `red/`. The final end-to-end chain is `e2e-chain-2.log`
(`chain-exit=0`, `out/` byte-identical before and after the run; hashes in `out-sha256.final`).

## Builds

| | time | note |
|---|---|---|
| `forge build desktop` | 7m15s | `ALLOW_BROWSER_FALLBACK=1`: Mozilla is unreachable from here, so the image ships Epiphany |
| `build/staging`, fault staging | 10 s, 9 s | |
| `build/mkimage desktop` | 31 s | 5,332,008,960 bytes; not byte-reproducible |
| `build/aurbridge` | 22 s | staging, shim, grub, mokmgr inside; unsigned; not byte-reproducible |

## Tests

| test | checks | seconds |
|---|---|---|
| 24 C unit tests (`unit/`) — e.g. modaltest 53, notifytest 52, welcometest 27, wlhostile 15/15, wlstress + ASan 5/5 | all pass | 0–92 |
| aurfirsttest · nvramtest · bridgetest · gpttest · wrtest · committest | 65 · 25 · 13 · 23 · 23 · 11 | ≤ 54 |
| screentest · choicestest · healthtest · probetest · imagetest | 24 · 21 · 14 · 12 · 23 | ≤ 43 |
| theme-test · signtest · manifesttest · exetest | 73 · 12 · 9 · 17 | ≤ 64 |
| ntfstest · shrinktest · permissions · filetypes · ferry · bootchaintest | 29 · 10 · 14 actions · 17 types · 43 · 72 | ≤ 28 |
| plainwords | 5 places, 0 hits | 15 |
| **stagetest** | 34 | 871 |
| **installtest** — install, start, put Windows back twice, every file identical | 37 | 610 |
| **nosticktest** — the same with no memory stick | 45 | 1171 |
| **loadertest** — firmware alone starts AurOS, Secure Boot enforced | 18 | 135 |
| **matrixtest** — 10 machine shapes accepted or refused | 10 | 437 |
| **choicesboottest** · **putbacktest** · **firstboottest** | 9 · 16 · 32 | 209 · 326 · 762 |
| **bootupdatetest** — kernel/grub/shim updates keep it booting | 27 | 484 |
| **failtest** — a desktop that cannot start says so in words | words on screen at t+75 s | 81 |
| **powercuttest** — 18 named instants, 13 install + 5 restore | 138 | 1802 |

No test needed a longer timeout under software emulation. `manifesttest` ran 9 of its 10 checks;
the tenth downloads the known-bad installer from GitHub, outside this container's network policy.
`powercuttest` ran once, on the tree before the `gb_up` fix (the fix changes a printed number in
the dry run, which powercuttest does not reach).

## Bugs found and fixed (each with a red transcript)

1. **Product:** the dry run rounded the space AurOS *needs* down (`src/aurstage/main.c`, `gb_up()`):
   a refusal could read "needs 24 GB … can spare 24 GB". Now rounded up; a stagetest case fails on
   the old code.
2. stagetest's healthy-machine fixture was too small for the real need (1 GB floor + the ESP copy +
   512 MiB boot partition ≈ 1.64 GB); now 2 GiB Windows on a 4 GiB disk.
3. imagetest never set `img_base`, so its writer read the stick from byte 0.
4. wlhostile case 12 left its hostile client spinning forever; clients now die with their case and
   every case has a deadline that counts as a failure.
5. failtest mounted the published `out/auros-desktop.img` and changed its bytes; it now works on a
   copy, and `tools/e2e-all.sh` fails if anything in `out/` changes during a run.
6. exetest's release-gate builds overwrote the real installer in `out/`; they now build in a copy.
7. filetypes looked on the host for programs that live in the rootfs; `ROOT=` mode added.
8. plainwords: a loader-only `L"kernel32.dll"` and Windows' own button label
   `L"UEFI Firmware Settings"` (which she must find by those exact words) are skipped as exact
   literals; any sentence of ours with a banned word is still caught (proven by planting one).

## Not testable here

A real PC's disk; firmware other than OVMF; real drive flush behaviour and real power loss; real
Windows (`.github/workflows.parked/windows.yml` covers starting the installer there); Firefox; code
signing; KVM-speed timing.
