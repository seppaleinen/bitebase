# Programmatic SEO (pSEO) Implementation Plan

This document tracks the implementation of the `/learn/[topic]` route to capture "Learn [Topic]" search intent and provide AI-ready structured data.

## 🎯 Objective
Create dynamic, server-rendered landing pages for every topic in our database to capture search traffic and provide AI-ready structured data.

---

## 🗺️ Implementation Roadmap

### Phase 1: API & Schema (The Foundation)
- [ ] **1.1 Database Slug Support**: Ensure `courses` has a `slug` column (indexed) or a reliable way to derive it.
- [ ] **1.2 tRPC Procedure**: Add `course.getByTopicSlug(slug: string)` to `packages/api/src/routers/course.ts`.
    - [ ] Must be in `publicRouter`.
    - [ ] Must include Zod validation for the `slug` string.
- [ ] **1.3 Integration Testing**: Write test in `packages/api/tests/course.integration.test.ts` to verify topic-based lookups.

### Phase 2: The Page Template (The Content)
- [x] **2.1 Next.js Route**: Created `apps/web/src/app/learn/[topic]/page.tsx`.
- [x] **2.2 Layout Components**:
    - [x] **Hero**: Dynamic `<h1>` and Subtitle.
    - [x] **Curriculum Preview**: Visual list/grid of lessons/sections.
    - [x] **Value Props**: "Interactive Quizzes," "AI-Powered," etc.
    - [x] **CTA**: "Start Learning Now" button.
- [x] **2.3 Metadata & AEO**:
    - [x] Dynamic `generateMetadata` (Title, Description, OG Tags).
    - [x] Inject `Course` and `LearningResource` JSON-LD schemas.
- [x] **2.4 Hybrid Logic**:
    - [x] If topic exists $\rightarrow$ show full course.
    - [x] If topic missing $\rightarrow$ show "Generate [Topic] Course" placeholder + CTA.

### Phase 3: Crawlability (The Connection)
- [x] **3.1 Dynamic Sitemap**: Updated `apps/web/src/app/sitemap.ts` to include `/learn/[slug]` entries from DB.
- [x] **3.2 Canonicalization**: Self-referencing canonical URLs set via `generateMetadata` alternates.

---

## 🛠️ Technical Specs & Decisions
- **Rendering**: ISR (Incremental Static Regeneration) with `revalidate = 3600`.
- **Routing**: Next.js App Router.
- **Security**: Public read-only access; strict Zod validation on slugs.
- **Hybrid Strategy**: Use existing courses where available; use "Generate" CTA for missing topics to turn 404s into leads.
