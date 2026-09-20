# TAILSCALE — hard technical writing as the top of funnel

**Steal: 8 · Fit: 8**

---

## The play

Tailscale's blog does not describe Tailscale. It explains **hard problems in networking** — NAT
traversal, why the internet's addressing is the way it is, how their own design decisions were made and
what they cost. Long, technically dense, occasionally unflattering about their own choices.

The posts circulate on their own merits, among people who then discover there is a product attached.

## Why it works

- **It demonstrates rather than asserts.** A post that genuinely explains something hard proves
  competence in a way no claim about competence can.
- **It is durable.** A good explanation of a fundamental problem is read for years. A feature
  announcement is read for a day.
- **It self-selects.** The reader who finishes a 4,000-word piece on NAT traversal is the reader who
  will evaluate the product properly.

## Why it maps

We are sitting on several of these already, unwritten, and each one is genuinely interesting to
somebody outside this company:

1. **Why deriving from a base image does not give you signature enforcement.** D8: Aurora's
   `policy.json` ends in an `insecureAcceptAnything` catch-all, so `--enforce-container-sigpolicy`
   succeeds while verifying nothing. A check that would have passed vacuously forever. This is a real
   finding about a widely-used upstream and it is useful to people who will never buy from us.
2. **Upstream garbage-collects the digest you pinned.** D21: pinning protects against a tag moving, not
   against the blob being deleted. Anyone building on a public base image has this bug and does not
   know it.
3. **The abort path is the product.** Why *"any mismatch aborts"* is the promise that sounds safer and
   fails in the field — OneDrive fetches a file, antivirus touches one, a document is left open — and
   why a tool that gets worked around is more dangerous than one that names the four files it could not
   read. This is already written, well, on our landing page.
4. **`set -o pipefail`, and the gate that graded a failing build as passing.** See
   [`cloudflare-postmortems.md`](cloudflare-postmortems.md).
5. **What 3.5 GB compressed means for a school's uplink.** A 180-machine site on one connection is a
   ~630 GB event (`BLOCKED.md` B6). Nobody writes about bandwidth as a constraint on OS update design,
   and it is the kind of arithmetic a school IT person has done for other reasons.

**Every one of these is already in `DECISIONS.md` or `BLOCKED.md`.** The work is editorial, not
investigative — which is the cheapest content in existence.

## The caution

Tailscale's audience is engineers who buy the product. **Our buyer is largely not that person.** A
school IT director does not read about NAT traversal.

So this channel reaches the **refurbisher's technical lead, the MSP, and the volunteer in the repair
café** — which is a real and useful audience, and another argument for the wedge pointing at
refurbishers rather than schools.

It is not the school channel. Do not expect it to be, and do not measure it as if it were.
