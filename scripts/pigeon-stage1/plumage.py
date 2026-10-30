"""Original static R01 plumage: surface-following, merged feather meshes.

All colors use ordinary Principled materials that export to glTF.  Feather
laminae are thin, double-sided meshes; no alpha cards or procedural-only nodes.
"""
import math
import random

import bpy
from mathutils import Vector


def add_plumage(collection, parent, cfg, anatomy_point, torso_surface,
                closed_spline, mesh_object):
    rng = random.Random(80519)
    batches = {}
    batch_colors = {}
    counts = {}

    def material(name, color, roughness=.76):
        mat = bpy.data.materials.new("Plumage - " + name)
        mat.use_nodes = True
        mat.diffuse_color = (*color, 1)
        shader = mat.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = (*color, 1)
        shader.inputs["Roughness"].default_value = roughness
        specular = shader.inputs.get("Specular IOR Level") or shader.inputs.get("Specular")
        if specular is not None:
            specular.default_value = .28
        mat.use_backface_culling = False
        return mat

    palette = {
        "covert_0": material("warm pale covert A", (.585, .55, .52)),
        "covert_1": material("warm pale covert B", (.60, .565, .535)),
        "covert_2": material("warm pale covert C", (.615, .58, .55)),
        "bar_0": material("charcoal wing bar A", (.025, .029, .037)),
        "bar_1": material("charcoal wing bar B", (.040, .044, .052)),
        "flight_0": material("flight gray A", (.105, .112, .13)),
        "flight_1": material("flight gray B", (.15, .155, .17)),
        "flight_2": material("flight gray C", (.205, .205, .215)),
        "head_0": material("slate head contour A", (.1379, .14775, .1773), .80),
        "head_1": material("slate head contour B", (.14, .15, .18), .80),
        "head_2": material("slate head contour C", (.1421, .15225, .1827), .80),
        "neck_gray": material("gray neck transition", (.19, .23, .25), .64),
        "neck_teal_0": material("muted teal A", (.042, .145, .125), .55),
        "neck_teal_1": material("muted teal B", (.070, .195, .155), .55),
        "neck_teal_2": material("muted teal C", (.115, .205, .18), .57),
        "neck_purple_0": material("muted violet A", (.145, .060, .145), .57),
        "neck_purple_1": material("muted violet B", (.20, .095, .185), .57),
        "neck_purple_2": material("muted violet C", (.24, .13, .22), .60),
        "neck_low": material("lavender breast transition", (.32, .265, .29), .74),
        "neck_dark": material("dark neck feather", (.055, .082, .082), .62),
        "breast_0": material("soft breast A", (.421, .397, .383), .84),
        "breast_1": material("soft breast B", (.43, .405, .39), .84),
        "breast_2": material("soft breast C", (.439, .413, .397), .84),
        "tail_0": material("tail gray A", (.075, .082, .10)),
        "tail_1": material("tail gray B", (.115, .12, .135)),
    }
    neck_material = material("continuous neck contour color", (.14, .17, .17), .64)
    color_node = neck_material.node_tree.nodes.new("ShaderNodeVertexColor")
    color_node.layer_name = "FeatherColor"
    neck_material.node_tree.links.new(color_node.outputs["Color"],
                                     neck_material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
    palette["neck_gradient"] = neck_material

    # Root -> rounded terminal, clockwise in transverse/longitudinal chart.
    # A wide end arc avoids sharp needles/dragon scales at the silhouettes.
    outline = [(0, 0), (-.38, .12), (-.50, .48), (-.45, .80),
               (-.25, .965), (0, 1), (.25, .965), (.45, .80),
               (.50, .48), (.38, .12)]

    def feather(key, region, point, root, delta, width, ridge, tip_lift,
                layer_depth=0.0, coloring=None):
        """A curved lamina following point(chart)->(position,normal)."""
        vertices, faces, _ = batches.setdefault(key, ([], [], region))
        root, delta = Vector(root), Vector(delta)
        across = Vector((-delta.y, delta.x)).normalized()
        # Charts can have unlike units; callers supply a transverse scale.
        transverse = width if isinstance(width, Vector) else across * width

        def vertex(u, t):
            p, n = point(root + delta * t + transverse * u)
            emergence = min(1.0, t / .25)
            emergence = emergence * emergence * (3 - 2 * emergence)
            lift = (-.0010 * (1-t)**3 + tip_lift*t
                    + ridge*math.sin(math.pi*t)
                    + layer_depth*emergence)
            return p + n * lift

        center_uv = root + delta * .50
        _, outward = point(center_uv)
        boundary = outline
        if region == "neck":
            boundary = [(0,0),(-.35,.18),(-.50,.45),(-.32,.78),(0,1),(.30,.80),(.48,.46),(.35,.18)]
        if region in {"wing_coverts", "folded_flights", "tail"}:
            # Broad blades need a continuous rounded rim rather than the ten
            # conspicuous straight segments of the small contour feathers.
            boundary = [closed_spline(outline, i/24) for i in range(24)]
        local = [vertex(0, .50)] + [vertex(u, t) for u, t in boundary]
        start = len(vertices)
        vertices.extend(local)
        if coloring:
            batch_colors.setdefault(key, []).extend([(*coloring(p), 1) for p in local])
        for i in range(len(boundary)):
            a, b, c = start, start+1+i, start+1+(i+1) % len(boundary)
            if (vertices[b]-vertices[a]).cross(vertices[c]-vertices[a]).dot(outward) < 0:
                b, c = c, b
            faces.append((a, b, c))
        counts[region] = counts.get(region, 0) + 1

    def cross2(a, b):
        return a.x*b.y-a.y*b.x

    def polygon_tools(points, center):
        boundary = [closed_spline(points, i/128) for i in range(128)]
        center = Vector(center)

        def radius(uv):
            ray = uv-center
            if ray.length < 1e-9:
                return 0.0
            hits = []
            for i, a in enumerate(boundary):
                edge = boundary[(i+1) % len(boundary)]-a
                den = cross2(ray, edge)
                if abs(den) < 1e-12:
                    continue
                t = cross2(a-center, edge)/den
                u = cross2(a-center, ray)/den
                if t > 0 and -.0001 <= u <= 1.0001:
                    hits.append(t)
            return 1/min(hits) if hits else 2.0
        return radius

    covert = cfg["wingCoverts"]
    covert_outline = [(math.radians(a), z) for a, z in covert["outlineDegreesHeight"]]
    covert_center = (math.radians(covert["centerDegreesHeight"][0]), covert["centerDegreesHeight"][1])
    covert_radius = polygon_tools(covert_outline, covert_center)

    def wing_point(side):
        def point(uv):
            p, n = torso_surface(side*uv.x, uv.y)
            r = covert_radius(uv)
            if r <= 1:
                offset = covert["thickness"]*max(0, 1-r*r)**.8-covert["rootEmbed"]*r**8
            else:
                offset = .0005
            return p+n*(offset+.0004), n
        return point

    for side in [1, -1]:
        for row in range(11):
            z = .635-.035*row
            width = .032 if row < 3 else (.043 if row < 7 else .047)
            length = .052 if row < 3 else (.067 if row < 7 else .074)
            theta = math.radians(62) + (.5 if row % 2 else 0)*.10
            while theta < math.radians(179):
                uv = Vector((theta, z))
                p, n = torso_surface(side*theta, z)
                du = (anatomy_point(side*(theta+.001), z)-anatomy_point(side*(theta-.001), z))/.002
                step = width*.76/max(.12, du.length)
                if covert_radius(uv) < .98:
                    spread = .92+.16*rng.random()
                    bar = min(abs(theta-2.00), abs(theta-2.43)) < .13
                    key = ("bar_"+str(rng.randrange(2))) if bar else ("covert_"+str(rng.randrange(3)))
                    feather(key, "wing_coverts", wing_point(side),
                            (theta+rng.uniform(-.008, .008), z+rng.uniform(-.002, .002)),
                            (.10, -length*spread),
                            Vector((width/max(.12, du.length), .0)),
                            .0012, .0025, (10-row)*.00022)
                theta += step

    # The source envelope's static back surface, recovered from actual torso.
    flight = cfg["flightEnvelope"]
    flight_radius = polygon_tools(flight["outlineXZ"], flight["centerXZ"])

    def flight_point(side):
        def point(uv):
            x, z = uv
            front = anatomy_point(0, z).y
            back = anatomy_point(math.pi, z).y
            rx = anatomy_point(math.pi/2, z).x
            rear = (front+back)/2+(back-front)/2*math.sqrt(max(0, 1-(x/max(.001, rx))**2))
            t = max(0, min(1, (flight["axisTopZ"]-z)/(flight["axisTopZ"]-flight["axisBottomZ"])))
            axis_y = flight["axisTopY"]+(flight["axisBottomY"]-flight["axisTopY"])*t
            root = max(0, min(1, (z-flight["rootAttachStartZ"])/(flight["axisTopZ"]-flight["rootAttachStartZ"])))
            root = root*root*(3-2*root)
            attach = max(0, min(1, (flight["axisTopZ"]-z)/.13))
            attach = attach*attach*(3-2*attach)
            dorsal_y = rear+.028*attach
            free_y = (axis_y+dorsal_y+math.sqrt((axis_y-dorsal_y)**2+.015**2))/2
            base_y = free_y*(1-root)+min(axis_y, rear-.004)*root
            r = min(1, flight_radius(uv))
            thickness = flight["thickness"]*(.15+.85*(1-r*r))
            return Vector((side*x, base_y+thickness+side*.002*t+.001, z)), Vector((0, 1, 0))
        return point

    for side in [1, -1]:
        for index in range(9):
            root = Vector((.225-.018*index, .490-.011*index))
            end = Vector((.067-.008*index, .236-.0022*index))
            feather("flight_"+str(index % 3), "folded_flights", flight_point(side),
                    root, end-root, .034, .0010, .0015, (8-index)*.00018)

    # Fine scattered crown/cheek contour strokes replace broad regular
    # scalloped plates. Each narrow curved strip follows the real skull and
    # has four triangles, with only sub-millimetre relief in normalized units.
    eye_angle = math.radians(cfg["head"]["eye"]["angleDegrees"])
    eye_height = cfg["head"]["eye"]["height"]
    cere_height = sum(lobe["center"][2] for lobe in cfg["head"]["cereLobes"])/len(cfg["head"]["cereLobes"])
    head_rng = random.Random(80521)
    accepted = 0
    attempts = 0
    while accepted < 2350 and attempts < 12000:
        attempts += 1
        z = head_rng.uniform(.819, .995)
        theta = head_rng.uniform(0, 2*math.pi)
        du = (anatomy_point(theta+.001, z)-anatomy_point(theta-.001, z))/.002
        # Uniform chart samples are thinned near the pole to maintain a
        # comparable density per unit of actual surface area.
        if head_rng.random() > min(1.0, du.length/.135):
            continue
        front_angle = abs(math.atan2(math.sin(theta), math.cos(theta)))
        eye_delta = min(abs(math.atan2(math.sin(theta-eye_angle), math.cos(theta-eye_angle))),
                        abs(math.atan2(math.sin(theta+eye_angle), math.cos(theta+eye_angle))))
        arc_distance = eye_delta*du.length
        socket_clear = (arc_distance/.031)**2+((z-eye_height)/.032)**2 < 1
        cere_clear = (front_angle/.24)**2+((z-cere_height)/.025)**2 < 1
        if socket_clear or cere_clear:
            continue
        key = "head_"+str(head_rng.randrange(3))
        vertices, faces, _ = batches.setdefault(key, ([], [], "head"))
        width = head_rng.uniform(.0007, .0013)
        length = head_rng.uniform(.004, .010)
        drift = .008*math.sin(theta)+head_rng.uniform(-.004, .004)
        root = Vector((theta, z))
        delta = Vector((drift, -length))
        transverse = Vector((width/max(.025, du.length), 0))
        local = []
        for t, taper in [(0, .30), (.5, 1.0), (1, .10)]:
            for side in [-.5, .5]:
                uv = root+delta*t+transverse*(side*taper)
                point, normal = torso_surface(uv.x, uv.y)
                lift = .00010+.00012*math.sin(math.pi*t)
                local.append(point+normal*lift)
        start = len(vertices)
        vertices.extend(local)
        _, outward = torso_surface(theta+drift*.5, z-length*.5)
        for aa, bb, cc in [(0, 1, 2), (1, 3, 2), (2, 3, 4), (3, 5, 4)]:
            a, b, c = start+aa, start+bb, start+cc
            if (vertices[b]-vertices[a]).cross(vertices[c]-vertices[a]).dot(outward) < 0:
                b, c = c, b
            faces.append((a, b, c))
        counts["head"] = counts.get("head", 0)+1
        accepted += 1

    def neck_color(position, tone=1.0):
        theta = math.atan2(position.x, -.18-position.y)
        backness = (1-math.cos(theta))/2
        z = position.z+.045*backness
        stops = [(.52, (.43, .405, .39)), (.565, (.38, .335, .345)),
                 (.615, (.23, .15, .21)), (.66, (.18, .125, .19)),
                 (.71, (.10, .175, .15)), (.775, (.10, .17, .15)),
                 (.825, (.14, .155, .175)), (.86, (.14, .15, .18))]
        if z <= stops[0][0]: return tuple(v*tone for v in stops[0][1])
        if z >= stops[-1][0]: return tuple(v*tone for v in stops[-1][1])
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            if a <= z <= b:
                t = (z-a)/(b-a)
                t = t*t*(3-2*t)
                return tuple((va*(1-t)+vb*t)*tone for va, vb in zip(ca, cb))

    # Irregular surface samples replace horizontal scale rows. Upper cheek
    # feathers start small and flush, then lengthen gradually toward the neck.
    neck_rng = random.Random(80523)
    accepted = 0
    attempts = 0
    while accepted < 4000 and attempts < 30000:
        attempts += 1
        theta = neck_rng.uniform(0, 2*math.pi)
        z = neck_rng.uniform(.538, .889)
        backness = (1-math.cos(theta))/2
        bottom = .548+.10*backness+.008*math.sin(3*theta)
        top = .867+.014*backness
        if not bottom <= z <= top:
            continue
        du = (anatomy_point(theta+.001,z)-anatomy_point(theta-.001,z))/.002
        if neck_rng.random() > min(1.0,du.length/.28):
            continue
        front_angle = abs(math.atan2(math.sin(theta),math.cos(theta)))
        eye_delta = min(abs(math.atan2(math.sin(theta-eye_angle),math.cos(theta-eye_angle))),
                        abs(math.atan2(math.sin(theta+eye_angle),math.cos(theta+eye_angle))))
        if (eye_delta*du.length/.031)**2+((z-eye_height)/.032)**2 < 1:
            continue
        if (front_angle/.25)**2+((z-cere_height)/.028)**2 < 1:
            continue
        growth = max(0,min(1,(.872-z)/.30))
        width = (.0045+.0068*growth)*neck_rng.uniform(.88,1.12)
        length = (.008+.016*growth)*neck_rng.uniform(.85,1.15)
        tone = neck_rng.uniform(.98,1.02)
        feather("neck_gradient","neck",lambda uv:torso_surface(uv.x,uv.y),
                (theta,z),(.055*math.sin(theta),-length),
                Vector((width/max(.08,du.length),0)),
                .00035,.00060,0,
                coloring=lambda position,value=tone:neck_color(position,value))
        accepted += 1

    # Fine, low-relief breast feathers. Only the visible front is populated;
    # wing-covered sides are deliberately excluded from the triangle budget.
    for row in range(31):
        z = .552-.0138*row
        theta = -1.37+(row % 2)*.025
        while theta <= 1.37:
            p, n = torso_surface(theta, z)
            du = (anatomy_point(theta+.001, z)-anatomy_point(theta-.001, z))/.002
            width = .0135+.0010*rng.random()
            step = width*.91/max(.10, du.length)
            feather("breast_"+str(rng.randrange(3)), "breast", lambda uv: torso_surface(uv.x, uv.y),
                    (theta+rng.uniform(-.005, .005), z+rng.uniform(-.001, .001)),
                    (.018*math.sin(theta), -.024), Vector((width/max(.10, du.length), 0)),
                    .0003, .00065, (30-row)*.000015)
            theta += step

    # Tail blades remain tucked beneath the flights; only their rounded ends
    # should contribute to the final rear outline.
    for i in range(10):
        t = (i-4.5)/4.5
        root = Vector((.025*t, .345, .286))
        end = Vector((.085*t, .630-.018*abs(t), .160+.009*abs(t)))
        axis = end-root
        across = Vector((1, 0, 0))
        # The dorsal tail surface faces upward/backward. Reversing this
        # cross product puts the laminae relief beneath the tail envelope.
        normal = across.cross(axis).normalized()
        def tail_point(uv, origin=root, direction=axis, cross_axis=across, up=normal):
            return origin+direction*uv.y+cross_axis*uv.x, up
        feather("tail_"+str(i % 2), "tail", tail_point, (0, 0), (0, 1),
                Vector((.024, 0)), .0015, .0010, (9-i)*.00010)

    objects = []
    triangles = 0
    for key, (vertices, faces, region) in batches.items():
        if not faces:
            continue
        obj = mesh_object("Plumage_"+key, vertices, faces, palette[key])
        if key in batch_colors:
            colors = obj.data.color_attributes.new(name="FeatherColor", type="FLOAT_COLOR", domain="POINT")
            for entry, color in zip(colors.data, batch_colors[key]):
                entry.color = color
        obj.parent = parent
        obj["plumage_region"] = region
        objects.append(obj.name)
        triangles += len(faces)

    # Dark underlayers avoid pale gaps between the overlapping flight/tail
    # laminae. These modify materials only, never the approved base geometry.
    underlayers = []
    for obj in collection.objects:
        if obj.name.startswith("Wing_folded_flight_bundle_"):
            obj.data.materials.clear()
            obj.data.materials.append(palette["flight_0"])
            underlayers.append(obj.name)
        elif obj.name == "Tail_anatomical_envelope":
            obj.data.materials.clear()
            obj.data.materials.append(palette["tail_0"])
            underlayers.append(obj.name)
        elif obj.name.startswith("Wing_shoulder_wrapped_"):
            obj.data.materials.clear()
            obj.data.materials.append(palette["covert_0"])
            underlayers.append(obj.name)

    if triangles > 75000:
        raise RuntimeError("Plumage triangle budget exceeded: " + str(triangles))
    return {
        "feathers": sum(counts.values()), "region_feathers": counts,
        "added_triangles": triangles, "mesh_batches": len(objects),
        "objects": objects, "base_material_updates": underlayers,
        "limitations": ["static standing feather layout; not rigged for wing spreading",
                        "thin double-sided feather laminae; no microscopic barb fibers",
                        "muted teal/purple colors; no final optical iridescence shader"],
    }
