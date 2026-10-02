# Capacity Assessment App

Standalone self-administered nervous system capacity assessment for Neuro Progeny.

## Architecture

This is one of three apps sharing a single Supabase project:
- **NPU Platform** (the University) — participant-facing courses, journey, store
- **NeuroReport App** — xReg VR session biometrics
- **Capacity Assessment App** (this repo) — structured HRV assessment protocol

## What It Does

Guides a participant through a 20-minute biometric assessment:
1. Connect Coospo HW9 armband via Bluetooth
2. 5-minute resting HRV recording (eyes closed, voice/bell guided)
3. Resonance frequency assessment (6 breath rates, 2 min each, visual breathing pacer)
4. Results computed and saved to Supabase

## Metrics Computed

**Time-domain:** RMSSD, SDNN, pNN50, NN50, Mean HR, Mean RR  
**Frequency-domain:** Total Power, LF, HF, VLF, LF/HF, LF n.u., HF n.u.  
**Nonlinear:** Sample Entropy (SampEn), DFA α1  
**Composite:** Cardiac Coherence Ratio, Baevsky's Stress Index  
**Respiratory:** Resting breath rate, Resonance frequency  

## Auth

This app has no login and reads no JWT or other token from the URL. It carries no Supabase client.

The only launch params are `embedded`, `name`, `attempt`, `phase` and `fast`. Without `embedded=true` the app shows a gate screen pointing to Neuro Progeny University; with it, the full assessment runs. Nothing verifies who opened it.

What limits it today:
- Only `https://university.neuroprogeny.com` (and the app itself) may frame it, via the `frame-ancestors` CSP in `next.config.js`.
- Results are posted only to the platform's origin (`NEXT_PUBLIC_PLATFORM_URL`, default `https://university.neuroprogeny.com`), and only when the app is framed. Opened standalone, it sends results nowhere.

Token-based access control is planned and not built.

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in Supabase credentials (same project as NPU Platform)
npm run dev
```

## Deployment

Hosted on Vercel. Custom domain: assess.neuroprogeny.com
