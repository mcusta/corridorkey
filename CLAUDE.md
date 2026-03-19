# AI FX Lab — Project Context

Private internal MVP multi-tool hub for AI film/VFX processing.
Single user (Mutlu), dark mode only, no billing/teams.

## Quick Start for New Conversations
1. Read `docs/webapp/PHASES.md` for current status
2. Read the guide for the current phase: `docs/webapp/PHASE{N}_GUIDE.md`
3. Read the previous phase report: `docs/webapp/PHASE{N-1}_REPORT.md`
4. Read `docs/webapp/PLAN.md` for architecture details

## Current Status
- Phases 1-5: COMPLETE (deployed and live)
- Phase 6: READY TO BUILD — see `docs/webapp/PHASE6_GUIDE.md`
- Live at: https://fxlab.vercel.app
- GitHub repo: https://github.com/mcusta/aifxlab (private)

## Tech Stack
- Frontend: Next.js App Router + TypeScript + Tailwind (dark mode only)
- Backend: Next.js API routes (`web/src/app/api/`)
- Auth/DB/Storage: Supabase
- GPU Worker: RunPod Serverless (`worker/handler.py`)
- Engines: CorridorKey (green screen keying), MatAnyone2 (video matting — Phase 6)

## Deployment
- Web: Vercel (https://fxlab.vercel.app)
- GPU: RunPod Serverless, endpoint `z5gdtxbajlj27b`, RTX 4090 (24GB tier only)
- Docker: `ghcr.io/mcusta/corridorkey-worker:v1` (7.32GB)
- DB: Supabase (https://eeuduimpwwtqzintbbeo.supabase.co)

## Key Rules
- NEVER expose service_role key to browser (NEXT_PUBLIC_* = anon key only)
- RTX 5090 (Blackwell) incompatible with PyTorch 2.6 — always use 24GB tier
- RunPod: Max Workers 1, Execution Timeout 1800s, Idle Timeout 600s
- Supabase free tier: 1GB storage, 5GB bandwidth — auto-cleanup deletes files >24h
- No over-engineering — minimal but polished, everything must work end-to-end

## Working Style
- User gives high-level direction, trusts implementation details
- Create todo lists for multi-step work
- Write phase reports after completing each phase
- Update PHASES.md checkboxes as items are done
- Use parallel agents when possible
- Dark mode only, no emojis unless asked
