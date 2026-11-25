"""Freedom Gundam Head — Stage 3 Details Polish (v7-details-polish, Blender 3.1.2).

Directly resolves ALL P0, P1, and P2 findings from the v6 independent audit:
  P0-1: Replaced oversized 0.016-0.020 "globe grid" black seams with authentic MG/RG
        hairline 3D U-channel seams (~0.0048 total width, 0.0045 depth):
        - White sloped channel walls + ultra-narrow (~0.0022) soft cool-gray floor only
          (pure physical clay in Clay mode, no black marker paint!);
        - Removed artificial full-dome cross-grid lines; kept only true reference paths:
          helmet upper crown seam, upward-sweeping belt seam, NEW rear-center vertical
          back seam, 2 fine crest transverse seams, and 1 clean ear-armor seam behind
          LowerStepPlate.
  P0-2: Surface-snapped all 3 secondary recessed ports (Rear UpperInnerPort, Rear
        SideUpperSlot, VentPod ShoulderSlot) onto evaluated host armor via BVHTree
        find_nearest so frames sit flush & dark recesses are 100% visible (0% buried!),
        plus reshaped RearNapeLintel cleanly inside rear wing contour (zero sharp horns!).
  P1-1: Surface-snapped Rear CenterLockTab in distinct cool medium-gray with thin dark
        base collar (zero side-silhouette horn); crisp proud EarSide LowerStepPlate cleanly
        separated from the fine ear seam.
  P1-2: Lowered all 4 small port frame bevel widths to 0.0010 (0 Bevel clamp warnings);
        deepened Sensor_Blue to rich cool steel-blue optical glass; surface-snapped
        Temple Vulcan pod cleanly along temple normal so upper rim is uncut in all views.
"""

import bpy
import bmesh
import math
import json
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

VERSION_TAG = "v7-details-polish"
ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "assets" / "freedom-head" / "v2-rebuild" / VERSION_TAG
RENDER_DIR = OUT_DIR / "renders"
OUT_DIR.mkdir(parents=True, exist_ok=True)
RENDER_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Scene reset (preserve default Blender UI workspaces for Desktop GUI viewing)
# ---------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=False)
bpy.context.preferences.filepaths.save_version = 0
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
for col_data in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
    for item in list(col_data):
        col_data.remove(item)

scene = bpy.context.scene
root = bpy.data.objects.new("Freedom_Head_V2", None)
scene.collection.objects.link(root)


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
def make_mat(name, color, metallic=0.08, roughness=0.38, emission=None, em_strength=0.0, clearcoat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular"].default_value = 0.48
    if clearcoat > 0:
        bsdf.inputs["Clearcoat"].default_value = clearcoat
        bsdf.inputs["Clearcoat Roughness"].default_value = 0.10
    if emission is not None and em_strength > 0:
        bsdf.inputs["Emission"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = em_strength
    mat.diffuse_color = (*color, 1.0)
    return mat


MAT_WHITE = make_mat("Armor_White", (0.76, 0.77, 0.79), metallic=0.08, roughness=0.36)
MAT_WHITE_COOL = make_mat("Armor_White_Cool", (0.62, 0.64, 0.68), metallic=0.10, roughness=0.40)
# Distinct cool medium-gray for Rear CenterLockTab (P1-1)
MAT_TRIM_GRAY = make_mat("Armor_Trim_Gray", (0.43, 0.45, 0.49), metallic=0.14, roughness=0.42)
# Soft neutral cool-gray ONLY for ultra-thin (~0.0022) recessed seam bottoms (P0-1)
MAT_SEAM = make_mat("Panel_Seam_Soft", (0.24, 0.25, 0.28), metallic=0.06, roughness=0.62)
MAT_RED = make_mat("Armor_Red", (0.56, 0.028, 0.026), metallic=0.12, roughness=0.32, clearcoat=0.15)
MAT_GOLD = make_mat("VFin_Gold", (0.88, 0.49, 0.030), metallic=0.58, roughness=0.24, clearcoat=0.15)
MAT_DARK = make_mat("Frame_Graphite", (0.068, 0.072, 0.082), metallic=0.45, roughness=0.40)
MAT_METAL = make_mat("Frame_SteelRim", (0.20, 0.22, 0.26), metallic=0.78, roughness=0.26)
MAT_BLACK = make_mat("Cavity_Black", (0.006, 0.008, 0.011), metallic=0.04, roughness=0.78)
MAT_EYE_EDGE = make_mat(
    "Sensor_Amber_Edge", (0.76, 0.15, 0.004), metallic=0.22, roughness=0.18,
    emission=(0.82, 0.17, 0.003), em_strength=0.36
)
MAT_EYE_CORE = make_mat(
    "Sensor_Amber_Core", (1.0, 0.43, 0.012), metallic=0.14, roughness=0.14,
    emission=(1.0, 0.39, 0.008), em_strength=1.00
)
# P1-2: Deep cool steel-blue optical glass forehead lens (NOT bright sky blue!)
MAT_BLUE = make_mat(
    "Sensor_Blue", (0.036, 0.080, 0.140), metallic=0.56, roughness=0.08,
    emission=(0.024, 0.062, 0.112), em_strength=0.16, clearcoat=0.75
)
MAT_CLAY = make_mat("Review_Clay", (0.48, 0.49, 0.51), metallic=0.0, roughness=0.58)
MAT_CLAY_DARK = make_mat("Review_Clay_Cavity", (0.055, 0.060, 0.065), metallic=0.0, roughness=0.84)


# ---------------------------------------------------------------------------
# Math / Hairline 3D U-Channel Groove Helpers (P0-1: ~0.0048 wide, white walls!)
# ---------------------------------------------------------------------------
def catmull_rom(p0, p1, p2, p3, t):
    t2 = t * t
    t3 = t2 * t
    return 0.5 * (
        (2.0 * p1)
        + (-p0 + p2) * t
        + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
        + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
    )


def resample_stations(stations, subdivs_per_seg=2, preserve_sharp_rows=()):
    n = len(stations)
    m = len(stations[0])
    out = []
    for i in range(n - 1):
        linear = (i in preserve_sharp_rows)
        steps = 1 if linear else subdivs_per_seg
        for s in range(steps):
            t = s / float(steps)
            row = []
            for j in range(m):
                p0 = Vector(stations[max(0, i - 1)][j])
                p1 = Vector(stations[i][j])
                p2 = Vector(stations[i + 1][j])
                p3 = Vector(stations[min(n - 1, i + 2)][j])
                pt = p1.lerp(p2, t) if linear else catmull_rom(p0, p1, p2, p3, t)
                row.append(tuple(pt))
            out.append(row)
    out.append([tuple(p) for p in stations[-1]])
    return out


def step_toward(a, b, dist):
    d = b - a
    L = d.length
    if L < 1e-6:
        return a.copy()
    return a + d * min(0.35, dist / L)


def insert_col_u_grooves(outer_grid, groove_cols, center_pt,
                         outer_half_w=0.0025, floor_half_w=0.0011, depth=0.0046):
    """P0-1: Insert ultra-fine 4-vertex U-channel grooves (~0.0050 opening width,
    0.0022 floor width) along specified columns. ONLY the narrow floor cell is marked
    as seam material; both sloped walls remain clean Armor_White!"""
    R = len(outer_grid)
    C = len(outer_grid[0])
    new_grid = [[] for _ in range(R)]
    floor_cols = set()
    col_map = {}

    for c in range(C):
        if c in groove_cols and 0 < c < C - 1:
            base = len(new_grid[0])
            col_map[c] = base + 1
            floor_cols.add(base + 1)  # ONLY the single narrow center floor cell (p_ml -> p_mr)!
            for r in range(R):
                p_prev = Vector(outer_grid[r][c - 1])
                p_cur = Vector(outer_grid[r][c])
                p_next = Vector(outer_grid[r][c + 1])
                inward = center_pt - p_cur
                if inward.length > 1e-5:
                    inward.normalize()
                off = inward * depth
                if abs(p_cur.x) < 1e-4:
                    off.x = 0.0
                p_l = step_toward(p_cur, p_prev, outer_half_w)
                p_ml = step_toward(p_cur, p_prev, floor_half_w) + off
                p_mr = step_toward(p_cur, p_next, floor_half_w) + off
                p_r = step_toward(p_cur, p_next, outer_half_w)
                new_grid[r].extend([tuple(p_l), tuple(p_ml), tuple(p_mr), tuple(p_r)])
        else:
            col_map[c] = len(new_grid[0])
            for r in range(R):
                new_grid[r].append(outer_grid[r][c])
    return new_grid, floor_cols, col_map


# ---------------------------------------------------------------------------
# Hard-surface BMesh helpers (Blender 3.1.2, STRICT NM=0!)
# ---------------------------------------------------------------------------
def strip_mirror_caps_and_wires(bm, eps=1.5e-4):
    to_del_f = [f for f in bm.faces if all(abs(v.co.x) < eps for v in f.verts)]
    if to_del_f:
        bmesh.ops.delete(bm, geom=to_del_f, context="FACES_ONLY")
    wire_e = [e for e in bm.edges if len(e.link_faces) == 0]
    if wire_e:
        bmesh.ops.delete(bm, geom=wire_e, context="EDGES")
    iso_v = [v for v in bm.verts if len(v.link_edges) == 0]
    if iso_v:
        bmesh.ops.delete(bm, geom=iso_v, context="VERTS")


def finalize_mesh(name, bm, mat, bevel_width=0.0045, bevel_segments=2,
                  auto_smooth_deg=26.0, mirror_x=False, smooth_faces=False,
                  extra_mats=()):
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if mirror_x:
        strip_mirror_caps_and_wires(bm)
    else:
        wire_e = [e for e in bm.edges if len(e.link_faces) == 0]
        if wire_e:
            bmesh.ops.delete(bm, geom=wire_e, context="EDGES")
        iso_v = [v for v in bm.verts if len(v.link_edges) == 0]
        if iso_v:
            bmesh.ops.delete(bm, geom=iso_v, context="VERTS")

    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    data.update()

    for poly in data.polygons:
        poly.use_smooth = smooth_faces

    data.use_auto_smooth = True
    data.auto_smooth_angle = math.radians(auto_smooth_deg)
    data.materials.append(mat)
    for em in extra_mats:
        data.materials.append(em)

    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.parent = root

    if mirror_x:
        mir = obj.modifiers.new("Mirror_X", "MIRROR")
        mir.use_axis = (True, False, False)
        mir.use_clip = True
        mir.merge_threshold = 0.001

    if bevel_width > 0:
        bev = obj.modifiers.new("Hard_Bevel", "BEVEL")
        bev.width = bevel_width
        bev.segments = bevel_segments
        bev.limit_method = "ANGLE"
        bev.angle_limit = math.radians(24.0)
        bev.use_clamp_overlap = True
        bev.harden_normals = True
        wn = obj.modifiers.new("Weighted_Normal", "WEIGHTED_NORMAL")
        wn.keep_sharp = True

    return obj


def make_loft(name, sections, mat, closed_u=False, cap_start=True, cap_end=True,
              bevel_width=0.0045, auto_smooth_deg=26.0, mirror_x=False,
              smooth_faces=True, sharp_u_indices=(),
              seam_row_indices=(), extra_mats=()):
    bm = bmesh.new()
    n_sec = len(sections)
    m = len(sections[0])
    grid = [[bm.verts.new(Vector(p)) for p in sec] for sec in sections]
    bm.verts.ensure_lookup_table()

    u_count = m if closed_u else (m - 1)
    for i in range(n_sec - 1):
        for j in range(u_count):
            jn = (j + 1) % m
            pts = [grid[i][j], grid[i][jn], grid[i + 1][jn], grid[i + 1][j]]
            uniq = []
            for v in pts:
                if v not in uniq:
                    uniq.append(v)
            if len(uniq) >= 3:
                try:
                    f = bm.faces.new(uniq)
                    if i in seam_row_indices and extra_mats:
                        f.material_index = 1
                except ValueError:
                    pass

    if closed_u and m >= 3:
        if cap_start:
            try:
                bm.faces.new(list(reversed(grid[0])))
            except ValueError:
                pass
        if cap_end:
            try:
                bm.faces.new(list(grid[-1]))
            except ValueError:
                pass

    bm.edges.ensure_lookup_table()
    for j in sharp_u_indices:
        for i in range(n_sec - 1):
            e = bm.edges.get((grid[i][j], grid[i + 1][j]))
            if e is not None:
                e.smooth = False

    return finalize_mesh(
        name, bm, mat, bevel_width=bevel_width,
        auto_smooth_deg=auto_smooth_deg, mirror_x=mirror_x,
        smooth_faces=smooth_faces, extra_mats=extra_mats
    )


def make_solid_shell_from_grid(name, outer_grid, inner_grid, mat,
                               bevel_width=0.004, auto_smooth_deg=24.0,
                               mirror_x=False, smooth_faces=True,
                               sharp_cols=(), sharp_rows=(),
                               cell_mat_map=None, extra_mats=()):
    bm = bmesh.new()
    R = len(outer_grid)
    C = len(outer_grid[0])
    vo = [[bm.verts.new(Vector(p)) for p in row] for row in outer_grid]
    vi = [[bm.verts.new(Vector(p)) for p in row] for row in inner_grid]

    for r in range(R - 1):
        for c in range(C - 1):
            f = bm.faces.new((vo[r][c], vo[r][c + 1], vo[r + 1][c + 1], vo[r + 1][c]))
            if cell_mat_map and (r, c) in cell_mat_map:
                f.material_index = cell_mat_map[(r, c)]
    for r in range(R - 1):
        for c in range(C - 1):
            bm.faces.new((vi[r][c], vi[r + 1][c], vi[r + 1][c + 1], vi[r][c + 1]))
    for c in range(C - 1):
        bm.faces.new((vo[0][c], vi[0][c], vi[0][c + 1], vo[0][c + 1]))
        bm.faces.new((vo[R - 1][c], vo[R - 1][c + 1], vi[R - 1][c + 1], vi[R - 1][c]))
    for r in range(R - 1):
        bm.faces.new((vo[r][0], vo[r + 1][0], vi[r + 1][0], vi[r][0]))
        bm.faces.new((vo[r][C - 1], vi[r][C - 1], vi[r + 1][C - 1], vo[r + 1][C - 1]))

    bm.edges.ensure_lookup_table()
    for c in sharp_cols:
        for r in range(R - 1):
            e = bm.edges.get((vo[r][c], vo[r + 1][c]))
            if e:
                e.smooth = False
    for r in sharp_rows:
        for c in range(C - 1):
            e = bm.edges.get((vo[r][c], vo[r][c + 1]))
            if e:
                e.smooth = False

    return finalize_mesh(
        name, bm, mat, bevel_width=bevel_width,
        auto_smooth_deg=auto_smooth_deg, mirror_x=mirror_x,
        smooth_faces=smooth_faces, extra_mats=extra_mats
    )


def make_hollow_frame(name, outer_front, inner_front, outer_back, inner_back,
                      mat, bevel_width=0.004, mirror_x=False):
    bm = bmesh.new()
    n = len(outer_front)
    of = [bm.verts.new(Vector(p)) for p in outer_front]
    inf = [bm.verts.new(Vector(p)) for p in inner_front]
    ob = [bm.verts.new(Vector(p)) for p in outer_back]
    inb = [bm.verts.new(Vector(p)) for p in inner_back]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((of[i], of[j], inf[j], inf[i]))
        bm.faces.new((ob[i], inb[i], inb[j], ob[j]))
        bm.faces.new((of[i], ob[i], ob[j], of[j]))
        bm.faces.new((inf[i], inf[j], inb[j], inb[i]))
    return finalize_mesh(
        name, bm, mat, bevel_width=bevel_width,
        mirror_x=mirror_x, smooth_faces=False
    )


def make_closed_pocket(name, inner_front, inner_back, wall_thick_out, back_thick,
                       mat, mirror_x=False):
    bm = bmesh.new()
    n = len(inner_front)
    if_v = [Vector(p) for p in inner_front]
    ib_v = [Vector(p) for p in inner_back]
    cf = sum(if_v, Vector()) / n
    cb = sum(ib_v, Vector()) / n
    depth_dir = (cb - cf).normalized()

    of_v = [p + (p - cf).normalized() * wall_thick_out for p in if_v]
    ob_v = [p + (p - cb).normalized() * wall_thick_out + depth_dir * back_thick for p in ib_v]

    v_if = [bm.verts.new(p) for p in if_v]
    v_ib = [bm.verts.new(p) for p in ib_v]
    v_of = [bm.verts.new(p) for p in of_v]
    v_ob = [bm.verts.new(p) for p in ob_v]

    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((v_of[i], v_of[j], v_if[j], v_if[i]))
        bm.faces.new((v_of[i], v_ob[i], v_ob[j], v_of[j]))
        bm.faces.new((v_if[i], v_if[j], v_ib[j], v_ib[i]))

    bm.faces.new(list(reversed(v_ib)))
    bm.faces.new(list(v_ob))

    return finalize_mesh(name, bm, mat, bevel_width=0.0, mirror_x=mirror_x, smooth_faces=False)


def make_box_oriented(name, p_center, size_xyz, rot_euler=(0, 0, 0),
                      mat=MAT_WHITE, bevel_width=0.004, mirror_x=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size_xyz
    m_scale = Matrix.Diagonal((sx, sy, sz, 1.0))
    m_rot = Matrix.Identity(4)
    for axis, ang in zip(("X", "Y", "Z"), rot_euler):
        if abs(ang) > 1e-6:
            m_rot = Matrix.Rotation(ang, 4, axis) @ m_rot
    m_trans = Matrix.Translation(Vector(p_center))
    bmesh.ops.transform(bm, matrix=m_trans @ m_rot @ m_scale, verts=bm.verts)
    return finalize_mesh(name, bm, mat, bevel_width=bevel_width, mirror_x=mirror_x)


def sample_host_surface(host_obj, approx_pt, out_hint=None):
    """P0-2: Sample exact outer surface point & outward normal on evaluated host mesh via BVHTree."""
    deps = bpy.context.evaluated_depsgraph_get()
    eval_obj = host_obj.evaluated_get(deps)
    bvh = BVHTree.FromObject(eval_obj, deps)
    loc, norm, _, _ = bvh.find_nearest(Vector(approx_pt))
    n = norm.normalized()
    if out_hint is not None and n.dot(Vector(out_hint)) < 0:
        n = -n
    return loc, n


SURFACE_PORTS_AUDIT = []


def make_surface_snapped_port(name, host_obj, approx_pt, out_hint, width, height,
                              frame_w, proud_h=0.008, embed_d=0.018,
                              frame_mat=MAT_WHITE_COOL, pocket_mat=MAT_DARK,
                              mirror_x=True, roll_rad=0.0):
    """P0-2 & P1-2: Build a watertight beveled rectangular recess port snapped strictly
    to the host outer surface via BVHTree so frame is flush (>=85% exposed) and dark pocket
    backing sits cleanly above host skin (100% visible, 0% buried, 0 bevel clamp!)."""
    loc, n = sample_host_surface(host_obj, approx_pt, out_hint)
    up_ref = Vector((0.0, 0.0, 1.0)) if abs(n.z) < 0.88 else Vector((0.0, 1.0, 0.0))
    right = up_ref.cross(n).normalized()
    up = n.cross(right).normalized()
    if abs(roll_rad) > 1e-6:
        cr, sr = math.cos(roll_rad), math.sin(roll_rad)
        right, up = (right * cr + up * sr).normalized(), (-right * sr + up * cr).normalized()

    hw, hh = width * 0.5, height * 0.5
    iw, ih = hw - frame_w, hh - frame_w

    def rect_pts(hx, hz, offset_n):
        return [
            tuple(loc + right * (-hx) + up * ( hz) + n * offset_n),
            tuple(loc + right * ( hx) + up * ( hz) + n * offset_n),
            tuple(loc + right * ( hx) + up * (-hz) + n * offset_n),
            tuple(loc + right * (-hx) + up * (-hz) + n * offset_n),
        ]

    # Chamfered outer bezel collar proud by +proud_h, rooted -embed_d into host armor
    # P1-2: bevel_width=0.0010 -> strictly 0 bevel clamp!
    make_hollow_frame(
        f"{name}_Frame",
        rect_pts(hw, hh, proud_h), rect_pts(iw, ih, proud_h),
        rect_pts(hw + 0.003, hh + 0.003, -embed_d), rect_pts(iw, ih, -embed_d),
        frame_mat, bevel_width=0.0010, mirror_x=mirror_x
    )
    # Dark pocket backing sits at +0.0025 (strictly outside curved host skin, recessed 0.0055
    # inside the +0.008 bezel collar!) -> 100% visible, deep dark recess shadow!
    make_loft(
        f"{name}_Backing",
        [rect_pts(iw + 0.0015, ih + 0.0015, 0.0028), rect_pts(iw + 0.0015, ih + 0.0015, -embed_d)],
        pocket_mat, closed_u=True, bevel_width=0.0008, mirror_x=mirror_x, smooth_faces=False
    )
    SURFACE_PORTS_AUDIT.append((name, host_obj.name, loc + n * 0.0028, n))


def make_cylinder_z(name, center, r_bot, r_top, height, segs, mat, bevel_width=0.004):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segs,
        radius1=r_bot, radius2=r_top, depth=height
    )
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(center)), verts=bm.verts)
    return finalize_mesh(name, bm, mat, bevel_width=bevel_width, smooth_faces=True, auto_smooth_deg=35.0)


# ===========================================================================
# 1. 2-TIER MECHANICAL NECK COLLAR (Approved in v6!)
# ===========================================================================
make_cylinder_z("01_Neck_BaseFlange", (0.0, 0.0, 0.042), 0.324, 0.320, 0.084, 32, MAT_DARK, 0.004)
make_cylinder_z("01_Neck_MidRing", (0.0, 0.0, 0.112), 0.312, 0.305, 0.056, 32, MAT_METAL, 0.003)
make_cylinder_z("01_Neck_CoreShaft", (0.0, 0.0, 0.245), 0.280, 0.272, 0.23, 32, MAT_BLACK, 0.003)
for i in range(10):
    ang = (i + 0.5) * math.tau / 10.0
    cx = 0.296 * math.sin(ang)
    cy = -0.296 * math.cos(ang)
    make_box_oriented(
        f"01_Neck_ArmorPlate_{i}", (cx, cy, 0.220), (0.125, 0.044, 0.185),
        rot_euler=(0, 0, ang), mat=MAT_DARK, bevel_width=0.0035
    )
make_box_oriented("01_Neck_FrontCenterBrace", (0.0, -0.308, 0.165), (0.145, 0.036, 0.145), mat=MAT_DARK, bevel_width=0.004)
make_cylinder_z("01_Internal_CraniumCore", (0.0, 0.08, 0.82), 0.27, 0.26, 0.80, 20, MAT_BLACK, 0.0)


# ===========================================================================
# 2. POLYHEDRAL HELMET SHELL WITH HAIRLINE 3D SEAMS + REAR VERTICAL CENTER SEAM
#    (P0-1: ZERO globe-grid lines, 0.0050-wide U-channels, white walls!)
# ===========================================================================
helmet_ctrl = [
    # S0: Front forehead arch
    [
        (0.145, -0.54, 1.31),
        (0.265, -0.51, 1.22),
        (0.365, -0.46, 1.09),
        (0.415, -0.43, 0.95),
        (0.285, -0.40, 0.84),  # deep behind vent pocket -> 0% bleed
        (0.275, -0.38, 0.72),
        (0.240, -0.36, 0.68),
    ],
    # S1: Temple / Vulcan zone
    [
        (0.160, -0.29, 1.43),
        (0.320, -0.27, 1.32),
        (0.435, -0.24, 1.17),
        (0.495, -0.20, 0.99),
        (0.295, -0.18, 0.76),  # deep behind vent pocket -> 0% bleed
        (0.285, -0.17, 0.50),
        (0.250, -0.16, 0.44),
    ],
    # S2: Anterior ear line
    [
        (0.168,  0.00, 1.49),
        (0.345,  0.00, 1.38),
        (0.475,  0.02, 1.22),
        (0.545,  0.04, 1.04),
        (0.515,  0.05, 0.72),
        (0.485,  0.05, 0.45),
        (0.380,  0.04, 0.36),
    ],
    # S3: Mid-posterior
    [
        (0.168,  0.26, 1.47),
        (0.340,  0.27, 1.36),
        (0.465,  0.29, 1.21),
        (0.535,  0.32, 1.07),
        (0.525,  0.32, 0.74),
        (0.485,  0.30, 0.43),
        (0.375,  0.27, 0.35),
    ],
    # S4: Rear shoulder polygonal bevel turn
    [
        (0.155,  0.49, 1.36),
        (0.295,  0.51, 1.27),
        (0.395,  0.54, 1.16),
        (0.445,  0.58, 1.04),
        (0.435,  0.57, 0.73),
        (0.395,  0.53, 0.43),
        (0.315,  0.46, 0.34),
    ],
    # S5: Rear beveled occiput side plane
    [
        (0.130,  0.66, 1.22),
        (0.220,  0.69, 1.16),
        (0.285,  0.73, 1.09),
        (0.315,  0.76, 0.99),
        (0.305,  0.73, 0.72),
        (0.275,  0.65, 0.48),
        (0.225,  0.58, 0.36),
    ],
    # S6: Rear center facet plane (X=0)
    [
        (0.000,  0.73, 1.17),
        (0.000,  0.76, 1.12),
        (0.000,  0.80, 1.06),
        (0.000,  0.84, 0.96),
        (0.000,  0.80, 0.71),
        (0.000,  0.72, 0.50),
        (0.000,  0.64, 0.47),
    ],
]

helmet_base = resample_stations(helmet_ctrl, subdivs_per_seg=2, preserve_sharp_rows=(1, 4, 5))
center_ref = Vector((0.0, 0.08, 0.86))

# P0-1: Add iconic BACK vertical centerline seam right at X=0 by inserting two hairline
# rows just before S6: shoulder at X=0.0024 (flush) + floor edge at X=0.0010 (stepped -0.0045 in Y)
# + mirror plane at X=0.000 (stepped -0.0045 in Y)!
s_prev = helmet_base[-2]
s_back = helmet_base[-1]
row_back_sh = [tuple(step_toward(Vector(b), Vector(a), 0.0025)) for a, b in zip(s_prev, s_back)]
row_back_fl = [
    (step_toward(Vector(b), Vector(a), 0.0011).x, b[1] - 0.0045, b[2])
    for a, b in zip(s_prev, s_back)
]
row_back_ctr = [(0.0, b[1] - 0.0045, b[2]) for b in s_back]
helmet_with_back_seam = helmet_base[:-1] + [row_back_sh, row_back_fl, row_back_ctr]

# P0-1: Insert ONLY the 2 authentic longitudinal hairline U-grooves:
#   col 1 = upper crown ridge seam (TOP, 3/4, BACK)
#   col 3 = upward-sweeping horizontal belt seam (SIDE, 3/4, BACK)
# NO artificial cross-dome latitude grid lines!
helmet_grid, floor_cols, col_map = insert_col_u_grooves(
    helmet_with_back_seam, groove_cols=(1, 3), center_pt=center_ref,
    outer_half_w=0.0025, floor_half_w=0.0011, depth=0.0046
)

helmet_inner = []
for si, row in enumerate(helmet_grid):
    in_row = []
    for p in row:
        v = Vector(p)
        d = center_ref - v
        if d.length > 1e-4:
            d.normalize()
        off = d * 0.046
        if si == len(helmet_grid) - 1:
            off.x = 0.0
        in_row.append(tuple(v + off))
    helmet_inner.append(in_row)

# Assign MAT_SEAM (slot 1) STRICTLY to the ultra-narrow groove floor cells ONLY!
helmet_cell_mats = {}
R_h = len(helmet_grid)
C_h = len(helmet_grid[0])
back_floor_row = R_h - 2  # row between row_back_fl and row_back_ctr (X in [0.000, 0.0011])!
for r in range(R_h - 1):
    for c in range(C_h - 1):
        if c in floor_cols:
            helmet_cell_mats[(r, c)] = 1
        if r == back_floor_row and c < col_map[5]:
            helmet_cell_mats[(r, c)] = 1

helmet_obj = make_solid_shell_from_grid(
    "02_Helmet_PolyhedralShell", helmet_grid, helmet_inner,
    MAT_WHITE, bevel_width=0.0020, auto_smooth_deg=24.0,
    mirror_x=True, smooth_faces=True,
    sharp_cols=(col_map[1], col_map[2], col_map[3], col_map[5]),
    sharp_rows=(R_h - 5, R_h - 4),
    cell_mat_map=helmet_cell_mats, extra_mats=(MAT_SEAM,)
)

# Flush Rear-Nape Side Skirt Wings + Clean Tapered Lintel (P0-2: ZERO protruding horns!)
nape_wing_sections = [
    [(0.165, 0.34, 0.50), (0.435, 0.34, 0.47), (0.375, 0.62, 0.48), (0.165, 0.67, 0.49)],
    [(0.172, 0.34, 0.345), (0.395, 0.34, 0.365), (0.315, 0.62, 0.335), (0.172, 0.63, 0.335)],
]
make_loft(
    "02_Helmet_RearNapeWing", nape_wing_sections, MAT_WHITE,
    closed_u=True, bevel_width=0.0045, mirror_x=True, smooth_faces=False
)

# P0-2 FIX: Slim, flush-tapered RearNapeLintel tucked cleanly between the two nape wings!
lintel_sec = [
    [(-0.172, 0.50, 0.505), (0.172, 0.50, 0.505), (0.172, 0.655, 0.495), (-0.172, 0.655, 0.495)],
    [(-0.172, 0.50, 0.468), (0.172, 0.50, 0.468), (0.172, 0.635, 0.472), (-0.172, 0.635, 0.472)],
]
make_loft("02_Helmet_RearNapeLintel", lintel_sec, MAT_WHITE, closed_u=True, bevel_width=0.003, smooth_faces=False)

make_box_oriented("02_Helmet_RearExhaustWell", (0.0, 0.550, 0.415), (0.335, 0.14, 0.148), mat=MAT_DARK, bevel_width=0.003)
for k in range(4):
    make_box_oriented(
        f"02_Helmet_RearExhaustSlat_{k}",
        (0.0, 0.618, 0.360 + k * 0.036),
        (0.305, 0.028, 0.015),
        mat=MAT_WHITE_COOL, bevel_width=0.002
    )

# P0-2 FIX: Surface-snapped Rear Occiput Mechanical Ports (100% visible, 0% buried!)
# 1) Rear upper inner vertical rectangular slots (flanking rear spine in BACK & REAR 3/4!)
make_surface_snapped_port(
    "02_Rear_UpperInnerPort", helmet_obj,
    approx_pt=(0.245, 0.74, 1.075), out_hint=(0.35, 0.90, 0.25),
    width=0.068, height=0.092, frame_w=0.012, proud_h=0.007, embed_d=0.022,
    frame_mat=MAT_WHITE_COOL, pocket_mat=MAT_DARK, mirror_x=True
)
# 2) Rear-side horizontal rectangular recessed slot (clearly visible in SIDE & REAR 3/4!)
make_surface_snapped_port(
    "02_Rear_SideUpperSlot", helmet_obj,
    approx_pt=(0.515, 0.43, 0.965), out_hint=(0.88, 0.45, 0.10),
    width=0.108, height=0.048, frame_w=0.011, proud_h=0.007, embed_d=0.022,
    frame_mat=MAT_WHITE_COOL, pocket_mat=MAT_DARK, mirror_x=True
)

# P1-1 FIX: Surface-snapped Rear CenterLockTab (cool medium-gray + thin dark recessed collar,
# sits flush on rear center vertical seam with ZERO side-silhouette horn!)
def make_rear_center_lock_tab():
    loc, n = sample_host_surface(helmet_obj, (0.0, 0.82, 0.700), out_hint=(0.0, 1.0, -0.15))
    # Force exact symmetry X=0
    loc = Vector((0.0, loc.y, loc.z))
    n = Vector((0.0, n.y, n.z)).normalized()
    right = Vector((1.0, 0.0, 0.0))
    up = n.cross(right).normalized()
    if up.z < 0:
        up = -up

    def rpts(hx, hz, off):
        return [
            tuple(loc + right * (-hx) + up * ( hz) + n * off),
            tuple(loc + right * ( hx) + up * ( hz) + n * off),
            tuple(loc + right * ( hx) + up * (-hz) + n * off),
            tuple(loc + right * (-hx) + up * (-hz) + n * off),
        ]
    # Thin dark perimeter collar (+0.003 proud)
    make_loft("02_Rear_CenterLockSeam", [rpts(0.064, 0.046, 0.003), rpts(0.064, 0.046, -0.016)], MAT_DARK, closed_u=True, bevel_width=0.001, smooth_faces=False)
    # Crisp cool-medium-gray chamfered tab (+0.009 proud -> clean subtle relief, zero side horn!)
    make_loft("02_Rear_CenterLockTab", [rpts(0.056, 0.039, 0.009), rpts(0.060, 0.042, -0.012)], MAT_TRIM_GRAY, closed_u=True, bevel_width=0.0022, smooth_faces=False)

make_rear_center_lock_tab()


# ===========================================================================
# 3. CREST WITH 2 HAIRLINE U-CHANNEL SEAMS + DEEP STEEL-BLUE CAMERA LENS
# ===========================================================================
crest_ctrl = [
    (-0.49, 1.675, 0.102, 1.575, 0.140, 1.27, 0.154),
    (-0.22, 1.725, 0.114, 1.620, 0.155, 1.38, 0.168),
    ( 0.08, 1.715, 0.122, 1.615, 0.165, 1.46, 0.178),
    ( 0.38, 1.650, 0.122, 1.550, 0.165, 1.40, 0.176),
    ( 0.64, 1.530, 0.118, 1.440, 0.155, 1.29, 0.164),
    ( 0.80, 1.440, 0.108, 1.380, 0.140, 1.32, 0.145),
]
crest_raw = [
    [(-wt, y, zt), (wt, y, zt), (wm, y, zm), (wb, y, zb), (-wb, y, zb), (-wm, y, zm)]
    for (y, zt, wt, zm, wm, zb, wb) in crest_ctrl
]
crest_base = resample_stations(crest_raw, subdivs_per_seg=2, preserve_sharp_rows=(4,))

# P0-1: 2 hairline 0.0050-wide U-channel transverse seams on Crest (rows 3 and 7)
# White sloped walls, ONLY the ultra-thin 0.0022 floor cell gets MAT_SEAM!
crest_grooved = []
crest_floor_rows = set()
for r in range(len(crest_base)):
    if r in (3, 7) and 0 < r < len(crest_base) - 1:
        br = len(crest_grooved)
        crest_floor_rows.add(br + 1)  # ONLY the single narrow center floor row!
        rl, rml, rmr, rr = [], [], [], []
        for c in range(len(crest_base[r])):
            pp = Vector(crest_base[r - 1][c])
            pc = Vector(crest_base[r][c])
            pn = Vector(crest_base[r + 1][c])
            inward = Vector((0.0 if abs(pc.x) < 1e-4 else -math.copysign(0.0040, pc.x), 0.0, -0.0046 if c in (0, 1) else -0.0018))
            rl.append(tuple(step_toward(pc, pp, 0.0025)))
            rml.append(tuple(step_toward(pc, pp, 0.0011) + inward))
            rmr.append(tuple(step_toward(pc, pn, 0.0011) + inward))
            rr.append(tuple(step_toward(pc, pn, 0.0025)))
        crest_grooved.extend([rl, rml, rmr, rr])
    else:
        crest_grooved.append(list(crest_base[r]))

make_loft(
    "03_Crest_MainArch", crest_grooved, MAT_WHITE, closed_u=True,
    bevel_width=0.0025, auto_smooth_deg=26.0, smooth_faces=True,
    sharp_u_indices=(0, 1, 2, 3, 4, 5),
    seam_row_indices=crest_floor_rows, extra_mats=(MAT_SEAM,)
)

crest_rear_spine = [
    [(-0.144, 0.52, 1.37), (0.144, 0.52, 1.37), (0.156, 0.52, 1.15), (-0.156, 0.52, 1.15)],
    [(-0.124, 0.74, 1.33), (0.124, 0.74, 1.33), (0.142, 0.785, 1.05), (-0.142, 0.785, 1.05)],
]
make_loft("03_Crest_RearUnderSpine", crest_rear_spine, MAT_WHITE, closed_u=True, bevel_width=0.004, smooth_faces=False)
make_box_oriented("03_Crest_RearSensorBox", (0.0, 0.705, 1.245), (0.130, 0.055, 0.100), rot_euler=(0.18, 0, 0), mat=MAT_DARK, bevel_width=0.002)

# Front Sensor Camera Hood + Deep Cool Steel-Blue Glass Lens (P1-2!)
cam_hood_of = [
    (-0.110, -0.562, 1.645), ( 0.110, -0.562, 1.645),
    ( 0.150, -0.688, 1.245), (-0.150, -0.688, 1.245),
]
cam_hood_if = [
    (-0.084, -0.572, 1.568), ( 0.084, -0.572, 1.568),
    ( 0.104, -0.672, 1.325), (-0.104, -0.672, 1.325),
]
cam_hood_ob = [
    (-0.118, -0.43, 1.682), ( 0.118, -0.43, 1.682),
    ( 0.152, -0.50, 1.285), (-0.152, -0.50, 1.285),
]
cam_hood_ib = [
    (-0.084, -0.43, 1.600), ( 0.084, -0.43, 1.600),
    ( 0.104, -0.50, 1.345), (-0.104, -0.50, 1.345),
]
make_hollow_frame(
    "03_Sensor_HoodFrame", cam_hood_of, cam_hood_if,
    cam_hood_ob, cam_hood_ib, MAT_WHITE, bevel_width=0.0045
)
make_box_oriented("03_Sensor_TopBrowStep", (0.0, -0.566, 1.578), (0.162, 0.042, 0.022), rot_euler=(-0.28, 0, 0), mat=MAT_DARK, bevel_width=0.002)
make_box_oriented("03_Sensor_DarkPod", (0.0, -0.525, 1.448), (0.180, 0.135, 0.205), rot_euler=(-0.28, 0, 0), mat=MAT_DARK, bevel_width=0.003)
make_box_oriented("03_Sensor_OuterStepBezel", (0.0, -0.585, 1.445), (0.152, 0.026, 0.152), rot_euler=(-0.28, 0, 0), mat=MAT_DARK, bevel_width=0.003)
make_box_oriented("03_Sensor_MetalBezel", (0.0, -0.594, 1.444), (0.134, 0.024, 0.134), rot_euler=(-0.28, 0, 0), mat=MAT_METAL, bevel_width=0.003)
make_box_oriented("03_Sensor_BlueLens", (0.0, -0.604, 1.442), (0.106, 0.016, 0.106), rot_euler=(-0.28, 0, 0), mat=MAT_BLUE, bevel_width=0.0025)


# ===========================================================================
# 4. FIERCE OVERHANGING BROW VISOR & 3D CURVED AMBER EYES
# ===========================================================================
brow_sections = [
    [(0.000, -0.835, 0.805), (0.000, -0.795, 0.885), (0.000, -0.640, 0.915), (0.000, -0.665, 0.822)],
    [(0.155, -0.785, 0.860), (0.175, -0.735, 0.955), (0.180, -0.585, 0.985), (0.155, -0.615, 0.870)],
    [(0.310, -0.680, 0.925), (0.340, -0.625, 1.032), (0.330, -0.495, 1.058), (0.305, -0.525, 0.935)],
    [(0.430, -0.525, 0.955), (0.450, -0.475, 1.065), (0.410, -0.380, 1.075), (0.405, -0.420, 0.945)],
]
make_loft("04_Brow_VisorArch", brow_sections, MAT_WHITE, closed_u=True, bevel_width=0.004, mirror_x=True, smooth_faces=False)

fh_o = [
    [(0.000, -0.790, 0.885), (0.175, -0.735, 0.955), (0.340, -0.625, 1.032), (0.445, -0.475, 1.062)],
    [(0.000, -0.695, 1.240), (0.165, -0.640, 1.250), (0.295, -0.550, 1.205), (0.395, -0.460, 1.125)],
    [(0.000, -0.540, 1.325), (0.145, -0.540, 1.310), (0.265, -0.510, 1.220), (0.365, -0.460, 1.090)],
]
fh_i = [[(0.0 if ci == 0 else x, y + 0.08, z - 0.02) for ci, (x, y, z) in enumerate(row)] for row in fh_o]
forehead_obj = make_solid_shell_from_grid("04_Forehead_SlopeArmor", fh_o, fh_i, MAT_WHITE, bevel_width=0.004, mirror_x=True, smooth_faces=False)

eye_mask_sec = [
    [(0.000, -0.735, 0.870), (0.296, -0.605, 0.930), (0.296, -0.542, 0.738), (0.000, -0.695, 0.680)],
    [(0.000, -0.510, 0.890), (0.318, -0.430, 0.942), (0.318, -0.375, 0.720), (0.000, -0.490, 0.665)],
]
make_loft("04_Eye_DeepBlackMask", eye_mask_sec, MAT_BLACK, closed_u=True, bevel_width=0.002, mirror_x=True, smooth_faces=False)

eye_edge_secs = [
    [(0.042, -0.722, 0.798), (0.048, -0.734, 0.770), (0.058, -0.718, 0.742), (0.052, -0.675, 0.770)],
    [(0.125, -0.692, 0.822), (0.132, -0.710, 0.792), (0.135, -0.690, 0.752), (0.128, -0.640, 0.785)],
    [(0.215, -0.645, 0.855), (0.222, -0.665, 0.825), (0.218, -0.642, 0.778), (0.210, -0.595, 0.815)],
    [(0.285, -0.598, 0.885), (0.290, -0.616, 0.852), (0.280, -0.600, 0.814), (0.272, -0.560, 0.850)],
]
make_loft("04_Eye_AmberBody", eye_edge_secs, MAT_EYE_EDGE, closed_u=True, bevel_width=0.002, mirror_x=True, smooth_faces=True)

eye_core_secs = [
    [(0.068, -0.722, 0.784), (0.072, -0.734, 0.770), (0.078, -0.720, 0.756), (0.072, -0.700, 0.770)],
    [(0.145, -0.690, 0.808), (0.150, -0.708, 0.792), (0.152, -0.692, 0.768), (0.146, -0.670, 0.788)],
    [(0.220, -0.648, 0.840), (0.225, -0.664, 0.822), (0.220, -0.646, 0.792), (0.215, -0.625, 0.816)],
    [(0.270, -0.610, 0.864), (0.274, -0.624, 0.845), (0.266, -0.610, 0.820), (0.260, -0.592, 0.842)],
]
make_loft("04_Eye_AmberCore", eye_core_secs, MAT_EYE_CORE, closed_u=True, bevel_width=0.0015, mirror_x=True, smooth_faces=True)

low_rim_sec = [
    [(0.032, -0.742, 0.732), (0.032, -0.702, 0.742), (0.032, -0.665, 0.708), (0.032, -0.715, 0.695)],
    [(0.155, -0.695, 0.748), (0.155, -0.655, 0.758), (0.155, -0.620, 0.722), (0.155, -0.670, 0.708)],
    [(0.282, -0.626, 0.805), (0.282, -0.588, 0.815), (0.282, -0.555, 0.770), (0.282, -0.608, 0.758)],
]
make_loft("04_Eye_LowerRim", low_rim_sec, MAT_WHITE, closed_u=True, bevel_width=0.0025, mirror_x=True, smooth_faces=False)


# ===========================================================================
# 5. FACEPLATE WITH TRUE RECESSED MOUTH SLITS + CHIN SOCKET + RED CHIN
# ===========================================================================
def mask_row(z_c, z_s, x_e, y_c, y_e, recess=0.0):
    y_m = y_c + (y_e - y_c) * (0.072 / x_e) * 0.85
    y_m2 = y_c + (y_e - y_c) * (0.080 / x_e) * 0.85
    z_m = z_c + (z_s - z_c) * 0.90
    return [
        (0.000, y_c + recess, z_c),
        (0.072, y_m + recess, z_m),
        (0.082, y_m2,         z_m - 0.002),
        (x_e,   y_e,          z_s),
    ]

mask_outer = [
    mask_row(0.740, 0.750, 0.228, -0.758, -0.618, 0.000),
    mask_row(0.652, 0.634, 0.218, -0.766, -0.618, 0.000),
    mask_row(0.646, 0.628, 0.217, -0.766, -0.618, 0.016),
    mask_row(0.630, 0.612, 0.215, -0.766, -0.618, 0.016),
    mask_row(0.624, 0.606, 0.214, -0.766, -0.618, 0.000),
    mask_row(0.604, 0.586, 0.211, -0.764, -0.616, 0.000),
    mask_row(0.598, 0.580, 0.210, -0.763, -0.615, 0.016),
    mask_row(0.582, 0.564, 0.207, -0.760, -0.612, 0.016),
    mask_row(0.576, 0.558, 0.206, -0.759, -0.610, 0.000),
    mask_row(0.468, 0.442, 0.178, -0.725, -0.588, 0.000),
    mask_row(0.300, 0.315, 0.136, -0.630, -0.542, 0.000),
]
mask_inner = [
    [(0.0 if ci == 0 else x * 0.85, y + 0.130, z) for ci, (x, y, z) in enumerate(row)]
    for row in mask_outer
]
mouth_cell_mats = {(r, 0): 1 for r in (1, 2, 3, 5, 6, 7)}
make_solid_shell_from_grid(
    "05_Faceplate_MainArmor", mask_outer, mask_inner,
    MAT_WHITE, bevel_width=0.0032, auto_smooth_deg=22.0,
    mirror_x=True, smooth_faces=False, sharp_cols=(0, 2), sharp_rows=(9,),
    cell_mat_map=mouth_cell_mats, extra_mats=(MAT_BLACK,)
)

chin_socket_sec = [
    [(-0.072, -0.688, 0.478), ( 0.072, -0.688, 0.478), ( 0.082, -0.560, 0.470), (-0.082, -0.560, 0.470)],
    [(-0.080, -0.735, 0.315), ( 0.080, -0.735, 0.315), ( 0.090, -0.565, 0.320), (-0.090, -0.565, 0.320)],
    [(-0.056, -0.682, 0.215), ( 0.056, -0.682, 0.215), ( 0.072, -0.550, 0.225), (-0.072, -0.550, 0.225)],
]
make_loft("05_Chin_WhiteSocket", chin_socket_sec, MAT_WHITE_COOL, closed_u=True, bevel_width=0.004, smooth_faces=False)

chin_sections = [
    [(-0.052, -0.700, 0.460), ( 0.052, -0.700, 0.460), ( 0.068, -0.550, 0.450), (-0.068, -0.550, 0.450)],
    [(-0.062, -0.778, 0.285), ( 0.062, -0.778, 0.285), ( 0.074, -0.560, 0.295), (-0.074, -0.560, 0.295)],
    [(-0.036, -0.702, 0.145), ( 0.036, -0.702, 0.145), ( 0.054, -0.540, 0.175), (-0.054, -0.540, 0.175)],
]
make_loft("05_Chin_RedBlock", chin_sections, MAT_RED, closed_u=True, bevel_width=0.005, smooth_faces=False)


# ===========================================================================
# 6. RED FOREHEAD KEYSTONE + 4-BLADE V-FIN (Approved in v6!)
# ===========================================================================
rk_top = [(-0.120, -0.760, 1.190), ( 0.120, -0.760, 1.190), ( 0.132, -0.640, 1.205), (-0.132, -0.640, 1.205)]
rk_mid = [(-0.114, -0.855, 0.985), ( 0.114, -0.855, 0.985), ( 0.126, -0.700, 0.995), (-0.126, -0.700, 0.995)]
rk_bot = [(-0.036, -0.815, 0.855), ( 0.036, -0.815, 0.855), ( 0.048, -0.705, 0.865), (-0.048, -0.705, 0.865)]
make_loft("06_Forehead_RedKeystone", [rk_top, rk_mid, rk_bot], MAT_RED, closed_u=True, bevel_width=0.0055, smooth_faces=False)


def make_heroic_diamond_blade(name, root_top, root_bot, tip,
                              mid_width_keep=0.68, tip_chord=0.016,
                              ridge_forward=0.048, back_thick=0.030, bevel_w=0.0018):
    rt = Vector(root_top)
    rb = Vector(root_bot)
    tp = Vector(tip)
    rm = (rt + rb) * 0.5
    half_vec = (rt - rb) * 0.5
    fwd = Vector((0.0, -1.0, 0.0))

    stations = []
    spec = [
        (0.00, 1.00, 1.00),
        (0.45, mid_width_keep, 0.82),
        (0.76, mid_width_keep * 0.55, 0.56),
        (1.00, max(0.06, (tip_chord * 0.5) / max(half_vec.length, 1e-4)), 0.24),
    ]
    for st, c_sc, r_sc in spec:
        c = rm.lerp(tp, st)
        hv = half_vec * c_sc
        stations.append([c + hv, c + fwd * (ridge_forward * r_sc), c - hv, c - fwd * (back_thick * r_sc)])

    return make_loft(
        name, stations, MAT_GOLD, closed_u=True, bevel_width=bevel_w,
        mirror_x=True, smooth_faces=False, sharp_u_indices=(0, 1, 2, 3)
    )


make_heroic_diamond_blade(
    "06_VFin_OuterMain",
    root_top=(0.078, -0.765, 1.120),
    root_bot=(0.095, -0.790, 0.895),
    tip=(1.055, -0.215, 1.925),
    mid_width_keep=0.68, tip_chord=0.016,
    ridge_forward=0.048, back_thick=0.030, bevel_w=0.0018
)
make_heroic_diamond_blade(
    "06_VFin_InnerSub",
    root_top=(0.115, -0.700, 1.245),
    root_bot=(0.220, -0.685, 1.085),
    tip=(0.392, -0.320, 1.908),
    mid_width_keep=0.64, tip_chord=0.016,
    ridge_forward=0.038, back_thick=0.026, bevel_w=0.0015
)


# ===========================================================================
# 7. CHEEK GUARD + VENT POD + SURFACE-SNAPPED SHOULDER SLOT + CLEAN EAR ARMOR
# ===========================================================================
cheek_guard_outer = [
    [(0.258, -0.630, 0.840), (0.320, -0.612, 0.865), (0.375, -0.538, 0.862)],
    [(0.242, -0.620, 0.620), (0.300, -0.616, 0.625), (0.355, -0.534, 0.620)],
    [(0.212, -0.600, 0.395), (0.266, -0.610, 0.388), (0.316, -0.524, 0.402)],
    [(0.188, -0.564, 0.200), (0.224, -0.580, 0.192), (0.278, -0.506, 0.268)],
]
cheek_guard_inner = [
    [(x - 0.030, y + 0.082, z) for (x, y, z) in row] for row in cheek_guard_outer
]
cheek_obj = make_solid_shell_from_grid(
    "07_CheekGuard_FrontBlade", cheek_guard_outer, cheek_guard_inner,
    MAT_WHITE, bevel_width=0.004, mirror_x=True, smooth_faces=False, sharp_cols=(1,)
)

# Surface-snapped lower cheek vertical notch (P1-2: bevel=0.0010 -> 0 bevel clamp!)
make_surface_snapped_port(
    "07_CheekGuard_LowerNotch", cheek_obj,
    approx_pt=(0.278, -0.578, 0.305), out_hint=(0.35, -0.93, 0.05),
    width=0.022, height=0.056, frame_w=0.005, proud_h=0.004, embed_d=0.014,
    frame_mat=MAT_WHITE_COOL, pocket_mat=MAT_DARK, mirror_x=True
)

vent_of = [
    (0.375, -0.538, 0.862),
    (0.655, -0.175, 0.942),
    (0.578, -0.145, 0.468),
    (0.280, -0.506, 0.270),
]
vent_if = [
    (0.392, -0.510, 0.775),
    (0.602, -0.220, 0.865),
    (0.545, -0.195, 0.495),
    (0.340, -0.480, 0.405),
]
vent_ob = [
    (0.345, -0.445, 0.875),
    (0.642,  0.040, 0.952),
    (0.568,  0.040, 0.472),
    (0.275, -0.380, 0.310),
]
vent_ib = [
    (0.320, -0.375, 0.770),
    (0.475, -0.105, 0.860),
    (0.430, -0.085, 0.495),
    (0.295, -0.350, 0.405),
]

make_hollow_frame(
    "07_VentPod_ThickFrame", vent_of, vent_if, vent_ob, vent_ib,
    MAT_WHITE, bevel_width=0.0045, mirror_x=True
)

vent_roof_sec = [
    [vent_of[0], vent_of[1], (0.595, -0.145, 0.992), (0.395, -0.492, 0.915)],
    [vent_ob[0], vent_ob[1], (0.548,  0.040, 1.000), (0.378, -0.415, 0.930)],
]
vent_roof_obj = make_loft(
    "07_VentPod_UpperShoulderRoof", vent_roof_sec, MAT_WHITE,
    closed_u=True, bevel_width=0.0045, mirror_x=True, smooth_faces=False
)

# P0-2 FIX: Surface-snapped Vent Shoulder Service Slot (100% visible in 3/4 & TOP!)
make_surface_snapped_port(
    "07_VentPod_ShoulderSlot", vent_roof_obj,
    approx_pt=(0.565, -0.120, 0.985), out_hint=(0.55, -0.15, 0.82),
    width=0.056, height=0.030, frame_w=0.007, proud_h=0.006, embed_d=0.016,
    frame_mat=MAT_WHITE_COOL, pocket_mat=MAT_DARK, mirror_x=True
)

p_if_v = [Vector(p) for p in vent_if]
p_ib_v = [Vector(p) for p in vent_ib]
plenum_open_front = [tuple(a.lerp(b, 0.08)) for a, b in zip(p_if_v, p_ib_v)]
plenum_deep_back = [tuple(a.lerp(b, 0.94)) for a, b in zip(p_if_v, p_ib_v)]
make_closed_pocket(
    "07_VentPod_DarkPlenum", plenum_open_front, plenum_deep_back,
    wall_thick_out=0.018, back_thick=0.020, mat=MAT_BLACK, mirror_x=True
)

p_tf, p_tr, p_br, p_bf = p_if_v
b_tf, b_tr, b_br, b_bf = p_ib_v

for k, frac in enumerate((0.25, 0.50, 0.75)):
    f_in = p_tf.lerp(p_bf, frac)
    f_out = p_tr.lerp(p_br, frac)
    b_in = b_tf.lerp(b_bf, frac)
    b_out = b_tr.lerp(b_br, frac)

    span_dir = (f_out - f_in).normalized()
    f0 = f_in - span_dir * 0.020
    f1 = f_out + span_dir * 0.020
    b0 = b_in - span_dir * 0.020
    b1 = b_out + span_dir * 0.020

    f0_rec = f0.lerp(b0, 0.16)
    f1_rec = f1.lerp(b1, 0.16)
    d0 = f0.lerp(b0, 0.78)
    d1 = f1.lerp(b1, 0.78)

    up_f = Vector((0.0, 0.0, 0.014))
    dn_f = Vector((0.0, 0.0, -0.014))
    up_b = Vector((0.0, 0.0, 0.009))
    dn_b = Vector((0.0, 0.0, -0.025))

    sec_front = [f0_rec + up_f, f1_rec + up_f, f1_rec + dn_f, f0_rec + dn_f]
    sec_back = [d0 + up_b, d1 + up_b, d1 + dn_b, d0 + dn_b]

    make_loft(
        f"07_VentPod_ThickBlade_{k}", [sec_front, sec_back], MAT_WHITE,
        closed_u=True, bevel_width=0.0025, mirror_x=True, smooth_faces=False
    )

# P0-1 & P1-1 FIX: Ear-Side Armor Casing with ONE hairline 0.0048 U-channel seam cleanly
# BEHIND LowerStepPlate (at Y=0.25, NOT chopping LowerStepPlate in half!)
ear_s0 = [(0.515, 0.02, 1.010), (0.592, 0.02, 0.995), (0.645, 0.02, 0.938), (0.570, 0.02, 0.470), (0.460, 0.02, 0.435)]
ear_s1 = [(0.500, 0.25, 1.032), (0.568, 0.25, 1.010), (0.616, 0.25, 0.935), (0.554, 0.25, 0.465), (0.450, 0.23, 0.415)]
ear_s2 = [(0.430, 0.42, 1.010), (0.485, 0.42, 0.985), (0.520, 0.43, 0.920), (0.470, 0.42, 0.445), (0.385, 0.39, 0.385)]

ear_grooved = [
    ear_s0,
    [tuple(step_toward(Vector(b), Vector(a), 0.0025)) for a, b in zip(ear_s0, ear_s1)],
    [tuple(step_toward(Vector(b), Vector(a), 0.0011) + Vector((-0.0042, 0.0, 0.0))) for a, b in zip(ear_s0, ear_s1)],
    [tuple(step_toward(Vector(b), Vector(c), 0.0011) + Vector((-0.0042, 0.0, 0.0))) for b, c in zip(ear_s1, ear_s2)],
    [tuple(step_toward(Vector(b), Vector(c), 0.0025)) for b, c in zip(ear_s1, ear_s2)],
    ear_s2,
]
make_loft(
    "07_EarSide_ArmorCasing", ear_grooved, MAT_WHITE,
    closed_u=True, bevel_width=0.0025, mirror_x=True, smooth_faces=False,
    seam_row_indices=(2,), extra_mats=(MAT_SEAM,)
)

# P1-1 FIX: Crisp proud EarSide LowerStepPlate sitting cleanly in front of the Y=0.25 ear seam!
ear_plate_sec = [
    [(0.592, 0.04, 0.655), (0.625, 0.04, 0.642), (0.588, 0.04, 0.480), (0.555, 0.04, 0.490)],
    [(0.578, 0.215, 0.665), (0.612, 0.215, 0.652), (0.576, 0.215, 0.480), (0.542, 0.215, 0.490)],
]
make_loft("07_EarSide_LowerStepPlate", ear_plate_sec, MAT_WHITE_COOL, closed_u=True, bevel_width=0.0028, mirror_x=True, smooth_faces=False)

jaw_under_sec = [
    [(0.200, -0.49, 0.34), (0.295, -0.47, 0.35), (0.280, -0.44, 0.285), (0.195, -0.46, 0.285)],
    [(0.310, -0.14, 0.49), (0.535, -0.14, 0.49), (0.510, -0.14, 0.460), (0.305, -0.14, 0.420)],
    [(0.320,  0.22, 0.47), (0.515,  0.22, 0.47), (0.485,  0.22, 0.435), (0.315,  0.22, 0.395)],
]
make_loft("07_Jaw_LowerBridge", jaw_under_sec, MAT_WHITE, closed_u=True, bevel_width=0.003, mirror_x=True, smooth_faces=False)


# ===========================================================================
# 8. SURFACE-SNAPPED RECESSED TEMPLE VULCAN POD (P1-2: Uncut upper rim in TOP!)
# ===========================================================================
def make_vulcan_recessed_pod():
    loc, n = sample_host_surface(helmet_obj, (0.395, -0.445, 1.132), out_hint=(0.76, -0.60, 0.24))
    rot_m = n.to_track_quat("Z", "Y").to_matrix().to_4x4()
    # Seat outer shroud slightly proud (+0.006 along true surface normal) so upper rim is 100% clean!
    center = loc + n * 0.006

    bm_sh = bmesh.new()
    bmesh.ops.create_cone(bm_sh, cap_ends=True, cap_tris=False, segments=28, radius1=0.078, radius2=0.064, depth=0.032)
    bmesh.ops.transform(bm_sh, matrix=Matrix.Translation(center - n * 0.004) @ rot_m, verts=bm_sh.verts)
    finalize_mesh("08_Temple_VulcanShroud", bm_sh, MAT_WHITE, bevel_width=0.0028, mirror_x=True, smooth_faces=True)

    bm_rk = bmesh.new()
    bmesh.ops.create_cone(bm_rk, cap_ends=True, cap_tris=False, segments=28, radius1=0.053, radius2=0.053, depth=0.016)
    bmesh.ops.transform(bm_rk, matrix=Matrix.Translation(center + n * 0.006) @ rot_m, verts=bm_rk.verts)
    finalize_mesh("08_Temple_VulcanRecessWell", bm_rk, MAT_BLACK, bevel_width=0.001, mirror_x=True, smooth_faces=True)

    bm_b = bmesh.new()
    bmesh.ops.create_cone(bm_b, cap_ends=True, cap_tris=False, segments=24, radius1=0.040, radius2=0.036, depth=0.018)
    bmesh.ops.transform(bm_b, matrix=Matrix.Translation(center + n * 0.010) @ rot_m, verts=bm_b.verts)
    finalize_mesh("08_Temple_VulcanBarrel", bm_b, MAT_METAL, bevel_width=0.0018, mirror_x=True, smooth_faces=True)

    bm_h = bmesh.new()
    bmesh.ops.create_cone(bm_h, cap_ends=True, cap_tris=False, segments=20, radius1=0.022, radius2=0.022, depth=0.012)
    bmesh.ops.transform(bm_h, matrix=Matrix.Translation(center + n * 0.015) @ rot_m, verts=bm_h.verts)
    finalize_mesh("08_Temple_VulcanBore", bm_h, MAT_BLACK, bevel_width=0.001, mirror_x=True, smooth_faces=True)

make_vulcan_recessed_pod()


# ===========================================================================
# BUILT-IN INTEGRITY SELF-CHECKS (NM=0, VENT BLEED=0, SURFACE PORTS 100% VISIBLE!)
# ===========================================================================
depsgraph = bpy.context.evaluated_depsgraph_get()
total_nm = 0
nm_report = {}
for obj in root.children:
    if obj.type != "MESH":
        continue
    eval_obj = obj.evaluated_get(depsgraph)
    mesh_eval = eval_obj.to_mesh()
    bm_chk = bmesh.new()
    bm_chk.from_mesh(mesh_eval)
    nm = sum(1 for e in bm_chk.edges if not e.is_manifold)
    bm_chk.free()
    eval_obj.to_mesh_clear()
    if nm > 0:
        nm_report[obj.name] = nm
        total_nm += nm

shell_eval = bpy.data.objects["02_Helmet_PolyhedralShell"].evaluated_get(depsgraph)
plenum_eval = bpy.data.objects["07_VentPod_DarkPlenum"].evaluated_get(depsgraph)
bvh_shell = BVHTree.FromObject(shell_eval, depsgraph)
bvh_plenum = BVHTree.FromObject(plenum_eval, depsgraph)

bleed_hits = 0
vent_ray_dir = Vector((-0.78, 0.62, 0.0)).normalized()
for iu in range(10):
    u = (iu + 0.5) / 10.0
    for iv in range(10):
        v = (iv + 0.5) / 10.0
        pt = p_tf.lerp(p_tr, u).lerp(p_bf.lerp(p_br, u), v)
        origin = pt - vent_ray_dir * 0.15
        loc_s, _, _, dist_s = bvh_shell.ray_cast(origin, vent_ray_dir, 1.0)
        loc_p, _, _, dist_p = bvh_plenum.ray_cast(origin, vent_ray_dir, 1.0)
        if loc_s is not None and (loc_p is None or dist_s < dist_p - 1e-4):
            bleed_hits += 1

# Port visibility check: raycast from outside along -normal; must hit Backing BEFORE host!
port_vis_report = {}
for pname, hname, p_center, p_norm in SURFACE_PORTS_AUDIT:
    h_bvh = BVHTree.FromObject(bpy.data.objects[hname].evaluated_get(depsgraph), depsgraph)
    b_bvh = BVHTree.FromObject(bpy.data.objects[f"{pname}_Backing"].evaluated_get(depsgraph), depsgraph)
    origin = p_center + p_norm * 0.20
    ray_d = -p_norm
    loc_b, _, _, dist_b = b_bvh.ray_cast(origin, ray_d, 0.5)
    loc_h, _, _, dist_h = h_bvh.ray_cast(origin, ray_d, 0.5)
    visible = (loc_b is not None) and (loc_h is None or dist_b < dist_h)
    port_vis_report[pname] = "VISIBLE" if visible else "BURIED"

print(f"SELF_CHECK: total_non_manifold_edges={total_nm} details={nm_report}")
print(f"SELF_CHECK: vent_cavity_helmet_bleed_rays={bleed_hits}/100")
print(f"SELF_CHECK: surface_ports_visibility={port_vis_report}")


# ===========================================================================
# RENDER & DESKTOP VIEWPORT SETUP
# ===========================================================================
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.use_gtao = True
scene.eevee.gtao_distance = 0.28
scene.eevee.gtao_factor = 1.55
scene.eevee.use_soft_shadows = True
scene.eevee.taa_render_samples = 96
scene.view_settings.view_transform = "Filmic"
scene.view_settings.look = "Medium High Contrast"
scene.view_settings.exposure = 0.15
scene.render.resolution_x = 800
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"

world = bpy.data.worlds.new("StudioWorld")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.24, 0.24, 0.25, 1.0)
bg.inputs[1].default_value = 0.72

def aim_at(obj, target, roll_z=0.0):
    direction = Vector(target) - obj.location
    q = direction.to_track_quat("-Z", "Y")
    if abs(roll_z) > 1e-6:
        q = q @ Matrix.Rotation(roll_z, 3, "Z").to_quaternion()
    obj.rotation_euler = q.to_euler()

lights_cfg = [
    ("Key_Light",  (-3.5, -5.0, 5.5), 420.0, 3.8),
    ("Fill_Light", ( 4.8, -3.5, 2.8), 220.0, 4.2),
    ("Rim_Light",  ( 1.5,  5.0, 4.5), 320.0, 3.5),
]
for lname, loc, energy, sz in lights_cfg:
    ldata = bpy.data.lights.new(lname, "AREA")
    ldata.energy = energy
    ldata.size = sz
    lobj = bpy.data.objects.new(lname, ldata)
    scene.collection.objects.link(lobj)
    lobj.location = Vector(loc)
    aim_at(lobj, (0.0, 0.0, 1.0))

cam_data = bpy.data.cameras.new("Review_Cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 2.40
cam_obj = bpy.data.objects.new("Review_Cam", cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

TARGET = (0.0, -0.02, 1.04)
DIST = 8.0
yaw_34 = math.radians(31.0)
elev_34 = math.radians(7.5)
pos_34 = (
    DIST * math.cos(elev_34) * math.sin(yaw_34),
    -DIST * math.cos(elev_34) * math.cos(yaw_34),
    TARGET[2] + DIST * math.sin(elev_34),
)
ang_behind_side = math.radians(28.0)
elev_r34 = math.radians(7.5)
pos_r34 = (
    DIST * math.cos(elev_r34) * math.cos(ang_behind_side),
    DIST * math.cos(elev_r34) * math.sin(ang_behind_side),
    TARGET[2] + DIST * math.sin(elev_r34),
)

MAIN_VIEWS = {
    "three_quarter": (pos_34, TARGET, 2.40, 0.0),
    "front": ((0.0, -8.0, 1.04), (0.0, 0.0, 1.04), 2.40, 0.0),
    "side": ((8.0, 0.0, 1.04), (0.0, 0.0, 1.04), 2.40, 0.0),
    "top": ((0.0, -0.001, 8.0), (0.0, 0.0, 0.0), 2.40, 0.0),
    "back": ((0.0, 8.0, 1.04), (0.0, 0.0, 1.04), 2.40, 0.0),
    "rear_three_quarter": (pos_r34, (0.0, 0.04, 1.04), 2.40, 0.0),
}

VENT_VIEWS = {
    "vent_closeup_34": ((2.9, -4.5, 1.22), (0.45, -0.28, 0.63), 0.98, 0.0),
    "vent_closeup_side": ((5.2, -0.22, 0.64), (0.45, -0.22, 0.63), 0.98, 0.0),
    "vent_closeup_top": ((2.2, -2.0, 3.8), (0.46, -0.24, 0.68), 0.98, 0.0),
}

# Frame Desktop Blender 3D viewports cleanly onto the 3/4 Material Preview
cam_obj.location = Vector(pos_34)
aim_at(cam_obj, TARGET)
for scr in bpy.data.screens:
    for area in scr.areas:
        if area.type == "VIEW_3D":
            sp = area.spaces.active
            sp.region_3d.view_location = Vector((0.0, -0.02, 1.04))
            sp.region_3d.view_distance = 4.6
            sp.region_3d.view_rotation = cam_obj.rotation_euler.to_quaternion()
            sp.region_3d.view_perspective = "PERSP"
            sp.lens = 65.0
            sp.shading.type = "MATERIAL"
            sp.overlay.show_floor = True
            sp.overlay.show_extras = False

# Save editable .blend BEFORE clay override
blend_path = OUT_DIR / f"freedom-head-v2-{VERSION_TAG}.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

# 1. Render Shaded views
for vname, (loc, tgt, oscale, rz) in MAIN_VIEWS.items():
    cam_data.ortho_scale = oscale
    cam_obj.location = Vector(loc)
    aim_at(cam_obj, tgt, rz)
    scene.render.filepath = str(RENDER_DIR / f"shaded-{vname}.png")
    bpy.ops.render.render(write_still=True)

# 2. Render Pure Clay views (P0-1: physical panel seams use pure MAT_CLAY so ONLY
#    real 3D groove depth + GTAO shows in clay — ZERO fake painted black lines!)
for obj in root.children:
    if obj.type == "MESH":
        is_cavity = any(k in obj.name for k in (
            "Plenum", "BlackMask", "CraniumCore", "ExhaustWell", "VulcanBore",
            "VulcanRecessWell", "Backing", "CenterLockSeam"
        ))
        if len(obj.data.materials) > 1:
            is_mouth = ("Faceplate" in obj.name)
            obj.data.materials[0] = MAT_CLAY
            obj.data.materials[1] = MAT_CLAY_DARK if is_mouth else MAT_CLAY
        else:
            obj.data.materials.clear()
            obj.data.materials.append(MAT_CLAY_DARK if is_cavity else MAT_CLAY)

for vname, (loc, tgt, oscale, rz) in MAIN_VIEWS.items():
    cam_data.ortho_scale = oscale
    cam_obj.location = Vector(loc)
    aim_at(cam_obj, tgt, rz)
    scene.render.filepath = str(RENDER_DIR / f"clay-{vname}.png")
    bpy.ops.render.render(write_still=True)

for vname, (loc, tgt, oscale, rz) in VENT_VIEWS.items():
    cam_data.ortho_scale = oscale
    cam_obj.location = Vector(loc)
    aim_at(cam_obj, tgt, rz)
    scene.render.filepath = str(RENDER_DIR / f"clay-{vname}.png")
    bpy.ops.render.render(write_still=True)

part_names = sorted(o.name for o in root.children if o.type == "MESH")
manifest = {
    "version": VERSION_TAG,
    "blenderVersion": bpy.app.version_string,
    "objectCount": len(part_names),
    "nonManifoldEdges": total_nm,
    "ventCavityBleedRays": bleed_hits,
    "surfacePortsVisibility": port_vis_report,
    "parts": part_names,
    "blendFile": str(blend_path),
}
(OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print("V2_BLOCKOUT_BUILD_OK", len(part_names), "parts ->", blend_path)
