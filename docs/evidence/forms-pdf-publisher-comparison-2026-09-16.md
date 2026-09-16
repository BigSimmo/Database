# WA MHA 2014 approved-form assets — publisher byte comparison, 16 September 2026

All 51 downloadable approved-form PDFs committed under `public/forms-pdf/` were fetched
from their Office of the Chief Psychiatrist URLs and compared byte for byte with the digests
recorded in `data/forms-pdf-manifest.json`.

**Result: 51 of 51 identical.** No form has been republished since the manifest was built, no
digest moved, no fetch failed.

This is what package hold H04 asked for, and what `data/forms-pdf-manifest.json` needed before
its `generatedAt` could honestly move. The previous date, 17 July 2026, had never been checked
against the publisher — `scripts/build-forms-pdf-manifest.mjs` is deliberately offline and hashes
only the local copies, so it could confirm the manifest matched the files on disk and nothing
about whether those files still matched the OCP's.

## Method

Each asset's `officialPdfUrl` was fetched with `curl` and hashed with `sha256sum`. Nothing was
written into the repository: the downloads went to a scratch directory and were compared, not
committed. The committed PDFs are unchanged by this exercise. No credential, no authenticated
request, no paid call.

Two properties were compared per asset, both from the manifest: `sha256` and `bytes`. A digest
match on its own would be enough; the byte count is carried because a truncated transfer that
somehow collided would still be caught.

## Register check, same day

The forms register at `https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/legislation/mental-health-act-2014-forms/`
was read on the same day and reconciled against `src/lib/form-register.ts`:

- All 54 codes and titles match.
- Forms 4D and 4E are shown as unavailable. The register carries the marker in the title text
  for 4E ("Approval of interstate transfer order (currently unavailable)") and offers no PDF for
  4D. Both are `availability: "unavailable"` here, which is correct.
- Form 13 directs the reader to email `monitoring@ocp.wa.gov.au` rather than offering a PDF.
  It is `availability: "contact_ocp"` here, which is correct.
- **Form 10G: the register reads "Revocation of expiry of bodily restraint order".** This
  repository reads "Revocation **or** expiry". The register wording is a typo — "revocation of
  expiry" is not a thing the Act provides for, and the parallel seclusion form 11F reads
  "Revocation or expiry of seclusion order" on the same page. The repository keeps the corrected
  wording and this note is the record of why. That closes package hold H06: the discrepancy is
  preserved and explained rather than silently normalised in either direction.

## Per-asset result

| Form           | HTTP | Bytes  | sha256 (first 16)  | Match |
| -------------- | ---- | ------ | ------------------ | ----- |
| 2              | 200  | 228235 | `37a058026a6ad1fc` | yes   |
| 1A             | 200  | 346765 | `a9e732c5351f73d7` | yes   |
| 1B             | 200  | 199390 | `e29fab5a3747d39c` | yes   |
| 3A             | 200  | 205692 | `de6a7896cfc1ca99` | yes   |
| 3B             | 200  | 198242 | `3bf44962f5570a58` | yes   |
| 3C             | 200  | 210726 | `8e4b658e8cccd377` | yes   |
| 3D             | 200  | 181444 | `f44b0fa7d2d4fde4` | yes   |
| 3E             | 200  | 203646 | `080c54d6f97cca05` | yes   |
| 4A             | 200  | 223163 | `4defb088aa98a017` | yes   |
| 4B             | 200  | 179522 | `e23a6be0f49f6e22` | yes   |
| 4C             | 200  | 306410 | `f779a2c9ad65ec29` | yes   |
| 5A             | 200  | 367514 | `c6a11f6cf40a4adf` | yes   |
| 5B             | 200  | 203184 | `6864105aa99311d5` | yes   |
| 5C             | 200  | 186264 | `2be5355bdc3445d4` | yes   |
| 5D             | 200  | 228312 | `93adaeb5622f008e` | yes   |
| 5E             | 200  | 161981 | `b97d01b99d6eefe3` | yes   |
| 5F             | 200  | 300775 | `e6acb4384559988e` | yes   |
| 6A             | 200  | 293751 | `eadcec7cf32e0928` | yes   |
| 6B             | 200  | 280701 | `4371bdf3d9fcffa3` | yes   |
| 6C             | 200  | 178281 | `60ac7150688612f9` | yes   |
| 6D             | 200  | 192551 | `1255f29f95680ce9` | yes   |
| 7A             | 200  | 265737 | `067cc0542c781adb` | yes   |
| 7B             | 200  | 181563 | `9a58ff9846d0451b` | yes   |
| 7C             | 200  | 199088 | `628b16959d43c5f4` | yes   |
| 7D             | 200  | 144358 | `d4b59956505d0b4a` | yes   |
| 8A             | 200  | 233991 | `6905abc6454d6fbf` | yes   |
| 8B             | 200  | 174112 | `36971415aac62a9d` | yes   |
| 9A             | 200  | 218719 | `e21b1c8798a287be` | yes   |
| 9B             | 200  | 281085 | `88935cf3f191ab52` | yes   |
| 10A            | 200  | 237064 | `f3f1698bbd6c3f08` | yes   |
| 10B            | 200  | 232550 | `2206d0420b671499` | yes   |
| 10C            | 200  | 195018 | `bfb062ac7408e8f1` | yes   |
| 10D            | 200  | 243589 | `1f5e27b7dbb7e89a` | yes   |
| 10E            | 200  | 258307 | `9ceb8d991634fcb3` | yes   |
| 10F            | 200  | 233295 | `f8955db7f4d1964d` | yes   |
| 10G            | 200  | 241374 | `b57883e571ebfdf2` | yes   |
| 10H            | 200  | 221265 | `bcc7d65fc6ca21f1` | yes   |
| 10I            | 200  | 234932 | `9bbb3bfd4103ffa8` | yes   |
| 11A            | 200  | 279831 | `c28e1a51deba8522` | yes   |
| 11B            | 200  | 268342 | `8049ce77d200138a` | yes   |
| 11C            | 200  | 237356 | `97072aec26099e86` | yes   |
| 11D            | 200  | 223931 | `a304efe135d31302` | yes   |
| 11E            | 200  | 236247 | `0ede01108377a296` | yes   |
| 11F            | 200  | 246167 | `715400d4048179de` | yes   |
| 11G            | 200  | 201341 | `dd9f5b48b70c0e2e` | yes   |
| 12A            | 200  | 284377 | `ba39103a3caaeeba` | yes   |
| 12B            | 200  | 236674 | `9deee79f80c652b7` | yes   |
| 12C            | 200  | 226018 | `3ac267c2ae7e7b2b` | yes   |
| 1A attachment  | 200  | 163814 | `9856d48ae70fab96` | yes   |
| 6B attachment  | 200  | 242879 | `4a7e9b2e23e461be` | yes   |
| 12C attachment | 200  | 399550 | `6ddc4ab72c633f4b` | yes   |

## What this does not establish

The bytes are unchanged; that is all. It is not a reading of the forms, not a check that the
content matches the current Act, and not clinical review of anything this repository says about
them. Package holds H01 and H03 are untouched by it.

It also says nothing about the two forms the register does not publish. Forms 4D and 4E remain
unavailable, and Form 13 remains contact-only, so there are no bytes to compare for those three.
