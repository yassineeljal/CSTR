"""Construit les pièces détaillées statiques du réacteur et les exporte en .glb (ADR-003).

La cuve, l'enveloppe, l'agitateur, les chicanes et le fluide restent procéduraux dans la scène
Three.js (coupe animée, rotation, shaders). Ce script produit tout le reste : moteur-réducteur,
brides et boulons, buses, tuyauterie à coudes arrondis, soupape de sécurité, jambes.

Les dimensions viennent de `tools/blender/geometry.json` (généré depuis `src/simulation/geometry.ts`
par `pnpm geometry:export`) : un seul endroit à modifier pour changer les proportions.

Repère : le script raisonne en repère « réacteur » (Y vertical, comme Three.js) et convertit via
`P()` vers le repère Blender (Z vertical). L'export glTF restitue Y vertical.

Usage (depuis la racine du dépôt) :
    blender -b --factory-startup --python tools/blender/build_reactor_assets.py -- \
        --out public/models/reactor-details.glb [--blend tools/blender/reactor-details.blend]
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
SPEC = json.loads((ROOT / "tools" / "blender" / "geometry.json").read_text())
G = SPEC["geometry"]
ANGLES = SPEC["angles"]


# ---------------------------------------------------------------------------------------------
# Repères
# ---------------------------------------------------------------------------------------------
def P(x: float, y: float, z: float) -> Vector:
    """Point du repère réacteur (Y haut) → repère Blender (Z haut)."""
    return Vector((x, -z, y))


def dir_theta(theta: float) -> Vector:
    """dir(θ) = (sin θ, 0, cos θ) du repère réacteur, en repère Blender."""
    return P(math.sin(theta), 0.0, math.cos(theta))


# ---------------------------------------------------------------------------------------------
# Matériaux (PBR → glTF metallic-roughness)
# ---------------------------------------------------------------------------------------------
_materials: dict[str, bpy.types.Material] = {}


def material(name: str, color, metallic: float, roughness: float, emission=None) -> bpy.types.Material:
    if name in _materials:
        return _materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 0.4
    _materials[name] = m
    return m


def materials() -> dict[str, bpy.types.Material]:
    return {
        "steel": material("Steel_Brushed", (0.78, 0.80, 0.82), 1.0, 0.34),
        "dark": material("Steel_Dark", (0.16, 0.17, 0.19), 0.9, 0.45),
        "bolt": material("Bolt_Zinc", (0.55, 0.57, 0.60), 1.0, 0.28),
        "motor": material("Motor_Paint_Blue", (0.04, 0.17, 0.52), 0.15, 0.38),
        "cast": material("Cast_Iron", (0.22, 0.24, 0.27), 0.7, 0.55),
        "valve": material("Valve_Paint_Red", (0.72, 0.05, 0.04), 0.1, 0.42),
        "yellow": material("Safety_Yellow", (0.93, 0.70, 0.04), 0.1, 0.45),
        "rubber": material("Gasket_Rubber", (0.02, 0.02, 0.025), 0.0, 0.85),
        "glass": material("Sight_Glass", (0.6, 0.8, 0.9), 0.0, 0.05),
        "pipe_cool": material("Pipe_Coolant_Blue", (0.10, 0.36, 0.72), 0.2, 0.4),
        "pipe_feed": material("Pipe_Feed_Green", (0.10, 0.50, 0.22), 0.2, 0.4),
        "pipe_out": material("Pipe_Out_Grey", (0.55, 0.57, 0.60), 0.8, 0.4),
    }


M = None  # rempli dans main()


# ---------------------------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------------------------
def link(obj: bpy.types.Object, collection: bpy.types.Collection) -> bpy.types.Object:
    for c in obj.users_collection:
        c.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def mesh_from_bm(name: str, bm: bmesh.types.BMesh, mat, coll) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.validate()
    obj = bpy.data.objects.new(name, me)
    me.materials.append(mat)
    for poly in me.polygons:
        poly.use_smooth = True
    coll.objects.link(obj)
    return obj


def revolve(name: str, profile, mat, coll, segments: int = 48, axis_origin=(0, 0, 0)) -> bpy.types.Object:
    """Solide de révolution autour de l'axe vertical (reactor Y). `profile` : [(r, y), ...] fermé."""
    bm = bmesh.new()
    verts = [bm.verts.new(P(r, y, 0)) for r, y in profile]
    edges = [bm.edges.new((verts[i], verts[(i + 1) % len(verts)])) for i in range(len(verts))]
    bm.faces.new(verts)
    bmesh.ops.spin(
        bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), cent=Vector(axis_origin),
        axis=Vector((0, 0, 1)), dvec=Vector((0, 0, 0)), angle=2 * math.pi, steps=segments,
        use_merge=True, use_normal_flip=False, use_duplicate=False,
    )
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(name, bm, mat, coll)


def cylinder(name, radius, length, origin, direction, mat, coll, segments=32, caps=True) -> bpy.types.Object:
    """Cylindre plein de longueur `length` partant de `origin` (repère réacteur) selon `direction`."""
    d = Vector(direction).normalized()
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=caps, cap_tris=False, segments=segments, radius1=radius, radius2=radius,
        depth=length, matrix=Matrix.Identity(4),
    )
    # create_cone est centré sur l'origine, axe Z : on le décale pour partir de la base
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((0, 0, length / 2)))
    obj = mesh_from_bm(name, bm, mat, coll)
    rot = Vector((0, 0, 1)).rotation_difference(P(*d)).to_matrix().to_4x4()
    obj.matrix_world = Matrix.Translation(P(*origin)) @ rot
    return obj


def box(name, size, center, mat, coll, rot_y=0.0) -> bpy.types.Object:
    """Boîte (sx, sy, sz) en repère réacteur, centrée en `center`, tournée de `rot_y` autour de Y."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((size[0], size[2], size[1])), verts=bm.verts)
    obj = mesh_from_bm(name, bm, mat, coll)
    obj.matrix_world = Matrix.Translation(P(*center)) @ Matrix.Rotation(-rot_y, 4, "Z")
    return obj


def join(objs: list[bpy.types.Object], name: str, coll) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    out = bpy.context.view_layer.objects.active
    out.name = name
    out.data.name = name
    link(out, coll)
    return out


def bolt_ring(name, count, ring_radius, y, head_r, head_h, stud_h, mat, coll, phase=0.0) -> bpy.types.Object:
    parts = []
    for i in range(count):
        a = phase + 2 * math.pi * i / count
        x, z = ring_radius * math.sin(a), ring_radius * math.cos(a)
        parts.append(cylinder(f"{name}_h{i}", head_r, head_h, (x, y, z), (0, 1, 0), mat, coll, segments=6))
        parts.append(cylinder(f"{name}_s{i}", head_r * 0.45, stud_h, (x, y + head_h, z), (0, 1, 0), mat, coll, segments=12))
    return join(parts, name, coll)


def rounded_polyline(points, bend_radius: float, arc_steps: int = 10):
    """Polyligne 3D avec coudes arrondis (arcs de cercle tangents)."""
    pts = [Vector(p) for p in points]
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, p, b = pts[i - 1], pts[i], pts[i + 1]
        u, v = (a - p).normalized(), (b - p).normalized()
        theta = u.angle(v)
        if theta > math.pi - 1e-3 or theta < 1e-3:  # alignés
            out.append(p)
            continue
        t = bend_radius / math.tan(theta / 2)
        t = min(t, (a - p).length * 0.49, (b - p).length * 0.49)
        r = t * math.tan(theta / 2)
        entry, exit_ = p + u * t, p + v * t
        center = p + (u + v).normalized() * (r / math.sin(theta / 2))
        e0, e1 = (entry - center), (exit_ - center)
        phi = e0.angle(e1)
        for k in range(arc_steps + 1):
            f = k / arc_steps
            # slerp explicite (Vector.slerp de mathutils renormalise) : |e0| = |e1| = r
            q = (e0 * math.sin((1 - f) * phi) + e1 * math.sin(f * phi)) / math.sin(phi)
            out.append(center + q)
    out.append(pts[-1])
    return out


def pipe(name, points, radius, mat, coll, bend_radius=None) -> bpy.types.Object:
    """Tuyau sur polyligne (repère réacteur) avec coudes arrondis, converti en maillage."""
    path = rounded_polyline([P(*p) for p in points], bend_radius or radius * 3.0)
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 6
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(path) - 1)
    for pt, co in zip(sp.points, path):
        pt.co = (co.x, co.y, co.z, 1.0)
    obj = bpy.data.objects.new(name, cu)
    coll.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def flange(name, center, direction, pipe_r, mat_f, mat_b, coll, bolts=8) -> bpy.types.Object:
    """Bride à collerette avec joint et boulons, centrée sur l'axe `direction` au point `center`."""
    d = Vector(direction).normalized()
    thick = pipe_r * 0.45
    fr = pipe_r * 1.9
    parts = [cylinder(f"{name}_disc", fr, thick, center, d, mat_f, coll, segments=40)]
    gasket_origin = tuple(Vector(center) + d * thick)
    parts.append(cylinder(f"{name}_gasket", fr * 0.92, thick * 0.25, gasket_origin, d, M["rubber"], coll, segments=40))
    # boulons répartis sur un cercle perpendiculaire à d
    ref = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
    e1 = d.cross(ref).normalized()
    e2 = d.cross(e1).normalized()
    for i in range(bolts):
        a = 2 * math.pi * i / bolts
        off = (e1 * math.cos(a) + e2 * math.sin(a)) * fr * 0.72
        o = tuple(Vector(center) + off + d * thick)
        parts.append(cylinder(f"{name}_b{i}", pipe_r * 0.22, thick * 0.9, o, d, mat_b, coll, segments=6))
    return join(parts, name, coll)


def anchor(name: str, pos, coll) -> bpy.types.Object:
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "SPHERE"
    e.empty_display_size = 0.01
    e.location = P(*pos)
    coll.objects.link(e)
    return e


# ---------------------------------------------------------------------------------------------
# Assemblages
# ---------------------------------------------------------------------------------------------
def build_motor(coll):
    H, hd = G["shellHeight"], G["headDepth"]
    top = H + hd
    R, mh = G["motorRadius"], G["motorHeight"]
    parts = []
    # châssis support : lanterne cylindrique ajourée (4 montants) entre le couvercle et le réducteur
    lantern_h = mh * 0.55
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        parts.append(box(f"Lantern_post{i}", (R * 0.1, lantern_h, R * 0.1),
                         (R * 0.62 * math.sin(a), top + lantern_h / 2, R * 0.62 * math.cos(a)), M["cast"], coll))
    parts.append(cylinder("Lantern_base", R * 0.95, mh * 0.06, (0, top, 0), (0, 1, 0), M["cast"], coll, 40))
    y = top + lantern_h
    # réducteur
    parts.append(cylinder("Gearbox", R * 0.86, mh * 0.34, (0, y, 0), (0, 1, 0), M["cast"], coll, 48))
    parts.append(cylinder("Gearbox_flange", R * 0.95, mh * 0.05, (0, y + mh * 0.34, 0), (0, 1, 0), M["dark"], coll, 48))
    y2 = y + mh * 0.39
    # moteur peint + ailettes
    parts.append(cylinder("Motor_body", R * 0.72, mh * 0.62, (0, y2, 0), (0, 1, 0), M["motor"], coll, 48))
    for i in range(16):
        a = 2 * math.pi * i / 16
        parts.append(box(f"Fin{i}", (R * 0.05, mh * 0.5, R * 0.14),
                         (R * 0.74 * math.sin(a), y2 + mh * 0.31, R * 0.74 * math.cos(a)), M["motor"], coll, rot_y=a))
    parts.append(cylinder("Fan_cover", R * 0.6, mh * 0.16, (0, y2 + mh * 0.62, 0), (0, 1, 0), M["dark"], coll, 48))
    # boîte à bornes
    parts.append(box("Terminal_box", (R * 0.42, mh * 0.2, R * 0.34),
                     (R * 0.92 * math.sin(ANGLES["feed"]), y2 + mh * 0.35, R * 0.92 * math.cos(ANGLES["feed"])),
                     M["motor"], coll, rot_y=ANGLES["feed"]))
    # œillet de levage
    ring = bpy.data.curves.new("Lifting_eye", "CURVE")
    ring.dimensions = "3D"
    ring.bevel_depth = R * 0.05
    sp = ring.splines.new("POLY")
    n = 24
    sp.points.add(n - 1)
    for k, pt in enumerate(sp.points):
        a = 2 * math.pi * k / n
        v = P(R * 0.16 * math.cos(a), y2 + mh * 0.78 + R * 0.16 * math.sin(a), 0)
        pt.co = (v.x, v.y, v.z, 1)
    sp.use_cyclic_u = True
    eye = bpy.data.objects.new("Lifting_eye", ring)
    coll.objects.link(eye)
    bpy.context.view_layer.objects.active = eye
    bpy.ops.object.select_all(action="DESELECT")
    eye.select_set(True)
    bpy.ops.object.convert(target="MESH")
    eye = bpy.context.view_layer.objects.active
    eye.data.materials.append(M["dark"])
    parts.append(eye)
    out = join(parts, "Motor_Assembly", coll)
    anchor("Anchor_Motor", (0, y2 + mh * 0.3, 0), coll)
    return out


def build_flanges(coll):
    H = G["shellHeight"]
    R = G["tankRadius"]
    t = G["wallThickness"]
    fr = G["lidFlangeRadius"]
    th = t * 2.6
    ring = revolve("Lid_Flange_Ring", [(R + t * 0.3, H - th * 0.5), (fr, H - th * 0.5), (fr, H + th * 0.5), (R + t * 0.3, H + th * 0.5)],
                   M["steel"], coll, 64)
    gasket = revolve("Lid_Gasket", [(R + t * 0.6, H + th * 0.5), (fr * 0.985, H + th * 0.5), (fr * 0.985, H + th * 0.5 + t * 0.35), (R + t * 0.6, H + th * 0.5 + t * 0.35)],
                     M["rubber"], coll, 64)
    lower = revolve("Lid_Flange_Lower", [(R + t * 0.3, H - th * 1.5), (fr, H - th * 1.5), (fr, H - th * 0.5), (R + t * 0.3, H - th * 0.5)],
                    M["steel"], coll, 64)
    bolts = bolt_ring("Lid_Bolts", 24, fr - (fr - R) * 0.45, H + th * 0.5 + t * 0.35, t * 0.9, t * 0.8, t * 0.9, M["bolt"], coll, phase=0.07)
    # collerette de jacket (anneaux haut/bas visibles de l'extérieur)
    return join([ring, gasket, lower, bolts], "Flanges_Lid", coll)


def build_legs(coll):
    Rj = G["jacketOuterRadius"]
    yb = G["jacketBottom"] - 0.02 * G["shellHeight"]
    floor = G["floorY"]
    w = G["tankDiameter"] * 0.035
    parts = [revolve("Support_Ring", [(Rj - w * 0.2, yb - w * 0.6), (Rj + w * 1.6, yb - w * 0.6), (Rj + w * 1.6, yb + w * 0.6), (Rj - w * 0.2, yb + w * 0.6)],
                     M["cast"], coll, 64)]
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        x, z = (Rj + w * 1.0) * math.sin(a), (Rj + w * 1.0) * math.cos(a)
        h = yb - floor
        # profilé en I : âme + 2 semelles
        parts.append(box(f"Leg{i}_web", (w * 0.28, h, w * 1.6), (x, floor + h / 2, z), M["cast"], coll, rot_y=a))
        for s in (-1, 1):
            off = (w * 0.7) * s
            parts.append(box(f"Leg{i}_fl{s}", (w * 1.5, h, w * 0.28),
                             (x + off * math.cos(a), floor + h / 2, z - off * math.sin(a)), M["cast"], coll, rot_y=a))
        parts.append(box(f"Leg{i}_plate", (w * 3.0, w * 0.4, w * 3.0), (x, floor + w * 0.2, z), M["dark"], coll, rot_y=a))
        for bx in (-1, 1):
            for bz in (-1, 1):
                ox = (bx * w * 1.1) * math.cos(a) + (bz * w * 1.1) * math.sin(a)
                oz = -(bx * w * 1.1) * math.sin(a) + (bz * w * 1.1) * math.cos(a)
                parts.append(cylinder(f"Leg{i}_anc{bx}{bz}", w * 0.18, w * 0.45, (x + ox, floor + w * 0.4, z + oz), (0, 1, 0), M["bolt"], coll, 6))
    return join(parts, "Legs_Assembly", coll)


def build_nozzles_and_piping(coll):
    parts_noz, parts_pipe = [], []
    nz = {n["id"]: n for n in SPEC["nozzles"]}
    floor = G["floorY"]
    D = G["tankDiameter"]
    R = G["tankRadius"]

    for n in nz.values():
        pos, d, r, L = n["position"], n["direction"], n["radius"], n["length"]
        end = tuple(pos[i] + d[i] * L for i in range(3))
        parts_noz.append(cylinder(f"Nozzle_{n['id']}", r, L, pos, d, M["steel"], coll, 32))
        if n["id"] not in ("reliefValve", "sightGlass", "thermowell"):
            parts_noz.append(flange(f"Flange_{n['id']}", end, d, r, M["steel"], M["bolt"], coll))

    # --- alimentation : vers le haut, coude, puis vers l'extérieur
    f = nz["feed"]
    fe = tuple(f["position"][i] + f["direction"][i] * f["length"] for i in range(3))
    ang = ANGLES["feed"]
    out = (math.sin(ang), 0, math.cos(ang))
    p0 = (fe[0], fe[1] + D * 0.02, fe[2])
    p1 = (fe[0], fe[1] + D * 0.30, fe[2])
    p2 = (fe[0] + out[0] * D * 0.9, fe[1] + D * 0.30, fe[2] + out[2] * D * 0.9)
    parts_pipe.append(pipe("Pipe_Feed", [p0, p1, p2], f["radius"] * 0.92, M["pipe_feed"], coll, f["radius"] * 3))
    parts_pipe.append(flange("Flange_FeedEnd", p2, out, f["radius"] * 0.92, M["steel"], M["bolt"], coll))
    anchor("Anchor_Feed", p2, coll)

    # --- sortie : vers le bas, coude, horizontale (vers +X) avec vanne
    o = nz["outlet"]
    oe = (0, o["position"][1] - o["length"], 0)
    yh = floor + D * 0.10
    pa = (0, oe[1] - D * 0.02, 0)
    pb = (0, yh, 0)
    pc = (D * 0.85, yh, 0)
    parts_pipe.append(pipe("Pipe_Outlet", [pa, pb, pc], o["radius"], M["pipe_out"], coll, o["radius"] * 3))
    parts_pipe.append(flange("Flange_OutletEnd", pc, (1, 0, 0), o["radius"], M["steel"], M["bolt"], coll))
    # vanne manuelle sur la verticale : corps + volant
    vy = (oe[1] + yh) / 2
    parts_pipe.append(cylinder("Valve_body", o["radius"] * 1.8, D * 0.07, (0, vy - D * 0.035, 0), (0, 1, 0), M["valve"], coll, 24))
    parts_pipe.append(cylinder("Valve_stem", o["radius"] * 0.35, D * 0.12, (0, vy + D * 0.035, 0), (1, 0, 0), M["dark"], coll, 12))
    parts_pipe.append(revolve("Valve_wheel", [(o["radius"] * 1.5, vy - D * 0.006 + 0.0), (o["radius"] * 2.2, vy - D * 0.006), (o["radius"] * 2.2, vy + D * 0.006), (o["radius"] * 1.5, vy + D * 0.006)],
                              M["yellow"], coll, 24, axis_origin=(0, 0, 0)))
    # le volant précédent est centré sur l'axe Y : on le déplace sur la tige
    wheel = parts_pipe.pop()
    wheel.location = P(D * 0.12, 0, 0) + wheel.location
    parts_pipe.append(wheel)
    anchor("Anchor_Outlet", pc, coll)

    # --- circuit d'eau de refroidissement
    for key, mat in (("jacketIn", M["pipe_cool"]), ("jacketOut", M["pipe_cool"])):
        n = nz[key]
        e = tuple(n["position"][i] + n["direction"][i] * n["length"] for i in range(3))
        dvec = n["direction"]
        if key == "jacketIn":
            pts = [e, (e[0] + dvec[0] * D * 0.15, e[1], e[2] + dvec[2] * D * 0.15),
                   (e[0] + dvec[0] * D * 0.15, floor + D * 0.20, e[2] + dvec[2] * D * 0.15),
                   (e[0] + dvec[0] * D * 0.15 + dvec[2] * D * 0.5, floor + D * 0.20, e[2] + dvec[2] * D * 0.15 - dvec[0] * D * 0.5)]
        else:
            pts = [e, (e[0] + dvec[0] * D * 0.15, e[1], e[2] + dvec[2] * D * 0.15),
                   (e[0] + dvec[0] * D * 0.15, e[1] + D * 0.25, e[2] + dvec[2] * D * 0.15),
                   (e[0] + dvec[0] * D * 0.15 + dvec[2] * D * 0.5, e[1] + D * 0.25, e[2] + dvec[2] * D * 0.15 - dvec[0] * D * 0.5)]
        parts_pipe.append(pipe(f"Pipe_{key}", pts, n["radius"] * 0.9, mat, coll, n["radius"] * 3))
        last = Vector(pts[-1]) - Vector(pts[-2])
        parts_pipe.append(flange(f"Flange_{key}End", pts[-1], tuple(last.normalized()), n["radius"] * 0.9, M["steel"], M["bolt"], coll))
        anchor("Anchor_" + key[0].upper() + key[1:], pts[-1], coll)

    # --- soupape de sécurité : corps, ressort (capot rouge), refoulement coudé
    rv = nz["reliefValve"]
    base = tuple(rv["position"][i] + rv["direction"][i] * rv["length"] for i in range(3))
    rr = rv["radius"]
    parts_noz.append(flange("Flange_Relief", base, (0, 1, 0), rv["radius"] * 0.8, M["steel"], M["bolt"], coll))
    by = base[1] + rr * 0.9
    parts_noz.append(cylinder("Relief_body", rr * 1.35, rr * 2.4, (base[0], by, base[2]), (0, 1, 0), M["steel"], coll, 32))
    parts_noz.append(cylinder("Relief_bonnet", rr * 0.95, rr * 3.4, (base[0], by + rr * 2.4, base[2]), (0, 1, 0), M["valve"], coll, 32))
    parts_noz.append(cylinder("Relief_cap", rr * 0.7, rr * 0.6, (base[0], by + rr * 5.8, base[2]), (0, 1, 0), M["dark"], coll, 24))
    ang_r = ANGLES["reliefValve"]
    outr = (math.sin(ang_r), 0, math.cos(ang_r))
    d0 = (base[0], by + rr * 1.2, base[2])
    d1 = (base[0] + outr[0] * rr * 3.0, by + rr * 1.2, base[2] + outr[2] * rr * 3.0)
    d2 = (d1[0], d1[1] + rr * 8.0, d1[2])
    parts_pipe.append(pipe("Pipe_ReliefDischarge", [d0, d1, d2], rr * 0.75, M["steel"], coll, rr * 2.2))
    parts_pipe.append(cylinder("Relief_tip", rr * 0.95, rr * 0.4, (d2[0], d2[1], d2[2]), (0, 1, 0), M["dark"], coll, 24))
    anchor("Anchor_ReliefOutlet", (d2[0], d2[1] + rr * 0.5, d2[2]), coll)

    # --- regard de niveau : bride + hublot
    sg = nz["sightGlass"]
    sgend = tuple(sg["position"][i] + sg["direction"][i] * sg["length"] for i in range(3))
    parts_noz.append(flange("Flange_Sight", sgend, (0, 1, 0), sg["radius"] * 1.2, M["steel"], M["bolt"], coll, 6))
    parts_noz.append(cylinder("Sight_glass", sg["radius"] * 1.5, sg["radius"] * 0.25,
                              (sgend[0], sgend[1] + sg["radius"] * 0.9, sgend[2]), (0, 1, 0), M["glass"], coll, 32))
    anchor("Anchor_SightGlass", (sgend[0], sgend[1] + sg["radius"], sgend[2]), coll)

    # --- puits thermométrique : tube plongeant + tête
    tw = nz["thermowell"]
    twt = tuple(tw["position"][i] + tw["direction"][i] * tw["length"] for i in range(3))
    dive = G["liquidHeight"] * 0.55
    parts_noz.append(cylinder("Thermowell_tube", tw["radius"] * 0.35, twt[1] - dive + 0.0, (twt[0], dive, twt[2]), (0, 1, 0), M["steel"], coll, 16))
    parts_noz.append(cylinder("Thermowell_head", tw["radius"] * 1.1, tw["radius"] * 1.8, (twt[0], twt[1], twt[2]), (0, 1, 0), M["dark"], coll, 16))
    anchor("Anchor_Thermowell", (twt[0], twt[1] + tw["radius"] * 2, twt[2]), coll)

    join(parts_noz, "Nozzles_Assembly", coll)
    join(parts_pipe, "Piping_Assembly", coll)


# ---------------------------------------------------------------------------------------------
def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = Path(argv[argv.index("--out") + 1]) if "--out" in argv else ROOT / "public" / "models" / "reactor-details.glb"
    blend = Path(argv[argv.index("--blend") + 1]) if "--blend" in argv else None

    bpy.ops.wm.read_factory_settings(use_empty=True)
    global M
    M = materials()
    coll = bpy.data.collections.new("ReactorDetails")
    bpy.context.scene.collection.children.link(coll)

    build_motor(coll)
    build_flanges(coll)
    build_legs(coll)
    build_nozzles_and_piping(coll)

    tris = sum(len(o.data.polygons) for o in coll.objects if o.type == "MESH")
    print(f"[reactor-details] objets={len(coll.objects)} polygones={tris}")

    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out), export_format="GLB", use_selection=False, export_apply=True,
        export_yup=True, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
    )
    print(f"[reactor-details] écrit {out} ({out.stat().st_size / 1024:.0f} Ko)")
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))


if __name__ == "__main__":
    main()
