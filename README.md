# StoryTime Discord Bot

A community bot for StoryTime's private Discord server.

## Planned features

- Birthday reminders
- Collaborative playlist notifications/reminders and statistics
- Hangout reminders / backlog of ideas
- Integration with `st-tools` (StoryTime Productions internal tool)
- Inside-joke tracking (recurring group one-liners)

## Development

```bash
pnpm install
pnpm lint          # ESLint, zero warnings
pnpm format:check  # Prettier check
pnpm typecheck     # tsc --noEmit
pnpm build         # tsc build
pnpm test          # vitest watch mode
pnpm test:ci       # vitest run --coverage (fails below 70% threshold)
```

Pre-commit (Husky) runs lint-staged + typecheck + build automatically. Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) — enforced by commitlint locally (`commit-msg` hook) and in CI.

## Message backfill (one-off)

The St-tools dashboard counts live messages from the day the bot ships. To fill in the past year of
chat messages, run this once inside the bot container (it uses the REST API only and never stores
message text; days before today are set, so running it again is safe):

```bash
docker exec <container> node dist/backfill.js --dry   # print what would be sent
docker exec <container> node dist/backfill.js         # send it
```

Needs View Channel and Read Message History on the chat category and its threads.
