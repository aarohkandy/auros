# Licensing

## Ours: Apache-2.0

All four product repos and this control repo are **Apache-2.0**.

**Why not MIT.** Apache-2.0 carries an explicit **patent grant**; MIT carries none. We tell schools and
nonprofits *"every recipe is a public git repo — if we vanish, you rebuild your exact operating system
from the file"*, and we advertise it (spec §1.3). That promise is worth materially more when it comes
with patent peace: a fork under MIT leaves the customer exposed to a patent claim they would have no
defence against, which quietly undermines the one reason to trust a new company with a fleet.

It also matches every upstream we build on, so there is no licence-mixing question for anyone
redistributing a derived image.

The cost is a longer file and a NOTICE requirement. That is a good trade for a project whose main trust
asset is being forkable.

**This is reversible today and expensive later.** Changing it after anyone has forked requires their
agreement. It is a business decision, so if the human prefers MIT, that is theirs to make and it is one
command right now.

## Upstream, verified from the GitHub API on 2026-09-20 rather than from memory

| Project | Licence | What we use it for |
|---|---|---|
| [`ublue-os/aurora`](https://github.com/ublue-os/aurora) | Apache-2.0 | The base image every Auros machine inherits |
| [`ublue-os/main`](https://github.com/ublue-os/main) | Apache-2.0 | Aurora's own upstream |
| [`bootc-dev/bootc`](https://github.com/bootc-dev/bootc) | Apache-2.0 **OR** MIT (dual; the API reports `NOASSERTION` because of the dual declaration) | The OS-as-a-container mechanism |
| [`osbuild/image-builder`](https://github.com/osbuild/image-builder) | Apache-2.0 | `bootc-image-builder` — OCI image → bootable disk |
| [`containers/podman`](https://github.com/containers/podman) | Apache-2.0 | Building and pushing images |
| [`sigstore/cosign`](https://github.com/sigstore/cosign) | Apache-2.0 | Signing, keyless via CI OIDC |
| **Fedora** | **a mix, per package** — GPL, LGPL, MIT, BSD and others | The distribution underneath everything |

**Fedora is not one licence, and nothing we ship may imply that it is.** A customer redistributing an
Auros image is redistributing Fedora packages under their own individual terms. In practice this is the
same position as anyone shipping a Linux appliance, and the obligations travel with the packages — but
the *website must not* state or imply a single licence for the whole image.

## Flatpaks are not ours and not in our image

Userspace applications come from Flathub (spec §3), each under its own licence, installed at runtime and
updating on its own schedule. They are deliberately outside the image and outside our security surface.
A recipe naming an application does not redistribute it.

## What a customer actually receives

- **Our recipe and tooling:** Apache-2.0. Fork it, change it, run it, sell it.
- **The image:** a derivative of Fedora and Universal Blue, carrying those projects' licences per package.
- **Their data:** theirs. It never leaves their premises (spec §4.1, and `auros-installer/SAFETY.md`).
