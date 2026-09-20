# Runner capability probe — measured, not assumed

**Run:** https://github.com/aarohkandy/auros-base/actions/runs/35538612202 · `ubuntu-latest` · 2026-09-20

PLAN.md's CI section rested on research claims. This replaces the important ones with measurements.

| Question | Claim in PLAN.md | **Measured** | Consequence |
|---|---|---|---|
| Runner free disk | "~14 GB free, may not fit — potential hard blocker" | **145 G total, 87 G free before reclaim, 110 G after** | **Not a blocker, and not even close.** Hosted runners grew. We do not need `/mnt` gymnastics or `free-disk-space` actions for the base build. |
| `/dev/kvm` | "available since Jan 2024" | **Present. `kvm-ok`: *KVM acceleration can be used*. Writable after `chmod 666`.** | Boot checks run accelerated on free CI. Gate 1 and Gate 2 need zero infrastructure spend. |
| Upstream digest | pinning "viable today" | **`sha256:911281f2aaa42bfd17532c5cef917aba8d7ac8c0faeb1c1edc6a43dc28d0d2f1`**, created `2026-09-15T20:33:50Z`, `linux/amd64` | Pinned in `auros-base/base.lock`. |
| Aurora pull size | not established | **3.5 GB compressed, pulled in ~58 s on the runner** | See below — this is the most consequential number in the probe. |
| Tooling | assumed | podman **4.9.3**, skopeo **1.13.3**, qemu **8.2.2**, `cosign` **MISSING** | cosign needs `sigstore/cosign-installer`; everything else is preinstalled. |

## The number that matters most: 3.5 GB

A nightly base rebuild that changes a low layer is a **3.5 GB pull per machine**. A 180-machine school on
one uplink is therefore a ~630 GB event. That is not a theoretical concern, it is a Tuesday.

Three consequences, recorded now so they are designed for rather than discovered:

1. **`rechunk`'s stable layer plan is not an optimisation, it is a requirement.** Its whole value is that
   a rebuild touches a bounded subset of layers so the delta is a fraction of the total. Without it,
   nightly updates are unshippable at 180 machines. This raises the stakes on DECISIONS.md D2.
2. **We must measure the real delta, not the total.** `results.json` already carries
   `pull_size_delta_bytes` as a **measured** field. That is the number that goes on the website, if any
   number does.
3. **We must not promise nightly updates to a site whose uplink cannot carry them.** Staged rollout and
   an on-site cache are properly the fleet console's job (spec §6E, deferred) — but the *sales* claim has
   to stay honest before the console exists. Added to BLOCKED.md as a claim constraint, not a bug.

## What this probe did not answer

Whether `bootc-image-builder` produces a bootable qcow2 on a runner, and whether it reaches a login
prompt. That is probe 2 (`probe-boot.yml`), which is the actual Gate 1 exit path.
