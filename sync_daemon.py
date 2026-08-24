#!/usr/bin/env python3
"""
持仓同步守护进程
- 每 30 秒从 Render 拉取最新 holdings.json
- 与本地文件对比，不同则覆盖
- 自动 git commit + push（GIT_TERMINAL_PROMPT=0 抑制密码弹窗）

用法：
  1. 直接运行：python sync_daemon.py
  2. 开机启动：用 sync_daemon.vbs（推荐）
"""
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

# 配置
CLOUD_URL = "https://us-stock-dca-planner.onrender.com/api/load-holdings"
SCRIPT_DIR = Path(__file__).resolve().parent
LOCAL_FILE = SCRIPT_DIR / "holdings.json"
POLL_INTERVAL = 30  # 秒
AUTO_GIT_PUSH = True  # 是否自动 git commit + push

# 抑制 git 交互式密码输入（后台运行无终端）
os.environ['GIT_TERMINAL_PROMPT'] = '0'
os.environ['GIT_ASKPASS'] = 'echo'

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
    """自动提交并推送（无密码弹窗）"""
    import subprocess
    cwd = str(LOCAL_FILE.parent)
    env = os.environ.copy()
    env['GIT_TERMINAL_PROMPT'] = '0'
    env['GIT_ASKPASS'] = 'echo'
    try:
        # 配置 git 用户
        subprocess.run(["git", "config", "user.email", "auto-sync@local"],
                       cwd=cwd, check=False, capture_output=True, env=env)
        subprocess.run(["git", "config", "user.name", "Auto Sync"],
                       cwd=cwd, check=False, capture_output=True, env=env)

        # 暂存文件
        subprocess.run(["git", "add", "holdings.json"],
                       cwd=cwd, check=True, capture_output=True, env=env)

        # 检查是否有暂存变更
        result = subprocess.run(["git", "diff", "--cached", "--quiet"],
                                cwd=cwd, capture_output=True, env=env)
        if result.returncode == 0:
            return False  # 无变更

        # 提交
        r = subprocess.run(["git", "commit", "-m", "auto-sync: 持仓 from cloud"],
                           cwd=cwd, capture_output=True, text=True, timeout=15, env=env)
        if r.returncode != 0:
            print(f"[Sync] git commit 失败: {r.stderr[:200]}")
            return False

        # 推送
        r = subprocess.run(["git", "push", "origin", "main"],
                           cwd=cwd, capture_output=True, text=True, timeout=30, env=env)
        if r.returncode != 0:
            err = (r.stderr or r.stdout).strip()[:200]
            print(f"[Sync] git push 失败: {err}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print(f"[Sync] git 操作超时")
        return False
    except FileNotFoundError:
        print(f"[Sync] git 未安装")
        return False
    except Exception as e:
        print(f"[Sync] git 异常: {e}")
        return False

def main():
    log_file = SCRIPT_DIR / "sync_daemon.log"
    def log(msg):
        line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
        print(line)
        try:
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(line + '\n')
        except Exception:
            pass

    log(f"持仓同步守护进程已启动")
    log(f"云端: {CLOUD_URL}")
    log(f"本地: {LOCAL_FILE}")
    log(f"轮询间隔: {POLL_INTERVAL}秒, AUTO_GIT_PUSH: {AUTO_GIT_PUSH}")
    log(f"日志文件: {log_file}")
    log(f"Ctrl+C 退出\n")

    while True:
        try:
            cloud = fetch_cloud()
            local = read_local()

            if cloud is None:
                log("云端拉取失败")
            elif cloud != local:
                write_local(cloud)
                log(f"本地已更新: {cloud}")
                if AUTO_GIT_PUSH:
                    if git_commit_push():
                        log("已提交并推送到 GitHub ✓")
                    else:
                        log("git push 失败（已忽略）")
            else:
                log("无变化")
        except KeyboardInterrupt:
            print("\n[Sync] 已退出")
            break
        except Exception as e:
            print(f"[Sync] 异常: {e}")

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()