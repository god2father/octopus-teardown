# Freedom Gundam 头部建模交接

## 接手结论

**用户明确认为当前模型与照片相距甚远，要求推送并换模型接手。当前工作未完成、未验收。不要把 V19 当作接近完成的模型。**

目标仍是根据参考图做出一致的三维头部。可以重做主形体，不必继承现有程序化网格。当前代理已停止造型修改。

## 仓库与当前文件

- 仓库：`https://github.com/god2father/octopus-teardown`
- 分支：`freedom-teardown`
- 本机目录：`/Users/congt/workspace/octopus-teardown`
- 本轮之前的提交：`a5cff0a`。
- 上一轮全身 Three.js 项目的交接原文另存为 [HANDOFF-PREVIOUS.md](HANDOFF-PREVIOUS.md)；其状态描述和建议是历史记录，不要当作本轮结论。
- 当前生成器：[scripts/blender/freedom_head.py](scripts/blender/freedom_head.py)。
- 最新版本 V19：[freedom-head.blend](assets/freedom-head/freedom-head.blend)、[freedom-head-red-armor-v19.blend](assets/freedom-head/freedom-head-red-armor-v19.blend)。两者来自同次构建。
- 导出：[freedom-head.glb](assets/freedom-head/freedom-head.glb)。
- 最新实际渲染：[三分之四](assets/freedom-head/renders/three-quarter.png)、[正面](assets/freedom-head/renders/front.png)、[侧面](assets/freedom-head/renders/side.png)。
- [参考/模型对照](assets/freedom-head/reference-comparison.png)、[参考/真实灰模对照](assets/freedom-head/actual-clay-vs-reference.png)。优先直接看图，不能只读检查结果。
- 其余带版本号 `.blend` 为历史快照，不代表更好的造型。
- `teardown-out/` 原路径仍被忽略；其中本次头部相关的 55 张参考裁图、历史渲染和诊断图已完整复制到 [history/](assets/freedom-head/history)，并随 Git 提交。[index.json](assets/freedom-head/history/index.json) 记录原路径、大小和 SHA-256，复制后已逐张校验。加上当前资源，共提交 70 张头部图片。
- 历史图包含失败版本、参考图放大和诊断叠图；不能将它们全部理解为当前模型渲染。
- 另将本地实验/UI 备份中的 12 个 `.blend` 场景复制到同一 `history/` 目录，校验值记录在 `index.json` 的 `models` 中；包括最初构建、截面实验和切换版本前保存的 UI 快照。加上当前资源，共提交 **30 个 `.blend`、1 个 GLB 和 70 张图片**。历史快照不代表已验收模型。

## 用户已经确认的方向

1. **主轮廓标准是生成的三分之四视图**，正面和侧面只作辅助。生成的不同视图本身存在不一致。
2. 用户曾指出头部过扁，后来确认 Blender 中已经不那么扁；不能为匹配单个投影把整个头重新压扁。
3. 用户认为整体轮廓仍差很大，要求先解决形体，不要靠细节补救。
4. 头盔两侧通风栅栏是**突出的独立结构**，不是沿头盔圆弧顺下来的表面。需要确认框体、叶片和侧壁的实际三维突出关系。
5. 截图必须对应当前真实模型。之前曾出现 UI 打开旧版、图片展示新版的问题。
6. 曾展示的彩线轮廓诊断图，其漂亮底图是参考图，只有彩线来自模型。用户误以为底图也是模型；禁止再用此类叠图暗示模型已逼真。

## 参考资料

- 生成六视图：[head-six-views.png](assets/freedom-head/reference/head-six-views.png)，1536×1024，3 列×2 行；主三分之四视图在左下格。
- 原仓库身份参考：`reference/freedom/sheet.webp`。
- 原仓库其他参考：`img2/freedom/proj/head-front.jpg`、`img2/freedom/proj/head-side.jpg`。
- [part-constraints.json](assets/freedom-head/reference/part-constraints.json)：手工点、投影参数和大量推断深度，**不是准确测量或可靠真值**。
- [body-contours.json](assets/freedom-head/reference/body-contours.json)：手工近似轮廓，部分被遮挡位置为推断。

## 当前实现与不足

当前是 Blender Python 程序化重建，不是已经拟合成功的高保真模型。X 向右、-Y 向前、Z 向上；尺寸是建模单位，尚未校准网页挂点与比例。Blender 本机版本为 3.1.2。

- V7 起根据图中点求解局部截面，但隐藏深度依赖人为设定。
- V9–V13 增加凸出通风框、叶片厚度、根部连接及暗色风道；仍不能证明通风模块形状正确。
- V14 调整脸罩中央平脊、嘴部切口和下巴缺口。
- V15 固定主视图的对照比例和平移，并统一约束投影，避免每版重新用颜色质心拟合主视图。
- V16 调整额顶遮罩、顶盖及镜头高度。
- V17–V18 封闭眉骨后端开口并减少连接面的内凹。
- V19 加宽额饰、调整下巴深度和下脸罩推断截面。调整下脸罩后曾触发布尔失败、整片脸罩缺失；增加切口前的三角化后重新构建，需以最新渲染和几何检查为准。

**主要问题仍是形体不像。** 额顶、眉骨、侧甲、脸罩、通风叶片截面与部件前后关系都不能视为通过。不要继续把“某个点误差很小”“网格闭合”“增加版本号”当作整体相似度进展。当前多次局部补丁使代码与几何关系复杂，建议先评估重建而非继续修补。

## 验证的实际范围

[review_head.py](scripts/blender/review_head.py) 检查有限数据、若干主要部件闭合体积、叶片与框相交、镜像、局部可见性射线，以及少量顶点的相机投影。**这些都不是造型相似度验收。**

[compare_head.py](scripts/blender/compare_head.py) 输出真实渲染对照和颜色定位诊断；主视图固定对齐，辅助视图仍用红色额饰/下巴的可见颜色质心做统一缩放和平移。颜色质心会受遮挡变化影响，不能当作精确几何测量。

注意 Blender 3.1 在 Python 异常时进程可能仍返回退出码 0。必须检查日志是否有 `Traceback`，以及是否真的出现 `HEAD_BUILD_OK` / `HEAD_GEOMETRY_REVIEW_OK`。

## 复现命令

在仓库根目录运行（构建会覆盖当前 canonical `.blend`、GLB 和渲染）：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/freedom_head.py
/Applications/Blender.app/Contents/MacOS/Blender --background assets/freedom-head/freedom-head.blend --python scripts/blender/review_head.py
python3 scripts/blender/compare_head.py
```

最后一条需要 Pillow 和 NumPy。本机已验证的 Python 为：

```sh
/Users/congt/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/blender/compare_head.py
```

网页启动命令为 `npm run dev:freedom`，本地地址 `http://127.0.0.1:8791/`。**网页仍使用原来的 Three.js 程序化头部，尚未接入此 Blender GLB。** 不要认为刷新网页即可看到最新 Blender 结果。

## Blender 界面状态

最后可靠确认的窗口文件是 V15。尝试切到 V16 时，界面报告用户正在操作；之后后台构建没有继续切换窗口。接手时先核对窗口标题、实际文件路径与模型，不要凭当前视口猜版本。不要覆盖用户可能在 GUI 中做的修改。

## Skill / MCP 调查结果

用户问过有没有适合的 Skill。官方精选列表当时未找到 Blender 专项；现有 `img2threejs` 主要面向程序化 Three.js，不等同于 Blender 参考图建模工作流。

已找到但**没有安装或运行**的第三方候选：

- [reference-modeling](https://github.com/colinurbs/claude-modeling-skills/tree/main/skills/reference-modeling)：参考图建模，明确区分轮廓匹配与三维截面正确；依赖 Blender MCP，路径可能需要适配 Codex。
- [blender-hard-surface-modeling](https://github.com/ProkStudio/skills/tree/main/skills/blender/blender-hard-surface-modeling)：硬表面、倒角、拓扑等工作流。
- [MCP for Blender](https://github.com/ahujasid/mcp-for-blender)：操作连接器，不是自动保证准确建模的 Skill。本机兼容性、遥测与配置均未完成审查，不要宣称已连接。

接手可以先评估这些工具，但当前失败主要是重建方法和形体判断，不能认为装工具就会自动解决。

## 建议接手顺序

1. 直接查看主参考图与最新实际模型，独立判断差距，必要时从主形体重做。
2. 固定相机，先做无细节主形体；同时检查内部大面的遮挡、截面和厚度，不能只描外轮廓。
3. 单独展示通风框与叶片的三分之四、侧面及局部近景，确认独立凸出结构。
4. 获得合理整体形体后再处理细节；未经验证不要接入网页或声称完成。

本轮只提交、推送并交接；未提交任何“已达参考一致”的结论。
