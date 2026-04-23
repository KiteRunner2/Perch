# Implementation Spec: GitHub PR Review Dashboard

## Task

Build the MVP of a personal GitHub pull request review dashboard based on the design below. This is a single-user, client-only web app — no backend, no database. Token and state live in the browser.

## Design reference

Fetch this design file, read its readme, and implement the relevant aspects of the design:
**https://api.anthropic.com/v1/design/h/zrZZxxVlHDmGhvk4Py39hg**

Match the design closely — typography, spacing, color, density, component structure. Where the design is ambiguous or under-specified, favor the Linear/Raycast/Vercel aesthetic over generic defaults. Dark mode is primary; ship light mode as a parallel theme driven by a single toggle.

## Why we're building this

GitHub's native PR list is repo-oriented and cluttered. A reviewer's actual mental model is action-oriented: *"what needs my attention / what's blocked / what's ready."* The dashboard reorganizes around those questions, aggregates across repos and orgs, and shows approval state + CI status at a glance. This principle should guide every implementation tradeoff.

## Stack

- **Vite + React + TypeScript** (strict mode)
- **Tailwind CSS** for styling (v4 if available, v3 otherwise)
- **graphql-request** for the GitHub GraphQL API (lightweight, no need for Apollo)
- **@tanstack/react-query** for fetching, caching, auto-refresh
- **zustand** for UI state (selected PR, filters, theme)
- **date-fns** for relative timestamps
- **lucide-react** for icons
- **Bun** as the package manager and script runner — not npm, not pnpm, not yarn

No Next.js, no SSR, no router library unless the design requires multiple routes — a single-page layout with conditional panels is fine.

## Authentication (MVP)

GitHub Personal Access Token stored in `localStorage`. On first load, if no token is present, show a gated setup screen with:
- Input for the PAT
- Link to GitHub token creation with correct scopes pre-selected (`repo`, `read:org`, `read:user`)
- A "test connection" button that calls `viewer { login }` and confirms

Store the token, then proceed to the dashboard. Include a "reset token" option in settings.

**Do not** hardcode a token. **Do not** commit one. Treat the token as sensitive in logs and error messages.

## Data layer — the core GraphQL query

This query fetches everything the dashboard needs in a single round trip. Use it verbatim or close to it:

```graphql
query PRDashboard($searchQuery: String!) {
  viewer {
    login
    avatarUrl
    pullRequests(states: OPEN, first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { ...PRFields }
    }
  }
  reviewRequested: search(query: $searchQuery, type: ISSUE, first: 50) {
    nodes {
      ... on PullRequest { ...PRFields }
    }
  }
  rateLimit {
    remaining
    resetAt
  }
}

fragment PRFields on PullRequest {
  id
  number
  title
  url
  isDraft
  mergeable
  updatedAt
  createdAt
  repository { nameWithOwner }
  author { login ... on User { avatarUrl } }
  assignees(first: 5) { nodes { login avatarUrl } }
  reviewRequests(first: 10) {
    nodes {
      requestedReviewer {
        ... on User { login avatarUrl }
        ... on Team { name }
      }
    }
  }
  reviews(last: 20) {
    nodes {
      author { login ... on User { avatarUrl } }
      state
      submittedAt
    }
  }
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup { state }
      }
    }
  }
  labels(first: 10) {
    nodes { name color }
  }
}
```

Where `searchQuery = "is:open is:pr review-requested:@me archived:false"`.

Poll every 60 seconds via react-query's `refetchInterval`. Show a subtle "last updated Xs ago" indicator in the header. Surface rate limit remaining in the settings/debug panel.

## Bucketing logic

Each PR appears in **exactly one bucket**. Evaluate in this priority order and stop at the first match:

1. **Waiting on me** — PR is in `reviewRequested` results AND the viewer hasn't submitted an APPROVED or CHANGES_REQUESTED review since the last review request.
2. **Blocked** — viewer is the author AND (any review has state = CHANGES_REQUESTED AND no newer APPROVED review from that same reviewer) OR `statusCheckRollup.state === "FAILURE"`.
3. **Ready to merge** — viewer is the author AND has at least one APPROVED review AND `statusCheckRollup.state === "SUCCESS"` AND `mergeable === "MERGEABLE"` AND not draft.
4. **In review** — viewer is the author AND has active review requests OR pending reviews, no blocking signal yet.
5. **Stale** — anything reaching this point that hasn't been updated in 7+ days.
6. **Other** — everything else (should be rare; surface in a collapsed "Other" bucket only if non-empty).

Put this logic in `src/lib/bucketing.ts` as a pure function with unit tests. The test file should cover each bucket with realistic PR fixtures.

## TypeScript types

Generate types from the GraphQL schema with `graphql-codegen`, OR hand-write them to match the query. Don't use `any`. Export a `DashboardPR` domain type that's a flattened, consumer-friendly shape (e.g. `approvalCount: number`, `ciStatus: 'success' | 'failure' | 'pending' | 'none'`, `waitingTimeMs: number`). Bucketing logic consumes `DashboardPR`, not raw GraphQL nodes.

## Scope — what to build

1. Token setup flow + settings (token reset, theme toggle, repo/org filters if design shows them)
2. Primary dashboard with all five buckets, each collapsible, with counts
3. PR row component matching the design exactly, in idle/hover/focus states
4. PR detail expansion — use whichever pattern the design specifies (modal, drawer, or inline)
5. Keyboard navigation: `j`/`k` to move row selection, `enter` to open PR in new tab, `e` to expand detail, `/` to focus search/filter, `?` for shortcut help
6. Auto-refresh every 60s, with visible "last updated" + manual refresh button
7. Loading state (skeleton matching the design) and error state (expired token, rate limit, network)
8. Empty state per bucket + global "all caught up" state

## Scope — what NOT to build (yet)

- Backend, database, PR history/metrics
- OAuth flow (PAT is fine for MVP)
- Multi-user support
- Notifications (Telegram/Slack/email)
- Write actions (approve, comment, merge) — clicking a PR opens the real GitHub page in a new tab
- Routing between multiple pages
- Tests beyond the bucketing logic unit tests

Resist scope creep. The value of this tool is the inbox view. Ship that, use it, let real friction drive v2.

## Project structure (suggested, adapt as needed)

```
src/
  lib/
    github.ts          # GraphQL client + query
    bucketing.ts       # pure bucketing logic + tests
    transform.ts       # raw GraphQL -> DashboardPR
    storage.ts         # token persistence
  hooks/
    usePRs.ts          # react-query hook wrapping the query
    useKeyboardNav.ts
  components/
    Dashboard.tsx
    Bucket.tsx
    PRRow.tsx
    PRDetail.tsx
    TokenSetup.tsx
    Settings.tsx
    Header.tsx
  types/
    github.ts          # GraphQL response types
    dashboard.ts       # DashboardPR + bucket types
  App.tsx
  main.tsx
```

## Quality bar

- Strict TypeScript. No `any`, no non-null assertions without comment.
- Pure functions where possible. Data transformation separate from rendering.
- Accessibility: semantic HTML, `aria-*` on interactive elements, keyboard nav that works without a mouse.
- Responsive from 1280px up. Mobile is not a target for MVP but don't horizontally scroll.
- No console errors or warnings on a clean run.

## Environment notes

I run this on macOS (M3) and Windows (i7-12700KF). Use **Bun** (`bun install`, `bun dev`, `bun run build`, `bun test`) — not npm, pnpm, or yarn. If any dependency has a native build issue under Bun, flag it rather than silently switching package managers. Include clear `README.md` instructions for: install, dev server, build, token setup.

## Deliverable

A runnable app (`bun dev`) that matches the design, authenticates with my PAT, shows my real open PRs bucketed correctly, and auto-refreshes. Ship this end-to-end before polishing any single piece.

Start by fetching the design file, reading the readme, and confirming the component inventory against this spec. Flag any conflicts between the design and this spec before writing code.