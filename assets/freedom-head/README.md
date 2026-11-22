# Freedom 头部 Blender 重建（进行中）

**用户认为当前造型与参考相距甚远，尚未验收。接手入口见仓库根目录 `HANDOFF.md`。**

`history/` 保存从本地实验目录归档的全部 55 张头部历史图片，`history/index.json` 记录原路径和校验值；其中包含参考裁图及失败版本，不能作为当前模型效果。

同一目录还保存 12 个本地实验/UI 模型快照。整个头部资源目录共保留 30 个 `.blend` 场景、1 个 GLB 和 70 张图片。

- `reference/head-six-views.png`：使用内置 ImageGen，以 `reference/freedom/sheet.webp` 为身份参考生成的六视图。背面、顶部和不可见结构包含推断，不能作为精确尺寸依据。
- `freedom-head.blend`：当前 V19 可编辑 Blender 3.1.2 场景，144 个独立网格部件，包含相机和灯光。
- `freedom-head-red-armor-v19.blend`：当前版本的独立文件；默认以灰模检查形状。
- 其余带版本号的 `.blend`：历史版本；不对应 `renders/` 中当前的图片。
- `freedom-head.glb`：仅导出模型，可用于后续 Three.js 集成；尚未替换网页头部。
- `renders/`：Blender 实际几何的六角度渲染，不是生成图。
- `../../scripts/blender/freedom_head.py`：可重复构建的源脚本。
- `manifest.json`：当前版本、部件清单和视图列表。
- `geometry-review.json`：已保存模型的实际几何体积检查和未完成差异；不是相似度评分。
- `reference/part-constraints.json`：用户选择的主视图、固定投影参数、脸罩和颊甲参考点；建模脚本直接读取这些点来计算截面顶点。
- `actual-clay-vs-reference.png`：左侧参考图片与右侧真实 Blender 灰模并排；右侧不含参考图片像素。
- `reference-comparison.png`：三个视角的参考图/实际彩色渲染对照；主视图固定使用约束投影中的比例和平移，辅助视图按额饰和下巴定位点做统一缩放和平移。
- `silhouette-comparison-v5-v6.png` 等：历史诊断叠图。底图全部是参考图片，彩线才是各版模型投影；图里的漂亮表面不代表模型质量。

## 重建

从仓库根目录运行：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/blender/freedom_head.py
```

坐标：X 向右、-Y 向前、Z 向上；当前尺寸为建模单位，未校准网页比例和颈部挂点。主轮廓标准为用户选择的生成三分之四视图；正面和侧面辅助检查。主审阅相机偏转约 20.6°，由天线投影宽度估算。

## 生成提示词

Use case: product-mockup. Create ONE high resolution professional hard surface 3D modeling reference sheet of ONLY the Freedom Gundam head from the supplied reference. The input image is identity and shape reference, not an edit target. Closely preserve its specific white helmet, long thin gold four-prong V-fin, red forehead central keystone, narrow amber eyes under heavy angular brow, white mask with two small horizontal dark mouth vents, projecting red chin, layered faceted white cheek armor, three diagonal dark side cheek louvers, dark neck and side circular ear mechanism. Do not redesign as a generic robot. 3 by 2 grid on clean neutral grey, SAME head design and consistent scale in every tile: FRONT orthographic, LEFT SIDE orthographic, BACK orthographic; FRONT THREE QUARTER, REAR THREE QUARTER, TOP. Head and small neck only, no shoulders or torso; whole antenna fully in frame with margin. Crisp realistic unweathered scale-model surfaces, visible fine panel seams and bevels, restrained soft studio lighting without bloom, no depth of field, no dramatic perspective. Prioritize plausible continuous 3D shapes across all six views. Hidden rear/top details are inferred rather than sourced. Clear small view labels. This is an accuracy-oriented modeling reference, not cinematic concept art.

## 检查与限制

已成功运行 Blender 建模、保存、GLB 导出和六角度渲染，并输出独立灰模。V6 收短后脑、收窄上部头盔并前移颈轴。V7 开始把主要部件的参考点直接用于生成网格：脸罩两侧及中脊的深度/高度由固定相机下的投影点求解，颊甲前缘也由成对点生成；被遮挡截面和厚度仍为推断。细线曲线也已转为可导出的真实网格。

仍未达到参考图一致性：额顶、眉骨到脸罩的过渡、散热口周围的大面及各部件前后关系还需校准。手工描线重合、投影定位点接近、闭合实体检查均不能替代真实灰模验收。不应直接视作完成的网页替换件。

V8 调整眼眶与眉骨。V9 将通风框前表面改为平面，增加 0.12 建模单位的独立凸出量，框壁深度改为 0.20，并将框后平滑贴壳过渡改为分段折面。凸出深度是根据参考图推断，仍需对照侧视及三分之四视图确认。

V10 保留主视图中的叶片尖端位置，将尖端向框体平面外突出量增至 0.09，后端延伸进入框壁，根部厚度为 0.032、尖端厚度为 0.008。几何检查同时验证叶片与框壁的实际网格相交，避免仅靠投影看似连接。

V11 将栅栏后方的贴壳曲面替换为上、中、下三组截面构成的闭合侧甲；前后缘采用主视图手工定位点，后缘深度仍为推断，记录在 `sideCasingRows`。移除旧曲面上的刻线和未重新定位的侧甲螺钉。此阶段仍在校准大面形状，未恢复这些细节。

V12 根据侧视射线检查，前移颊甲外缘并减少其抬高量，缩短穿过开口的前连接面。检查增加左右各两处固定侧视射线，确认这些位置能直接看到暗腔背板；这只验证局部遮挡，不代表整个通风口与参考一致。

V13 加深叶片内侧根部至框面内 0.25 建模单位，并将根部厚度增至 0.045；增加前端开口、其余方向封闭的暗色风道内衬，防止深腔暴露头盔内部结构。`vane_section_experiment.py` 可用于对 V12 保存文件重现加深根部的实验；实验输出位于 `teardown-out/vane-section-experiment/`，不覆盖正式模型。

V14 将脸罩中央平脊半宽从 0.01 改为 0.03，两条嘴部切口采用平顶折线并下移；两侧脸罩边界保持原定位。中央平脊与切口参数记录在 `faceMaskCenterHalfWidth` 和 `mouthSlots`。脸罩下缘增加真实的下巴缺口，避免中央白甲盖住红色下巴上沿；检查增加主视图方向的下巴可见性射线。

V15 将约束投影校准为 V14 实际主视图登记得到的固定比例与原点，消除此前约 2.5% 的比例差。主视图对照不再逐版重新拟合颜色质心。几何检查通过 Blender 相机投影独立验证近侧眼片四角和三片叶片尖端的位置；定位点吻合不代表可见表面或三维形状已经一致。

V16 降低额顶遮罩前缘，横梁及两侧短腿的后壁向上倾斜，保留顶面厚度；顶盖前段同步收低。镜头单独下移 0.018 建模单位，下方白色连接段随之缩短。主视图仍使用 V15 固定对齐。

V17 用眉骨末端、上缘、通风肩部及侧甲既有端点补齐眉骨后侧连接，封住会直接露出后方内壁的开口。增加三处主视图射线检查，要求命中新连接面；通风框凸出参数不变。

V18 将后连接面细分为 9×9 截面，四条边界保持原定位，内部沿主视图方向抬起，避免单个扭曲四边面形成深折角。抬起量 `rearTempleBulge=0.075` 属于推断参数；光照不变，仍需检查实际表面与参考的差距。

V19 加宽并延长红色额饰，单独调整下巴及底座的深度，校准主视图中偏左的红色下巴。下脸罩的两个推断中脊截面同步后收，避免下巴深陷在前伸的白甲后方。天线未移动；额饰可见宽度仍受根部遮挡影响，不能以单个边界指标认定完成。

几何检查：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background assets/freedom-head/freedom-head.blend --python scripts/blender/review_head.py
```

检查只证明主要装甲是有体积的闭合实体及模型数据有限，不证明造型一致。
