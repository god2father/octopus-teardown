# octopus-teardown

用 [elvarofficial/teardown](https://github.com/elvarofficial/teardown) skill 复刻其 README 里的 **Pelagos OC-8 机械章鱼** 示例。
原仓库只放了章鱼的 GIF，没有源码；这里照着 `reference/` 里的 GIF 关键帧，按 skill 的结构从零搭建。

## 在线访问

- 交互页面：https://god2father.github.io/octopus-teardown/
- 25 秒影片版：https://god2father.github.io/octopus-teardown/film.html
- 机械蜜蜂 Mellis HB-7 交互页面：https://god2father.github.io/octopus-teardown/bee.html
- 机械蜜蜂 24 秒影片版：https://god2father.github.io/octopus-teardown/bee-film.html

`npm run pages` 会重新构建并把页面复制到 `docs/`（GitHub Pages 从 `main` 分支的 `/docs` 发布）。

## 运行

```bash
npm run setup     # 首次：把 teardown skill 装进 .claude/skills/teardown，并安装依赖（three / esbuild / playwright）
npm run build     # → teardown-out/dist/octopus-live.html 与 octopus-film.html（离线单文件）
npm run open      # 打开可交互页面
npm run open:bee  # 打开机械蜜蜂交互页面
npm run beats     # 按时间轴截帧审片
npm run video     # 录 60fps 视频（需要 ffmpeg）
```

## 结构（与 skill 示例一致）

| 文件 | 作用 |
|---|---|
| `sims/octopus-shared/kin.js` | 数学：真实尺寸、机身摆动、喷射循环、每条臂 18 节按曲率积分（贴地 + 尖端 1/r 螺旋） |
| `robot.js` | 几何：8 瓣铆钉外壳、泵芯、双光学眼、三节伸缩虹吸管、喙、144 节臂 + 544 吸盘轮（instanced） |
| `stage.js` | 浅色水槽工作室、阴影、GTAO、测量环、喷射尾流 |
| `console.js` | 1600×900 控制台：JET / POWER / ARM CURL / DEPTH / ASSEMBLIES / DISPLAY / SUBSYSTEMS / OPERATION LOG |
| `film.js` | 25 秒脚本（8 个操作）和纯函数 `render(t)` |
| `live.js` | 实时页面：按钮、键盘、拖拽环绕、滚轮缩放；闲置时自动巡演，25 秒无操作交还 |

## 交互

ASSEMBLIES：`1` HERO · `2` OPTICS · `3` MANTLE（开壳）· `4` ARM R2（拆臂）· `5` SIPHON（喷射）· `6` BEAK
DISPLAY：`L` 标注 · `E` 爆炸图 · `J` 尾流 · `T` 转台 · 空格暂停 · 拖拽环绕 · 滚轮缩放

在 Claude Code 里打开本目录，skill 会自动可用（`.claude/skills/teardown`），可以直接说“给章鱼加一个……”继续迭代。

## 机械蜜蜂 Mellis HB-7

照 teardown skill README 里的蜜蜂 GIF（`reference/bee/bee.gif`）复刻，代码在 `sims/bee-shared/`、`sims/bee-live/`、`sims/bee-film/`。外形取真实蜜蜂的比例与轮廓（三角头、复眼、膝状触角、胸背小盾片、细腰、条纹腹甲、花粉舱），材质保持机械（白漆外壳、黑色结构、橙色关节）。

ASSEMBLIES：`1` HERO · `2` OPTICS · `3` WING（快拆右前翼）· `4` LEG L2 · `5` THORAX（开胸壳）· `6` ABDOMEN（拉开腹甲）
DISPLAY：`L` 标注 · `E` 爆炸图 · `M` 运动模糊 · `T` 转台 · 空格暂停 · 拖拽环绕 · 滚轮缩放
