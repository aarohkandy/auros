# hardware/compat.tsv

One row per machine we have actually observed. This file is the asset competitors cannot copy quickly
(spec §8). It is only worth that if every row is true.

## The `source` column is load-bearing

`source` is `vm` or `physical`. A QEMU profile has no real Wi-Fi chipset, no trackpad, no backlight and
no webcam — it cannot produce an honest verdict for those columns. So:

- `source=vm` rows **leave `wifi`, `trackpad`, `brightness`, `webcam` and `suspend` empty.** Not `?`, not
  `ok` — empty. An empty cell means "we did not test this", which is the truth.
- **No customer quote is ever generated from a `vm` row.** The quoting tool filters on `source=physical`.

Filling a VM row's physical columns would manufacture exactly the unearned confidence that spec §4 exists
to prevent, and we would then quote customers from it.

## Values

| Column | Values |
|---|---|
| `wifi`,`trackpad`,`suspend`,`brightness`,`gpu`,`audio`,`webcam` | `ok` \| `partial` \| `fail` \| *(empty = untested)* |
| `firmware` | `uefi` \| `uefi-sb` \| `bios` \| `uefi+csm` |
| `verdict` | `supported` \| `supported-with-caveat` \| `unsupported` \| `untested` |

`verdict=unsupported` is a **§9 decision reserved for the human.** The tooling may propose it; only a
person may write it.
