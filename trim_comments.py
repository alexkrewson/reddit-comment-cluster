import json
import re
import os
import glob

def remove_urls(text):
    url_pattern = r'(https?://\S+|www\.\S+|\[.*?\]\(https?://.*?\))'
    return re.sub(url_pattern, '', text or "")

def flatten_comments(comments):
    flat = []
    for c in comments:
        author = c.get("author", "")
        body = c.get("body", "")
        # Always keep DeltaBot comments, and set their score artificially high
        if author == "DeltaBot":
            cleaned_body = remove_urls(body)
            flat.append({
                "author": author,
                "body": cleaned_body,
                "score": 1000000
            })
        # Otherwise, apply all other filters
        elif (
            body not in ("[removed]", "[deleted]")
            and author not in ("[deleted]", None)
            and "modteam" not in (author or "").lower()
        ):
            cleaned_body = remove_urls(body)
            flat.append({
                "author": author,
                "body": cleaned_body,
                "score": c.get("score")
            })
        if "replies" in c:
            flat.extend(flatten_comments(c["replies"]))
    return flat

with open("comments.json", "r", encoding="utf-8") as f:
    data = json.load(f)

flat_comments = flatten_comments(data["comments"])
flat_comments.sort(key=lambda c: c.get("score", 0), reverse=True)

output = {
    "post_title": data.get("post_title"),
    "comments": flat_comments
}

# Write full output
with open("comments_flattened.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

# --- Write truncated output (top 190k characters, always keep DeltaBot) ---
max_total_chars = 190_000
truncated_comments = []
base_len = len(json.dumps({"post_title": output["post_title"], "comments": []}, indent=2, ensure_ascii=False))
current_len = base_len

for comment in flat_comments:
    comment_json = json.dumps(comment, indent=2, ensure_ascii=False)
    add_len = len(comment_json) + (2 if truncated_comments else 0)
    if current_len + add_len > max_total_chars:
        break
    truncated_comments.append(comment)
    current_len += add_len

truncated_output = {
    "post_title": output["post_title"],
    "comments": truncated_comments
}

with open("comments_flattened_truncated.json", "w", encoding="utf-8") as f:
    json.dump(truncated_output, f, indent=2, ensure_ascii=False)

print(f"Flattened, cleaned, filtered, sorted {len(flat_comments)} comments to comments_flattened.json")
print(f"Wrote top {current_len} characters to comments_flattened_truncated.json ({len(truncated_comments)} comments)")

# --- Delete existing chopped files ---
for fname in glob.glob("comments_flattened_truncated_chopped_*.json"):
    os.remove(fname)

# --- Split into ~19k char files, only as many as needed ---
comments = truncated_output["comments"]
post_title = truncated_output.get("post_title")
chunks = []
i = 0
n = len(comments)
max_chunk_len = 19_000

while i < n:
    current_chunk = []
    # Only include post_title in the first chunk
    if not chunks:
        current_len = len(json.dumps({"post_title": post_title, "comments": []}, ensure_ascii=False, indent=2))
    else:
        current_len = len(json.dumps({"comments": []}, ensure_ascii=False, indent=2))
    while i < n:
        comment = comments[i]
        comment_json = json.dumps(comment, ensure_ascii=False, indent=2)
        add_len = len(comment_json) + (2 if current_chunk else 0)
        if current_len + add_len > max_chunk_len and current_chunk:
            break
        current_chunk.append(comment)
        current_len += add_len
        i += 1
    chunks.append(current_chunk)

for idx, chunk in enumerate(chunks):
    if idx == 0:
        out = {
            "post_title": post_title,
            "comments": chunk
        }
    else:
        out = {
            "comments": chunk
        }
    with open(f"comments_flattened_truncated_chopped_{idx+1}.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

print(f"Wrote {len(chunks)} chopped files: comments_flattened_truncated_chopped_1.json ... comments_flattened_truncated_chopped_{len(chunks)}.json")