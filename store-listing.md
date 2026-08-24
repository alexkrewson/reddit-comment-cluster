# Distillery — Play Store listing copy

Draft, 2026-08-23. Character counts are checked by `scripts/check-listing.mjs`.

Written to describe what the app does today, not what it might do. iDisagree's
listing had to be reframed after review because "draws the argument while you
have it" oversold a few-second API call as realtime — the fix was to lead with
the thing that is actually true. Same discipline here: Distillery reads public
threads that already exist, and the copy says so.

No em dashes anywhere in this file, at Alex's request.

---

## App name

```
Distillery
```

## Short description (max 80)

```
Reddit threads and YouTube transcripts, distilled into what was actually said.
```

78 characters, checked not counted by hand.

## Full description (max 4000)

```
Some Reddit threads are eight hundred comments long. Distillery reads the whole
thing and tells you what the argument actually was.

Paste a link. You get back the distinct points people made, grouped by theme,
with a sense of how much of the room held each one. Not a comment-by-comment
recap, and not the top five upvoted replies. The positions themselves.

WHAT IT READS

Reddit posts. Every comment on a thread, with deleted, removed and moderator
noise stripped out, sorted by score, then grouped into the actual arguments
being made and how common each one was.

Reddit users. A profile URL or just a username. You get a read on how the
account behaves: how likely it is to be a bot, whether it argues in good faith,
how it thinks, with direct quotes.

Subreddits. Before you post somewhere new, find out what the room is like. Tone,
typical topics, how people treat each other, what does well, and any norms worth
knowing before you trip over one.

YouTube transcripts. Fetch the transcript of any video with captions, read it
with timestamps, and optionally have it analysed the same way.

WHY IT IS USEFUL

Reading a long thread properly takes half an hour and you still finish it unsure
whether the loudest comment was the common view or one person repeating himself.
Distillery separates those two things. It is for deciding whether a thread is
worth your time, catching up on an argument you missed, and understanding a
community before you join in.

HOW IT WORKS

Analysis runs on Claude, and you pay only for what you use. There is no
subscription. New accounts start with free credits, and each analysis deducts
its real cost, shown to you.

Downloading the raw cleaned data never costs anything, because it never calls
the AI. If you only wanted the comments in a tidy file, take them and go.

Every analysis is saved to your history so you can reopen it later without
paying to run it again.

Credits are bought on the Distillery website, not inside this app.

WHAT IT DOES NOT DO

Distillery only reads content that is already public. It does not sign in to
Reddit or YouTube as you, cannot see private messages or private subreddits, and
has no access to your accounts on either service.

It can summarise a person's public posting history. That is public information
and the app adds nothing private to it, but the summary is still about a real
person, and it is meant for understanding a conversation, not for building
profiles of people.

No ads. No analytics. No advertising ID. Sign in is an email address and a code,
and that is the only personal detail stored.
```

2,586 characters, comfortably inside 4,000.

---

## Still needed

- **512x512 icon.** There is no source art at all yet; the app currently ships
  Capacitor's default launcher icon.
- **1024x500 feature graphic.**
- **2 to 8 phone screenshots, 1080x2400.** Do not capture these until the white
  system bars are fixed, see `PLAY-STORE.md`. Write the capture as a script and
  keep it, and use one theme and one worked example across every shot.
- A worked example worth photographing: a real thread with a genuinely contested
  argument, so the grouping is visibly doing something.
