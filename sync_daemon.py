#!/usr/bin/env python3
"""
持仓同步守护进程
- 每 30 秒从 Render 拉取最新 holdings.json
- 与本地文件对比，不同则覆盖
- 触发可选的 git auto-commit & push（需配置）

用法：
  1. 直接运行：python sync_daemon.py
  2. 或加入开机启动
"""
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

# 配置
CLOUD_URL = "https://us-stock-dca-planner.onrender.com/api/load-holdings"
LOCAL_FILE = Path(__file__).parent / "holdings.json"
POLL_INTERVAL = 30  # 秒
AUTO_GIT_PUSH = True  # 是否自动 git commit + push

def fetch_cloud():
    """从云端拉取持仓"""
    try:
        with urllib.request.urlopen(CLOUD_URL, timeout=8) as r:
            data = json.loads(r.read().decode())
            return data.get("holdings", {})
    except Exception as e:
        return None

def read_local():
    """读取本地文件"""
    if LOCAL_FILE.exists():
        try:
            with open(LOCAL_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return None
    return None

def write_local(holdings):
    """写入本地文件"""
    with open(LOCAL_FILE, 'w', encoding='utf-8') as f:
        json.dump(holdings, f, ensure_ascii=False, indent=2)

def git_commit_push():
    """自动提交并推送（需 git 已配置凭据）"""
    import subprocess
    cwd = str(LOCAL_FILE.parent)
    try:
        # 配置 git 用户（防止 commit 失败）
        subprocess.run(["git", "config", "user.email", "auto-sync@local"],
                       cwd=cwd, check=False, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Auto Sync"],
                       cwd=cwd, check=False, capture_output=True)

        # 暂存文件
        subprocess.run(["git", "add", "holdings.json"],
                       cwd=cwd, check=True, capture_output=True)

        # 检查是否有暂存的变更
        result = subprocess.run(["git", "diff", "--cached", "--quiet"],
                                cwd=cwd, capture_output=True)
        if result.returncode == 0:
            return False  # 无变更

        # 提交
        r = subprocess.run(["git", "commit", "-m", "auto-sync: 持仓 from cloud"],
                           cwd=cwd, capture_output=True, text=True, timeout=15)
        if r.returncode != 0:
            print(f"[Sync] git commit 失败: {r.stderr[:200]}")
            return False

        # 推送（带超时）
        r = subprocess.run(["git", "push", "origin", "main"],
                           cwd=cwd, capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            err = r.stderr.strip()[:200] or r.stdout.strip()[:200]
            print(f"[Sync] git push 失败: {err}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print(f"[Sync] git 操作超时")
        return False
    except FileNotFoundError:
        print(f"[Sync] git 未安装或不在 PATH")
        return False
    except Exception as e:
        print(f"[Sync] git 异常: {e}")
        return False

def main():
    print(f"[Sync] 持仓同步守护进程已启动")
    print(f"[Sync] 云端: {CLOUD_URL}")
    print(f"[Sync] 本地: {LOCAL_FILE}")
    print(f"[Sync] 轮询间隔: {POLL_INTERVAL}秒")
    print(f"[Sync] 自动 git push: {AUTO_GIT_PUSH}")
    print(f"[Sync] Ctrl+C 退出\n")

    while True:
        try:
            cloud = fetch_cloud()
            local = read_local()

            if cloud is None:
                print(f"[Sync] 云端拉取失败")
            elif cloud != local:
                write_local(cloud)
                ts = time.strftime('%H:%M:%S')
                print(f"[Sync] {ts} 本地已更新: {cloud}")
                if AUTO_GIT_PUSH:
                    if git_commit_push():
                        print(f"[Sync] {ts} 已提交并推送到 GitHub ✓")
            else:
                ts = time.strftime('%H:%M:%S')
                print(f"[Sync] {ts} 无变化")
        except KeyboardInterrupt:
            print("\n[Sync] 已退出")
            break
        except Exception as e:
            print(f"[Sync] 异常: {e}")

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()