# Mobile-root timing control — 2026-08-26

## Decision

The mobile-root timing signal recorded during PR #2313 was **not reproduced on pinned Linux CI**.
The retained Ubuntu evidence excludes a repeatable cross-platform regression, but it cannot
distinguish Windows/busy-host measurement noise from a Windows-specific client regression. The
unsynchronised pre/post comparison does not justify a product or budget change.

## Signal under investigation

PR #2313 recorded three Windows post-remediation measurements at application head `7cf37b530`:

- LCP `7422–8032 ms`, versus a pre-head median of `7073 ms`;
- TBT `747–1381 ms`, versus a pre-head median of `547 ms`;
- root requests fell from `60` to `52`, and transfer fell by about `14.9 KB`.

That comparison was not synchronized: the post head also contained four concurrent `origin/main`
commits, and the Windows host load was not controlled. Ledger issue `#GQ5X8T` therefore required a
quiet-host, pinned-browser Linux control before any attribution or product edit.

## Reconstructed synchronized pair

The historical pair can be reconstructed without the original confounder:

- control: `883f1007a85cd4e02198f39c12c4a4e467d4b89e`, the `origin/main` parent merged by the measured
  application head;
- treatment: `7cf37b53010c52eaa3c2deb1de816a56c4f9e177`, the measured PR application head;
- both snapshots have the same `package-lock.json` SHA-256:
  `33BFDD1AE98F6098725E7E48435E4EC1887CC0D1FF1961F356EFF266F5A3BE63`.

A local Docker/WSL2 harness pinned Node `24.19.0`, npm `11.17.0`, Playwright `1.62.1`, Lighthouse
`12.8.2`, and Chrome for Testing `151.0.7922.34`. The local Windows host never reached an admissible
quiet window: repeated 10-second samples stayed at `42.3–62.9%` aggregate CPU before the measurement
container started. The exact control build compiled in `5.7 min`, then the repository's 10-minute
Linux CI build cap terminated TypeScript with status `143` / `ETIMEDOUT` before any Lighthouse report
was written. That attempt is environment-blocked evidence, not a measurement, and was not rerun
unchanged.

## Dedicated Ubuntu control

PR #2313 already produced eleven retained Lighthouse artifacts on dedicated `ubuntu-24.04` CI jobs.
Every artifact used Lighthouse `12.8.2` and the same pinned Linux browser identity:
`HeadlessChrome/151.0.0.0`. All eleven Lighthouse jobs passed, and none required a confirmation or
measurement retry.

After the branch synchronized to the refreshed Linux baseline (`mobile-root` LCP `2274.017 ms`, TBT
`436.600 ms`, CLS `0`), nine consecutive exact-head runs produced:

|                                                                       CI run | PR head     | LCP (ms) | TBT (ms) | CLS |
| ---------------------------------------------------------------------------: | ----------- | -------: | -------: | --: |
| [32636561904](https://github.com/BigSimmo/Database/actions/runs/32636561904) | `8ce4cfe5f` | 2276.340 |  513.088 |   0 |
| [32637156564](https://github.com/BigSimmo/Database/actions/runs/32637156564) | `7df50f1b0` | 2260.791 |  261.190 |   0 |
| [32639184634](https://github.com/BigSimmo/Database/actions/runs/32639184634) | `d8b54f653` | 2300.711 |  454.199 |   0 |
| [32640836626](https://github.com/BigSimmo/Database/actions/runs/32640836626) | `38e573845` | 2300.594 |  430.602 |   0 |
| [32642982104](https://github.com/BigSimmo/Database/actions/runs/32642982104) | `17db8645f` | 2282.000 |  265.807 |   0 |
| [32643637602](https://github.com/BigSimmo/Database/actions/runs/32643637602) | `1101f88cc` | 2287.574 |  416.263 |   0 |
| [32644433758](https://github.com/BigSimmo/Database/actions/runs/32644433758) | `f87201566` | 2262.829 |  246.288 |   0 |
| [32645084476](https://github.com/BigSimmo/Database/actions/runs/32645084476) | `c4357a7b8` | 2293.486 |  508.720 |   0 |
| [32645761501](https://github.com/BigSimmo/Database/actions/runs/32645761501) | `5d30e3b0d` | 2300.923 |  452.909 |   0 |

Distribution summary:

- LCP median `2287.574 ms`, range `2260.791–2300.923 ms`: `+13.557 ms` / `+0.60%` versus the
  synchronized Linux baseline;
- TBT median `430.602 ms`, range `246.288–513.088 ms`: `−5.998 ms` / `−1.37%` versus baseline;
- CLS remained exactly `0` in every sample;
- across all eleven retained heads, LCP render delay stayed within `2024.5–2130.2 ms`.

The two earlier pre-sync artifacts corroborate the same result: LCP `2231.731 ms` and `2221.675 ms`
against the earlier Linux baseline of `2252.856 ms`. Both heads descend from the measured
`7cf37b530` treatment lineage; the first is PR head `dc173ec9d`. Across all eleven artifacts,
mobile-root LCP was `2221.675–2300.923 ms`; the Windows `7422–8032 ms` state did not appear once.

## Classification and stop decision

A cross-platform regression in the retained PR code would predict a consistent Linux increase
comparable to the Windows LCP median change of `+521.645 ms` / `+7.4%` (`7073.383 ms` to
`7595.028 ms`). The synchronized Linux distribution instead differs from its baseline by `+13.6 ms`
at the median, while TBT is slightly lower and the full LCP range is only `40.1 ms` wide. The old
signal is therefore classified as **not reproduced on pinned Linux**. These measurements do not
exclude a Windows-specific client regression.

No code, baseline, tolerance, request-count remedy, or proven CLS fix is changed. The appropriate
repository action is to resolve the Linux-control request in `#GQ5X8T` with this qualified evidence.
The performance question should be reopened if either a pinned Linux run on the exact current head
shows a repeatable breach or a synchronized quiet-host Windows control reproduces the slowdown. Any
new measurement should retain the LCP breakdown needed to identify an owner.
