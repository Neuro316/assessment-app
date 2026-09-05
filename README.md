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

Participant authenticates through the NPU Platform. Their Supabase JWT is passed to this app via URL params. No separate login.

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in Supabase credentials (same project as NPU Platform)
npm run dev
```

## Deployment

Hosted on Vercel. Custom domain: assess.neuroprogeny.com
