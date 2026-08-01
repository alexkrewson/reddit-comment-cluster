# Analyzer (reddit-comment-cluster) — notes for future sessions

Read the shared conventions first: `CHANGELOG.md`, then `best-practices.md`,
`css-best-practices.md` and `testing-guidelines.md`. They live in the
`apps-shared` repo — `../apps-shared/` here, `/home/alex/apps/shared/` on the
Ubuntu box, otherwise `github.com/alexkrewson/apps-shared`. Say "sync shared"
to have them re-applied to this project.

See `HANDOFF.md` for what the app is. The frontend that matters is
`bookmarklet.html`; the root `.py` scripts are older analysis tooling.

## Security

`comment_cluster.py` has a Reddit API `client_id` and `client_secret` hardcoded
at lines ~95-97, and **this repo is public**. Those credentials have been
readable by anyone since commit `6cb7b34`. Removing them from the file does not
help on its own — they stay in git history and the GitHub API, so the fix is to
rotate them at reddit.com/prefs/apps and read them from the environment.

## Stack

Python scripts need `praw` and `requests`. Data lives in this Supabase project
under the `comment_cluster` schema (`analyses`), sharing `auth.users` with every
other app there.
