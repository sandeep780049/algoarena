# JC AlgoArena 🏆

Competitive coding contests, quizzes, and practice — all in one platform. Take part in timed contests, solve MCQ challenges, climb the leaderboard, and earn certificates.

## Features

- **Contests** — daily, weekly, and special timed contests with live countdowns
- **Anti-cheat** — detects tab switches and flags attempts to leave the contest window
- **Leaderboard** — global rankings with a podium view for top performers
- **Certificates** — downloadable certificate cards for contest winners
- **OTP email auth** — passwordless sign-in via Supabase Edge Functions + Resend
- **Result sharing** — share your score cards on WhatsApp or X
- **Admin panel** — manage contests, questions, and published state
- **Profiles & avatars** — upload an avatar and track your contest history

## Tech Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [React Router](https://reactrouter.com/) + [TanStack Query](https://tanstack.com/query)
- [Supabase](https://supabase.com/) — database, auth, and Edge Functions (Deno)
- [Resend](https://resend.com/) — transactional email for OTPs and contest reminders

## Getting Started

```sh
npm install
npm run dev
```

The app reads Supabase configuration from `.env` at build time:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

## Supabase Edge Functions

The OTP and contest-email flows run as Supabase Edge Functions. Deploy them with:

```sh
supabase functions deploy send-otp
supabase functions deploy verify-otp
supabase functions deploy send-contest-email
supabase functions deploy send-contest-reminders
```

Set the `RESEND_API_KEY` secret, and make sure the `ALLOWED_ORIGINS` list in each function includes your deployed origin.

## Deployment

Deployed on [Render](https://render.com/) as a **Static Site** from this repository:

- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Add a rewrite rule `/*` → `/index.html` so client-side routes work on refresh

The committed `.env` supplies the Supabase configuration at build time, and new pushes to `main` auto-deploy.

## Live Site

🌐 https://algoarena-9nwy.onrender.com
