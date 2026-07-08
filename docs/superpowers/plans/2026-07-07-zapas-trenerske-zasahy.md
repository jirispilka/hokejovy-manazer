# Zápas — trenérské zásahy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or executing-plans.

**Goal:** Pravděpodobnostní model zápasu s viditelnými šancemi, auto-pauzou (varianta A) a trenérskými žetony.

**Architecture:** Nový modul `zapasPravdepodobnost.ts` pro výpočet šancí; `zapas.ts` refaktor minutové smyčky na 3 kroky + stav čekání (`cekaNaPresilovku`, `cekaNaKlicovyMoment`); UI modaly v `ZivyZapas.tsx`.

**Tech Stack:** TypeScript, Vitest, React (existující stack)

## Global Constraints

- `src/core/` bez UI/React; determinismus se seedem; `GameState` JSON-serializovatelný
- České UI texty; žádné nové npm závislosti

---

- [ ] **Task 1:** `zapasPravdepodobnost.ts` — sigmoid, pUtok, pNebezpeci, pGol + testy
- [ ] **Task 2:** Refactor `minutaHry` — 3 kroky, 1 útok/min
- [ ] **Task 3:** Stav čekání PP/PK + `potvrdPresilovku()`
- [ ] **Task 4:** Klíčový moment + `potvrdKlicovyMoment()` + limit 2/třetina
- [ ] **Task 5:** Trenérské žetony ve stavu + efekty
- [ ] **Task 6:** Panel síly v `ZivyZapas.tsx`
- [ ] **Task 7:** Modaly auto-pauzy + timer 10 s
- [ ] **Task 8:** PP/PK předzápas + migrace uložení
