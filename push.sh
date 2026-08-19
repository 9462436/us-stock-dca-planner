#!/bin/bash

# Git Push to GitHub (with remote rebase) - Bash version
# Equivalent to push.bat but for Git Bash/bash environments

echo "============================================================"
echo "   Git Push — 含远端 rebase 合并"
echo "============================================================"
echo

# Change to script directory
cd "$(dirname "$0")"

# 1. Fetch remote (without merge), see if remote has new commits
echo "[1/4] Fetching remote..."
if ! git fetch origin; then
    echo
    echo "[Error] fetch failed!"
    echo "   Possible causes:"
    echo "   1. SSH public key not added to GitHub: https://github.com/settings/keys"
    echo "   2. SSH config not effective"
    echo "   3. Network problems"
    echo
    echo "If SSH consistently fails, you can temporarily switch to HTTPS + PAT:"
    echo "   git remote set-url origin https://github.com/9462436/us-stock-dca-planner.git"
    echo "   Then you'll be prompted for GitHub username + Personal Access Token (PAT)"
    exit 1
fi

echo

# 2. Check if remote has new commits
REMOTE_COUNT=$(git rev-list --left-right --count HEAD...origin/main 2>/dev/null)
echo "Above line: left=local-only commits, right=remote-only commits"
echo "$REMOTE_COUNT"
echo

# 3. If remote has updates, first rebase (remote commit only moved holdings.json, merge is fine)
echo "[2/4] Attempting to rebase remote..."
if ! git rebase origin/main; then
    echo
    echo "[Warning] rebase failed — possibly local conflicts"
    echo "Automatically switching to merge to merge remote holdings.json changes..."
    git rebase --abort
    if ! git merge origin/main --no-edit; then
        echo "[Error] merge also failed"
        exit 1
    fi
fi

# 4. Check for staged changes that need committing
echo "[3/4] Checking for uncommitted changes..."
if ! git diff --cached --quiet; then
    echo "There are uncommitted changes..."
    git add -A
    read -p "Please enter commit message: " MSG
    if [ -z "$MSG" ]; then
        MSG="auto-sync: 更新代码"
    fi
    if ! git commit -m "$MSG"; then
        echo "[Error] commit failed"
        exit 1
    fi
else
    echo "[3/4] No new changes to commit"
fi

echo

# 5. Push
echo "[4/4] Pushing to GitHub..."
if ! git push origin main; then
    echo
    echo "============================================================"
    echo "   Push failed — troubleshooting guide"
    echo "============================================================"
    echo
    echo "[A] SSH authentication failed (Permission denied publickey):"
    echo "    1. Open https://github.com/settings/keys"
    echo "    2. Click 'New SSH key'"
    echo "    3. Title: Enter your machine name (e.g., LAPTOP-TUAN2KL8)"
    echo "    4. Key type: Authentication Key"
    echo "    5. Key content: Paste the entire line below ↓"
    echo
    echo "    ---"
    cat "$HOME/.ssh/id_rsa.pub"
    echo "    ---"
    echo
    echo "[B] Or switch to HTTPS + PAT:"
    echo "    git remote set-url origin https://github.com/9462436/us-stock-dca-planner.git"
    echo "    Push will prompt for username + GitHub PAT (Settings > Developer settings > PAT)"
    echo
    exit 1
fi

echo
echo "============================================================"
echo "   Push successful! Render will auto-deploy"
echo "============================================================"