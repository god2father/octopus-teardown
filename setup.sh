#!/usr/bin/env bash
# 把 teardown skill 装进本项目（.claude/skills/teardown）并安装依赖。在项目根目录运行一次：bash setup.sh
set -e
cd "$(dirname "$0")"
SK=.claude/skills/teardown
if [ ! -f "$SK/SKILL.md" ]; then
  # 官方方式：项目级安装（不加 -g）
  npx -y skills add elvarofficial/teardown -a claude-code -y || true
fi
if [ ! -f "$SK/SKILL.md" ]; then
  # 兜底：直接克隆仓库到项目 skill 目录
  mkdir -p .claude/skills
  git clone --depth 1 https://github.com/elvarofficial/teardown "$SK"
fi
cd "$SK"
npm install
npx playwright install chromium
echo "✓ teardown skill 已装在 $SK"
