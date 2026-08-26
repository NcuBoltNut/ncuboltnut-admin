# BoltNut CMS

Content admin for [ncuboltnut.github.io](https://github.com/NcuBoltNut/ncuboltnut.github.io) — a separate Vue app so the public site and the editing tool can be deployed and iterated on independently.

## Status: Phase B (read-only)

Reads content straight from the public `ncuboltnut.github.io` repo (news,
activities, members, generations, advisors, sponsors, history) and displays
it. No authentication, no writing — that's Phase C.

Because reads go through GitHub's anonymous API (60 requests/hour per IP),
directory listings are cached client-side for 5 minutes to keep real usage
well under that limit. This goes away once Phase C routes reads through an
authenticated backend.

## Development

```bash
npm install
npm run dev
```

## Roadmap (per `BoltNut_Web_Platform_Spec_v2.md` §20)

- **Phase A** — structured content model — done, lives in the main site repo
  (`src/content/*` collections, `src/data/*.ts`)
- **Phase B** — read-only admin — this repo, current state
- **Phase C** — safe editing: forms, GitHub OAuth login, save = commit.
  Needs a GitHub OAuth App + a small server-side token-exchange (a
  Cloudflare Worker or Pages Function) — never put a PAT in browser code.
- **Phase D** — editorial workflow: draft branches, PR creation, review
  state
- **Phase E** — role controls, only if the team actually needs them

## Deployment

Cloudflare Pages (separate project from the public site), so Phase C's
OAuth token-exchange function can live alongside it as a Pages Function.
