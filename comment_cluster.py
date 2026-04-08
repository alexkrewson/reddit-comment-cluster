import praw
from praw.models import MoreComments
import json
import re
import requests


def resolve_submission_id(url_or_id):
    """
    Accepts a submission ID, a standard Reddit URL, or a mobile share link
    (e.g. https://www.reddit.com/r/sub/s/TOKEN) and returns the submission ID.
    """
    # Already a bare ID (no slashes)
    if '/' not in url_or_id:
        return url_or_id

    # Follow redirects to resolve mobile share links (/s/TOKEN format)
    if '/s/' in url_or_id:
        response = requests.head(url_or_id, allow_redirects=True)
        resolved = response.url
    else:
        resolved = url_or_id

    # Extract ID from /comments/<id>/... pattern
    match = re.search(r'/comments/([A-Za-z0-9]+)', resolved)
    if match:
        return match.group(1)

    raise ValueError(f"Could not extract submission ID from: {resolved}")

def fetch_all_comments(submission_id, client_id, client_secret, user_agent):
    """
    Fetches all comments and subcomments for a given Reddit submission.
    """
    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent
    )
    
    try:
        submission = reddit.submission(id=submission_id)
        # Replace MoreComments to load all comments
        submission.comments.replace_more(limit=None)  # Use None to expand all
        print(f"Expanding all comments for submission {submission_id}...")
        
        def build_comment_tree(comment, tree=None):
            if tree is None:
                tree = {
                    'id': comment.id,
                    'author': str(comment.author) if comment.author else '[deleted]',
                    'body': comment.body,
                    'score': comment.score,
                    'created_utc': comment.created_utc,
                    'replies': []
                }
            
            # Process replies
            for reply in comment.replies:
                if isinstance(reply, MoreComments):
                    continue  # Should be handled by replace_more
                tree['replies'].append(build_comment_tree(reply))
            
            return tree
        
        comment_tree = {
            'post_id': submission.id,
            'post_title': submission.title,
            'comments': []
        }
        
        for top_comment in submission.comments:
            comment_tree['comments'].append(build_comment_tree(top_comment))
        
        return comment_tree
    
    except Exception as e:
        print(f"Error fetching comments: {e}")
        return None

def save_to_json(comment_tree, filename='comments.json'):
    """
    Saves the comment tree to a JSON file.
    """
    if comment_tree:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(comment_tree, f, indent=4, ensure_ascii=False)
        print(f"Comments saved to {filename}")
    else:
        print("No data to save due to fetch error.")

if __name__ == "__main__":
    raw_input = "https://www.reddit.com/r/DiveInYouCoward/s/R4SHk9A49D"  # Paste a submission ID, full URL, or mobile share link here
    submission_id = resolve_submission_id(raw_input)
    client_id="nTVSegWYAoE4oEjG0lywAA"
    client_secret="nbYeoSwihpGPWbSUmOnw7ZhApLhuLw"
    user_agent="script:comment_cluster1.0:1.0 (by /u/mashmaker86)"

    tree = fetch_all_comments(submission_id, client_id, client_secret, user_agent)
    save_to_json(tree)



