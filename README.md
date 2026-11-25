# news-image-20261125 — The World in One Day

[![make.fun bounty](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/bangpateng/news-image-20261125/rank.svg)](https://make.fun/bounty/news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/bangpateng/news-image-20261125/reward.svg)](https://make.fun/bounty/news-image-20261125)

A make.fun bounty entry: one image summing up the world news of
**Wednesday 25 November 2026**. A front-page collage — masthead, a lead story
on the CIA/ODNI cyberattack, and nine more panels covering the Houthi strike
on Riyadh's PIF Tower, Huawei's trade-secrets verdict, Ukraine's naval
strikes, the market slide, Pakistan's first astronaut, Gaza, the Nepal
earthquake, the DR Congo Ebola evacuation, and Trump's Medal of Freedom —
plus a footer ticker with the AIDS-death milestone and the Senegal boat
capsize.

`main.ts` is written from scratch (Node 22, standard library only). It draws
the whole page with its own canvas primitives, its own 5x7 bitmap font, and
its own PNG encoder (CRC32 + zlib deflate) — no network, no dependencies,
and fully deterministic: repeated runs produce a byte-identical 1024x1024
PNG under 1 MiB.

## Run locally

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png (1024x1024)
```

Bounty: [news-image-20261125 on make.fun](https://make.fun/bounty/news-image-20261125)
