"""Editable reference-matched Freedom head, Blender 3.1+.

X right, -Y front, Z up. Reference image landmarks set the modeling scale:
200 source pixels per unit; frontal eye line Z=.8, crown Z=1.925.
Hidden details in the generated reference are interpretations, not measured facts.
"""
import bpy
import bmesh
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'freedom-head'
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'renders').mkdir(exist_ok=True)
constraints=json.loads((OUT/'reference'/'part-constraints.json').read_text())
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0


def material(name, color, metallic=0.0, roughness=.36):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Clearcoat'].default_value = .18
    node.inputs['Clearcoat Roughness'].default_value = .3
    return mat


white = material('Armor | satin white', (.64, .66, .68), .12, .38)
edge = material('Armor | cool inset white', (.48, .51, .55), .15, .42)
metal = material('Frame | machined gunmetal', (.115, .13, .15), .72, .38)
dark = material('Frame | graphite', (.032, .039, .048), .48, .42)
black = material('Recess | light absorbing', (.008, .011, .015), .05, .62)
seam = material('Panel seam | grey', (.10, .115, .13), .1, .55)
red = material('Armor | lacquer red', (.55, .024, .032), .15, .34)
gold = material('V-fin | yellow gold lacquer', (.83, .43, .035), .55, .28)
gold_edge = material('V-fin | ridge shadow', (.42, .18, .008), .5, .30)
amber_frame = material('Sensor | amber metal bezel', (.55, .20, .015), .55, .28)
eye = material('Sensor | amber', (1, .49, .025), .3, .18)
node = eye.node_tree.nodes.get('Principled BSDF')
node.inputs['Emission'].default_value = (1, .32, .005, 1)
node.inputs['Emission Strength'].default_value = .22
blue = material('Sensor | blue optical glass', (.075, .16, .23), .55, .14)
root = bpy.data.objects.new('Freedom_Head', None)
bpy.context.collection.objects.link(root)


def mesh(name, verts, faces, mat, bevel=.004, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = root
    data.materials.append(mat)
    data.use_auto_smooth = True
    data.auto_smooth_angle = math.radians(45)
    if smooth:
        for poly in data.polygons:
            poly.use_smooth = True
        data.use_auto_smooth = True
        data.auto_smooth_angle = math.radians(45)
    if bevel:
        mod = obj.modifiers.new('Manufactured edge radius', 'BEVEL')
        mod.width, mod.segments = bevel, 3
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(25)
        mod.harden_normals = True
        normals = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        normals.keep_sharp = True
    return obj


def prism(name, outline, vector, mat, bevel=.004):
    n = len(outline)
    verts = list(outline) + [tuple(Vector(p) + Vector(vector)) for p in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(i, (i+1) % n, (i+1) % n+n, i+n) for i in range(n)]
    return mesh(name, verts, faces, mat, bevel)


def plate(name, outline, depth, mat, bevel=.004):
    return prism(name, outline, (0, depth, 0), mat, bevel)


def box(name, location, dimensions, mat, bevel=.004):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name, obj.parent = name, root
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.data.use_auto_smooth = True
    if bevel:
        mod = obj.modifiers.new('Edge bevel', 'BEVEL')
        mod.width, mod.segments = bevel, 3
        mod.harden_normals = True
        obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def cylinder(name, center, radius, depth, mat, normal=(0, 0, 1), vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
    obj = bpy.context.object
    obj.name, obj.parent = name, root
    obj.rotation_euler = Vector(normal).to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(mat)
    obj.data.use_auto_smooth = True
    mod = obj.modifiers.new('Machined rim', 'BEVEL')
    mod.width, mod.segments = .0025, 2
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj


def line(name, points, radius=.0018, mat=seam):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions, curve.resolution_u = '3D', 1
    curve.bevel_depth, curve.bevel_resolution = radius, 2
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for p, xyz in zip(spline.points, points):
        p.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.parent = root
    curve.materials.append(mat)
    return obj


def ring(name, outer, inner, extrusion, mat, bevel=.003):
    n = len(outer)
    if n != len(inner):
        raise ValueError('Ring contours must have the same vertex count')
    ext = Vector(extrusion)
    verts = list(outer) + list(inner)
    verts += [tuple(Vector(p)+ext) for p in verts]
    faces = []
    for i in range(n):
        j = (i+1) % n
        faces += [(i,j,n+j,n+i), (i+2*n,n+i+2*n,n+j+2*n,j+2*n),
                  (i,i+2*n,j+2*n,j), (n+i,n+j,n+j+2*n,n+i+2*n)]
    return mesh(name, verts, faces, mat, bevel)


def closed_surface(name, front, rows, cols, thickness, mat, smooth=False):
    """Close a sampled front surface with its rear and boundary walls."""
    n=len(front)
    verts=front+[(x,y+thickness,z) for x,y,z in front]
    faces=[(i*cols+j,i*cols+j+1,(i+1)*cols+j+1,(i+1)*cols+j)
           for i in range(rows-1) for j in range(cols-1)]
    faces += [tuple(index+n for index in reversed(face)) for face in list(faces)]
    boundary=list(range(cols))+[i*cols+cols-1 for i in range(1,rows)]
    boundary+=list(range(n-2,n-cols-1,-1))+[i*cols for i in range(rows-2,0,-1)]
    for a,b in zip(boundary,boundary[1:]+boundary[:1]):
        faces.append((a,b,b+n,a+n))
    return mesh(name,verts,faces,mat,.004,smooth)


# The helmet is a sampled curved shell. Physical .004-unit seams separate its
# horizontal courses; normals remain smooth within each double-curved panel.
PROFILE = [(.34,.45,-.27,.56,84), (.50,.61,-.43,.71,84),
           (.70,.70,-.54,.79,84), (.94,.72,-.58,.81,80),
           (1.12,.70,-.57,.79,65), (1.31,.64,-.51,.73,30),
           (1.46,.46,-.42,.64,12), (1.58,.32,-.29,.50,0),
           (1.66,.18,-.12,.34,0), (1.70,.06,.09,.17,0)]


def profile(z):
    for i,(a,b) in enumerate(zip(PROFILE, PROFILE[1:])):
        if a[0] <= z <= b[0]+1e-8:
            t = (z-a[0])/(b[0]-a[0])
            p=PROFILE[max(0,i-1)];q=PROFILE[min(len(PROFILE)-1,i+2)]
            dz=b[0]-a[0]
            result=[]
            for k in range(1,5):
                da=(b[k]-p[k])/(b[0]-p[0]);db=(q[k]-a[k])/(q[0]-a[0])
                value=(2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*dz*da
                value+=(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*dz*db
                result.append(max(0,value) if k in (1,4) else value)
            return tuple(result)
    return PROFILE[0][1:] if z < PROFILE[0][0] else PROFILE[-1][1:]


def shell_point(z, u, side):
    rx, yf, yb, opening = profile(z)
    a = math.radians(opening+(180-opening)*u)
    return (side*rx*math.sin(a), (yf+yb)/2-(yb-yf)/2*math.cos(a), z)


for s,side in ((-1,'L'),(1,'R')):
    for course in range(3):
        for sector,(u0,u1) in enumerate(((0,.85),(.854,1))):
            verts=[]
            for i in range(25):
                t=i/24
                for j in range(33):
                    u=u0+(u1-u0)*j/32
                    bounds=(.34,1.00+.25*u,1.34+.17*u,1.70)
                    low=bounds[course]+(.002 if course else 0)
                    high=bounds[course+1]-(.002 if course<2 else 0)
                    verts.append(shell_point(low+(high-low)*t,u,s))
            faces = [(i*33+j,i*33+j+1,(i+1)*33+j+1,(i+1)*33+j)
                     for i in range(24) for j in range(32)]
            obj = mesh(side+' helmet course %d panel %d' % (course,sector),verts,faces,white,.002,True)
            solid = obj.modifiers.new('Armor thickness', 'SOLIDIFY')
            solid.thickness = .018

# Neck is short and mostly shrouded, as in the reference.
cylinder('Neck spherical pivot', (0,.13,.24), .260,.37,dark)
cylinder('Neck bottom flange', (0,.13,.080), .330,.160,dark)
for i in range(12):
    a = math.tau*i/12
    obj=box('Neck collar segment %02d'%i,(.313*math.cos(a),.13+.313*math.sin(a),.08),(.10,.045,.13),metal,.006)
    obj.rotation_euler[2] = a+math.pi/2
box('Mandible internal structure',(0,-.12,.48),(.72,.68,.42),dark,.07)
box('Face internal bridge',(0,-.39,.77),(.67,.25,.42),black,.025)
plate('Neck front armored trapezoid',[(-.10,-.126,.34),(.10,-.126,.34),
      (.13,-.160,.17),(-.13,-.160,.17)],.030,dark,.010)

# A closed, curved crest with sloping shoulders follows the helmet crown.
# Top and lower shoulder widths differ: this is a volume, not a vertical fin.
SPINE=[(-.36,1.825,.115,1.46,.155),(-.21,1.80,.12,1.59,.16),
       (.10,1.78,.13,1.66,.16),(.43,1.67,.13,1.57,.16),
       (.68,1.47,.13,1.36,.16),(.79,1.26,.115,1.10,.14)]


def spine_section(y):
    for i,(a,b) in enumerate(zip(SPINE,SPINE[1:])):
        if a[0]<=y<=b[0]+1e-8:
            t=(y-a[0])/(b[0]-a[0]);dy=b[0]-a[0]
            prev=SPINE[max(0,i-1)];nxt=SPINE[min(len(SPINE)-1,i+2)]
            values=[]
            for k in range(1,5):
                da=(b[k]-prev[k])/(b[0]-prev[0]);db=(nxt[k]-a[k])/(nxt[0]-a[0])
                value=(2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*dy*da
                value+=(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*dy*db
                values.append(value)
            return values
    raise ValueError('Crest section out of bounds')


for tile,(start,end) in enumerate(((-.36,.10),(.10,.55),(.55,.79))):
    vertices=[]
    for i in range(25):
        y=start+.0015+(end-start-.003)*i/24
        z,wt,zb,wb=spine_section(y)
        vertices += [(-wt,y,z),(wt,y,z),(wb,y,zb+.018),
                     (wb-.018,y,zb),(-wb+.018,y,zb),(-wb,y,zb+.018)]
    faces=[tuple(reversed(range(6))),tuple(range(144,150))]
    faces += [(i*6+j,i*6+(j+1)%6,(i+1)*6+(j+1)%6,(i+1)*6+j)
              for i in range(24) for j in range(6)]
    mesh('Crown swept spine tile %02d'%tile,vertices,faces,white,.005,True)


housing=constraints['sensorHousing']


def hood_point(x,z,offset=0):
    z+=housing['hoodTopZ']-1.740
    t=(z-housing['hoodLegBottomZ'])/(housing['hoodTopZ']-housing['hoodLegBottomZ'])
    y=housing['hoodFrontYAtBottom']*(1-t)+housing['hoodFrontYAtTop']*t
    return (x,y+offset,z+max(0,offset)*housing['hoodRoofSlope'])


def sensor_point(x,z,offset=0):
    return (x,housing['podCenterY']+.25*(z-1.50)+offset,z+housing['podVerticalOffset'])


# A short, open-bottom hood shelters a separate projecting optical pod.
# Its stacked roof/hood/pod silhouette follows the primary view, rather than
# stretching one rectangular frame from the crown down to the red crest.
prism('Sensor hood | upper beam',[hood_point(-.105,1.740),hood_point(.105,1.740),
      hood_point(.112,1.680,-.009),hood_point(-.112,1.680,-.009)],
      (0,.135,.135*housing['hoodRoofSlope']),white,.010)
for s,side in ((-1,'L'),(1,'R')):
    prism(side+' sensor hood | short leg',[hood_point(s*.105,1.735),hood_point(s*.075,1.674,-.008),
          hood_point(s*.100,1.485),hood_point(s*.133,1.485)],
          (0,.105,.105*housing['hoodRoofSlope']),white,.009)
    plate(side+' sensor lower shoulder',[(s*.100,-.580,housing['hoodLegBottomZ']),(s*.133,-.580,housing['hoodLegBottomZ']),
          (s*.145,-.700,1.215),(s*.100,-.680,1.215),(s*.100,-.600,1.360)],.080,white,.007)
prism('Forehead roof | hood-to-crown transition',[hood_point(-.105,1.740,.125),
      hood_point(.105,1.740,.125),(.115,-.36,1.825),(-.115,-.36,1.825)],(0,0,-.045),white,.007)
plate('Forehead sensor recessed well',[(-.120,-.490,1.695),(.120,-.490,1.695),
      (.128,-.595,1.330),(-.128,-.595,1.330)],.045,black,.008)
plate('Forehead lower bridge',[(-.140,-.620,1.352),(.140,-.620,1.352),
      (.145,-.700,1.215),(-.145,-.700,1.215)],.075,white,.007)
pod_outline=[(-.072,1.600),(.072,1.600),(.095,1.577),(.095,1.390),
             (.073,1.365),(-.073,1.365),(-.095,1.390),(-.095,1.577)]
plate('Optical pod | deep body',[sensor_point(x,z) for x,z in pod_outline],
      housing['podBackDepth'],dark,.006)
for name,w,z0,z1,offset,mat in [('Optical pod | machined bezel',.068,1.405,1.562,-.004,metal),
                              ('Optical pod | lens',.055,1.420,1.547,-.014,blue)]:
    plate(name,[sensor_point(-w,z0,offset),sensor_point(w,z0,offset),
          sensor_point(w,z1,offset),sensor_point(-w,z1,offset)],.012,mat,.010)

# Reconstruct symmetric part cross sections from the chosen source projection.
# A single view cannot determine all depths: the locked camera and bilateral
# symmetry supply the remaining constraints; hidden sections are explicit.
def solve_reference_row(record):
    if 'world' in record:
        return record['world']
    p=constraints['projection'];k=p['pixelsPerWorldUnit']
    yaw=math.atan2(p['cameraPosition'][0],-p['cameraPosition'][1])
    elevation=math.atan2(p['cameraPosition'][2]-p['targetZ'],math.hypot(*p['cameraPosition'][:2]))
    lu,lv=[value*.512 for value in record['left']]
    ru,rv=[value*.512 for value in record['right']]
    width=(ru-lu)/(2*k*math.cos(yaw))
    edge_y=((lu+ru)/2-p['imageOriginU'])/(k*math.sin(yaw))
    edge_z=p['targetZ']+((p['imageOriginV']-(lv+rv)/2)/k-
             math.sin(elevation)*math.cos(yaw)*edge_y)/math.cos(elevation)
    result={'halfWidth':width,'edgeY':edge_y,'edgeZ':edge_z}
    if 'ridge' in record:
        u,v=[value*.512 for value in record['ridge']]
        ridge_y=(u-p['imageOriginU'])/(k*math.sin(yaw))
        ridge_z=p['targetZ']+((p['imageOriginV']-v)/k-
                   math.sin(elevation)*math.cos(yaw)*ridge_y)/math.cos(elevation)
        result.update(ridgeY=ridge_y,ridgeZ=ridge_z)
    return result


MASK_ROWS=[solve_reference_row(row) for row in constraints['faceMaskRows']]
center_width=constraints['faceMaskCenterHalfWidth']
verts=[]
for row in MASK_ROWS:
    w,ey,cy,ez,cz=[row[key] for key in ('halfWidth','edgeY','ridgeY','edgeZ','ridgeZ')]
    verts += [(-w,ey,ez),(-center_width,cy,cz),(center_width,cy,cz),(w,ey,ez)]
faces=[(i*4+j,i*4+j+1,(i+1)*4+j+1,(i+1)*4+j) for i in range(3) for j in range(3)]
n=len(verts)
verts += [(x,y+.032,z) for x,y,z in verts]
front_faces=list(faces)
faces += [tuple(i+n for i in reversed(face)) for face in front_faces]
boundary=[0,1,2,3,7,11,15,14,13,12,8,4]
for a,b in zip(boundary,boundary[1:]+boundary[:1]):
    faces.append((a,b,b+n,a+n))
mask=mesh('Face mask | closed tapered armor',verts,faces,white,.006)
# Section widths and ridge depths vary along the jaw; triangulate the resulting
# warped quads before boolean cuts so their volume has an unambiguous surface.
bm=bmesh.new();bm.from_mesh(mask.data)
bmesh.ops.triangulate(bm,faces=list(bm.faces))
bm.to_mesh(mask.data);bm.free();mask.data.update()
# Mouth cuts follow the two planes. Cutters intersect the real shell; dark inserts
# sit inside the recess rather than floating above the white armor.
def mask_surface_y(x,z):
    samples=[]
    for row in MASK_ROWS:
        fraction=max(0,min(1,(abs(x)-center_width)/(row['halfWidth']-center_width)))
        samples.append((row['ridgeZ']+(row['edgeZ']-row['ridgeZ'])*fraction,
                        row['ridgeY']+(row['edgeY']-row['ridgeY'])*fraction))
    for (za,ya),(zb,yb) in zip(samples,samples[1:]):
        if zb<=z<=za:
            t=(z-zb)/(za-zb)
            return ya*t+yb*(1-t)
    return samples[0][1] if z>samples[0][0] else samples[-1][1]


for z in constraints['mouthSlots']['crestHeights']:
    for s in (-1,1):
        flat=constraints['mouthSlots']['flatHalfWidth']
        outline=[(0,z+.009),(s*flat,z+.009),(s*.085,z-.028),
                 (s*.085,z-.048),(s*flat,z-.011),(0,z-.011)]
        points=[(x,mask_surface_y(x,pz)-.025,pz) for x,pz in outline]
        cutter=plate('Temporary mouth cutter',points,.13,black,.001)
        bpy.context.view_layer.objects.active=mask
        for mod in list(mask.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        cut=mask.modifiers.new('Recessed mouth slot','BOOLEAN'); cut.operation='DIFFERENCE'
        cut.solver='EXACT'; cut.object=cutter
        bpy.ops.object.modifier_apply(modifier=cut.name)
        bpy.data.objects.remove(cutter,do_unlink=True)
        plate('Mouth dark interior %s %.3f'%(s,z),[(x,y+.038,pz) for x,y,pz in points],.010,black,.001)
# The mask ends around the separate chin keel rather than covering its upper
# face with the center ridge. The socket remains behind the red armor.
notch=[(-.068,.486),(.068,.486),(.098,.310),(.060,.160),(-.060,.160),(-.098,.310)]
cutter=plate('Temporary chin socket cutter',[(x,-1.2,z) for x,z in notch],.75,black,.004)
bpy.context.view_layer.objects.active=mask
cut=mask.modifiers.new('Open chin socket','BOOLEAN');cut.operation='DIFFERENCE'
cut.solver='EXACT';cut.object=cutter
bpy.ops.object.modifier_apply(modifier=cut.name)
bpy.data.objects.remove(cutter,do_unlink=True)
# Raised chin pad framing the independent red piece.
chin=constraints['chinAssembly']
def chin_points(points):
    return [(x,y+chin['depthOffset'],z+chin['verticalOffset']) for x,y,z in points]
plate('Chin white socket',chin_points([(-.087,-.764,.494),(.087,-.764,.494),
      (.10,-.75,.36),(.065,-.70,.29),(-.065,-.70,.29),(-.10,-.75,.36)]),.06,edge)
chin_outline=[(-.060,-.810,.472),(.060,-.810,.472),(.082,-.845,.31),
              (.043,-.788,.175),(-.043,-.788,.175),(-.082,-.845,.31)]
plate('Red chin keel',chin_points(chin_outline),.13,red,.007)
line('Chin highlight ridge',chin_points([(0,-.818,.456),(0,-.852,.32),(0,-.795,.20)]),.002,red)

for s,side in ((-1,'L'),(1,'R')):
    def m(points): return [(s*x,y,z) for x,y,z in points]
    orbital=constraints['orbitalAssembly']
    p=constraints['projection'];k=p['pixelsPerWorldUnit']
    yaw=math.atan2(p['cameraPosition'][0],-p['cameraPosition'][1])
    elevation=math.atan2(p['cameraPosition'][2]-p['targetZ'],math.hypot(*p['cameraPosition'][:2]))

    def primary_point_at_y(pixel,y):
        u,v=pixel[0]*.512,pixel[1]*.512
        x=((u-p['imageOriginU'])/k-math.sin(yaw)*y)/math.cos(yaw)
        z=p['targetZ']+((p['imageOriginV']-v)/k+math.sin(elevation)*math.sin(yaw)*x-
                         math.sin(elevation)*math.cos(yaw)*y)/math.cos(elevation)
        return x,y,z

    def eye_point(pixel,depth=0):
        u=pixel[0]*.512
        base=orbital['planeBackY']+depth;slope=orbital['planeSlopeYPerX']
        x=((u-p['imageOriginU'])/k-math.sin(yaw)*base)/(math.cos(yaw)+math.sin(yaw)*slope)
        point=primary_point_at_y(pixel,base+slope*x)
        return s*point[0],point[1],point[2]

    plate(side+' deep eye housing',[eye_point(pixel) for pixel in orbital['housing']],.085,amber_frame,.006)
    plate(side+' orbital black bezel',[eye_point(pixel,-.006) for pixel in orbital['blackBezel']],.018,black,.004)
    plate(side+' amber optical lens',[eye_point(pixel,-.014) for pixel in orbital['lens']],.012,eye,.005)
    rim=[eye_point(pixel,-.003) for row in (orbital['lowerRimTop'],orbital['lowerRimBottom']) for pixel in row]
    closed_surface(side+' lower orbital ceramic rim',rim,2,3,.060,white)
    # A closed, swept forehead volume replaces disconnected flat eyebrow and
    # temple plates. Its front leans rearward into the continuous helmet dome.
    lower=[primary_point_at_y((px,py),depth) for px,py,depth in orbital['lowerBrow']]
    upper=[(.150,-.615,1.28),(.20,-.515,1.43),(.30,-.380,1.49),
           (.48,-.320,1.36),(.55,-.01,1.35),(.62,.135,1.24)]
    front=[]
    for i in range(9):
        t=i/8
        for col,(lo,hi) in enumerate(zip(lower,upper)):
            lo,hi=Vector(lo),Vector(hi)
            mid=(lo+hi)/2;mid.y-=.035
            if col==3:mid=Vector((.425,-.430,1.140))
            control=2*mid-(lo+hi)/2
            point=(1-t)**2*lo+2*t*(1-t)*control+t*t*hi
            front+=m([tuple(point)])
    closed_surface(side+' volumetric visor and temple',front,9,6,.105,white,True)
    rim=[]
    for x,y,z in lower:
        rim+=m([(x,y-.005,z+.014),(x,y-.004,z-.015)])
    closed_surface(side+' heavy visor edge',rim,6,2,.063,white)
    # Front cheek guard follows the orbital rim to the jaw in several facets.
    rows=[solve_reference_row(row) for row in constraints['cheekGuardFrontEdge']]
    cross=constraints['cheekGuardInferredCrossSection']
    vs=[]
    for i,row in enumerate(rows):
        x,y,z=[row[key] for key in ('halfWidth','edgeY','edgeZ')]
        rise=cross['upperOuterRise'] if i==0 else cross['outerRise']
        vs += m([(x,y,z),(x+cross['ridgeWidth'],y-.014,z+.010),
                 (x+cross['outerWidth'],y+cross['outerDepthOffset'],z+rise)])
    fs=[(i*3+j,i*3+j+1,(i+1)*3+j+1,(i+1)*3+j) for i in range(len(rows)-1) for j in range(2)]
    guard=mesh(side+' cheek guard | folded long plate',vs,fs,white,.004,True)
    solid=guard.modifiers.new('Cheek guard thickness','SOLIDIFY');solid.thickness=.055
    # Cheek vent plane turns around the face in plan. A real ring, four dark
    # openings and three slats preserve depth in both front and side views.
    normal=Vector((s*.823,-.568,0))
    vent=constraints['cheekVent']
    def vp(u,z,offset=0,normal=normal):
        return tuple(Vector((s*(.320+.390*u),-.625+.565*u,z))+
                     normal*(offset+vent['moduleStandOff']))

    def vent_coordinates(pixel,offset=0):
        p=constraints['projection'];k=p['pixelsPerWorldUnit']
        yaw=math.atan2(p['cameraPosition'][0],-p['cameraPosition'][1])
        elevation=math.atan2(p['cameraPosition'][2]-p['targetZ'],math.hypot(*p['cameraPosition'][:2]))
        target_u,target_v=pixel[0]*.512,pixel[1]*.512
        low,high=-.5,1.5
        for _ in range(30):
            u=(low+high)/2;point=vp(u,0,offset)
            projected=p['imageOriginU']+k*(math.cos(yaw)*abs(point[0])+math.sin(yaw)*point[1])
            if projected<target_u:low=u
            else:high=u
        u=(low+high)/2;x,y,_=vp(u,0,offset)
        z=p['targetZ']+((p['imageOriginV']-target_v)/k+
            math.sin(elevation)*math.sin(yaw)*abs(x)-math.sin(elevation)*math.cos(yaw)*y)/math.cos(elevation)
        return u,z

    uv_outer=[vent_coordinates(pixel) for pixel in vent['outer']]
    uv_inner=[vent_coordinates(pixel) for pixel in vent['inner']]
    outer=[vp(u,z) for u,z in uv_outer];inner=[vp(u,z) for u,z in uv_inner]
    ring(side+' louver armored frame',outer,inner,tuple(-normal*vent['frameWallDepth']),white,.006)
    cheek_wall=[]
    for i,row in enumerate(rows):
        t=i/(len(rows)-1)
        frame_edge=Vector(outer[0]).lerp(Vector(outer[-1]),t)
        cheek_wall+=m([(row['halfWidth']+cross['outerWidth'],
                       row['edgeY']+cross['outerDepthOffset'],
                       row['edgeZ']+(cross['upperOuterRise'] if i==0 else cross['outerRise']))])
        cheek_wall.append(tuple(frame_edge))
    closed_surface(side+' intake front cheek wall',cheek_wall,len(rows),2,.055,white)
    # A discrete faceted casing joins the raised intake to the shell. Its
    # front shoulder remains a crease instead of flowing into the helmet.
    junction_rows=[(*uv_outer[2],.220,uv_outer[2][1]+.12),
                   (*uv_outer[3],.240,uv_outer[3][1]+.08),
                   (*uv_outer[4],.200,uv_outer[4][1]+.10)]
    connection=[]
    for row in range(3):
        position=row;index=min(1,int(position));blend=position-index
        a=junction_rows[index];b=junction_rows[index+1]
        u,z,rear_y,rear_z=[av*(1-blend)+bv*blend for av,bv in zip(a,b)]
        anchor=Vector(vp(u,z,-.005))
        rx,yf,yb,_=profile(rear_z)
        rear_x=rx*math.sqrt(max(0,1-((rear_y-(yf+yb)/2)/((yb-yf)/2))**2))+.025
        rear=Vector((s*rear_x,rear_y,rear_z))
        shoulder=anchor-normal*.070
        for point in (anchor,shoulder,rear):
            connection.append(tuple(point))
    closed_surface(side+' cheek pod to helmet junction',connection,3,3,.045,white)
    duct_front=[];duct_back=[]
    for pixel in vent['inner']:
        u,z=vent_coordinates(pixel,-.004)
        duct_front.append(vp(u,z,-.004))
        u,z=vent_coordinates(pixel,-vent['ductDepth'])
        duct_back.append(vp(u,z,-vent['ductDepth']))
    count=len(duct_front)
    duct_faces=[tuple(range(count,2*count))]
    duct_faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    duct=mesh(side+' louver cavity liner',duct_front+duct_back,duct_faces,black,.001)
    solid=duct.modifiers.new('Intake duct wall thickness','SOLIDIFY');solid.thickness=.012
    prism(side+' louver cavity backing',duct_back,tuple(-normal*.025),black,.001)
    for k,points in enumerate(vent['vanes']):
        top=[]
        for px,py,depth in points:
            u,z=vent_coordinates((px,py),depth)
            top.append(vp(u,z,depth))
        bottom=[(x,y,z-(vent['vaneTipThickness'] if i==0 else vent['vaneRootThickness']))
                for i,(x,y,z) in enumerate(top)]
        verts=top+bottom
        faces=[(0,1,2,3),(7,6,5,4)]+[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)]
        mesh(side+' tapered diagonal louver %d'%k,verts,faces,white,.002)
    # Shoulder joins the vent surround to the temple, including its inset slot.
    lid=[]
    for row in (vent['shoulderLower'],vent['shoulderUpper']):
        for pixel in row:
            u,z=vent_coordinates(pixel,.007)
            lid.append(vp(u,z,.007))
    # The anatomical shell continues under the temple plate down to the intake
    # roof. Correcting the intake location must not leave an empty black gap.
    temple_edge=m(lower[-3:])
    roof_edge=lid[3:]
    bridge=[]
    for i in range(9):
        t=i/8
        for j in range(17):
            column=j/16*2;index=min(1,int(column));weight=column-index
            a=Vector(temple_edge[index]).lerp(Vector(temple_edge[index+1]),weight)
            b=Vector(roof_edge[index]).lerp(Vector(roof_edge[index+1]),weight)
            bridge.append(tuple(a.lerp(b,t)))
    closed_surface(side+' temple-to-intake shell',bridge,9,17,.080,white,True)
    # Close the lateral end of the brow sweep. The lower bridge alone leaves
    # a side opening above the intake roof, exposing the posterior inner shell.
    px,py,depth=vent['sideCasingRows'][0][-1]
    u,z=vent_coordinates((px,py),depth)
    rear_corner=vp(u,z,depth)
    a,b=Vector(m([lower[-1]])[0]),Vector(m([upper[-1]])[0])
    c,d=Vector(rear_corner),Vector(lid[-1])
    outward=Vector((s*3,-8,1.16)).normalized()
    rear_surface=[]
    for row in range(9):
        t=row/8
        for col in range(9):
            u=col/8
            point=a.lerp(b,t).lerp(d.lerp(c,t),u)
            point+=outward*(vent['rearTempleBulge']*math.sin(math.pi*t)*math.sin(math.pi*u))
            rear_surface.append(tuple(point))
    closed_surface(side+' volumetric visor rear closure',rear_surface,9,9,.080,white,True)
    shoulder=closed_surface(side+' vent upper shoulder',lid,2,3,.080,white)
    slot_uv=[vent_coordinates(pixel) for pixel in vent['serviceSlot']]
    slot=[vp(u,z,.080) for u,z in slot_uv]
    cutter=prism('Temporary shoulder slot cutter',slot,tuple(-normal*.18),black,0)
    bpy.context.view_layer.objects.active=shoulder
    for modifier in list(shoulder.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    cut=shoulder.modifiers.new('Inset service slot','BOOLEAN')
    cut.operation='DIFFERENCE';cut.solver='EXACT';cut.object=cutter
    bpy.ops.object.modifier_apply(modifier=cut.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    prism(side+' shoulder slot dark bed',[vp(u,z,-.014) for u,z in slot_uv],tuple(-normal*.01),black,.001)
    # Three sectional bands define the intake's angular side casing. A broad
    # lateral panel and a separate rear turn replace the ellipsoid-following skin.
    pod_front=[]
    for section in vent['sideCasingRows']:
        for px,py,depth in section:
            u,z=vent_coordinates((px,py),depth)
            pod_front.append(vp(u,z,depth))
    closed_surface(side+' faceted temporal armor',pod_front,3,2,.060,white)
    plate(side+' nape skirt',m([(.535,.39,.60),(.565,.64,.66),
          (.48,.66,.29),(.35,.44,.30)]),.045,white,.006)
    jaw_sections=[(-.44,.19,.28,.23,.38),(-.30,.25,.50,.35,.50),
                  (0,.34,.66,.41,.58),(.20,.40,.67,.48,.61)]
    jaw_verts=[]
    for y,xi,xo,zb,zt in jaw_sections:
        jaw_verts+=m([(xi,y,zb),(xo,y,zb),(xo,y,zt),(xi,y,zt)])
    jaw_faces=[(0,3,2,1),(12,13,14,15)]
    jaw_faces += [(i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j)
                  for i in range(3) for j in range(4)]
    mesh(side+' lower cheek to skull volume',jaw_verts,jaw_faces,white,.008,True)
    # Temple port above and behind the eye line, not a large headphone disc.
    normal=Vector((s*.88,-.47,.02))
    center=Vector((s*.435,-.435,1.145))
    cylinder(side+' temple ceramic surround',tuple(center-normal*.009),.067,.030,white,normal)
    cylinder(side+' temple inset',tuple(center),.052,.023,dark,normal)
    cylinder(side+' temple steel rim',tuple(center+normal*.015),.038,.012,metal,normal)
    cylinder(side+' temple dark center',tuple(center+normal*.023),.024,.006,black,normal)
    # Flat upper-temple shoulder linking the brow with the helmet shell.
    line(side+' temple engraved division',m([(.29,-.444,1.33),(.36,-.402,1.28),
          (.43,-.389,1.27)]),.0018)
    for index,pixel in enumerate(((561,499),(554,694),(714,510))):
        u,z=vent_coordinates(pixel,.009)
        cylinder(side+' cheek flush screw %d'%index,vp(u,z,.009),.009,.005,metal,(s*.823,-.568,0),16)
    for x,y,z in ((.51,.66,.37),):
        cylinder(side+' armor screw %.2f'%z,(s*x,y,z),.008,.006,dark,(s,0,0),16)
    for row in (rows[0],rows[2]):
        x,y,z=row['halfWidth']+.020,row['edgeY']-.010,row['edgeZ']-.020
        cylinder(side+' cheek guard countersink %.2f'%z,(s*x,y+.002,z),.013,.006,edge,(0,-1,0),24)
        cylinder(side+' cheek guard fastener %.2f'%z,(s*x,y-.002,z),.0075,.006,metal,(0,-1,0),16)
    # Thin quadrilateral roots plus tapered ridge faces give each fin a blade
    # cross-section, avoiding the thick spike silhouette of the first draft.
    for tag,outline in [('outer',[(.07,-.755,.975),(.16,-.748,.905),
                                 (.31,-.695,1.055),(1.005,-.40,1.93)]),
                        ('inner',[(.182,-.662,1.095),(.249,-.640,1.075),
                                  (.370,-.32,2.045)])]:
        fin=plate(side+' V-fin '+tag,m(outline),.020,gold,.001)
        fin.data.materials.append(gold_edge)
        for p in fin.data.polygons:
            if p.index>1:p.material_index=1
        if tag=='outer':
            line(side+' fin central arris',m([(.20,-.758,1.015),(1.003,-.410,1.928)]),.0017,gold_edge)

plate('Red forehead central keystone',[(-.140,-.776,1.236),(.140,-.776,1.236),
      (.125,-.861,.955),(0,-.908,.790),(-.125,-.861,.955)],.16,red,.006)
for x,z in ((-.110,1.20),(.110,1.20),(-.075,.955),(.075,.955)):
    y=-.776-(1.236-z)*(.085/(1.236-.955))-.008
    cylinder('Forehead flush fastener',(x,y,z),.009,.005,metal,(0,-1,0),16)

# Back shell follows the generated back view. These are explicitly inferred.
for s,side in ((-1,'L'),(1,'R')):
    def rear_point(x,z):
        rx,yf,yb,_=profile(z)
        y=(yf+yb)/2+(yb-yf)/2*math.sqrt(max(0,1-(x/rx)**2))+.005
        return (s*x,y,z)
    line(side+' rear lower division',[rear_point(x,z) for x,z in
         ((.012,.65),(.15,.64),(.28,.63),(.39,.71))],.0022)
    box(side+' rear service notch',(s*.155,.81,1.09),(.032,.018,.065),dark,.003)
box('Rear central locking tab',(0,.814,.63),(.13,.036,.09),edge,.004)
box('Rear spine inset',(0,.745,1.36),(.14,.065,.14),black,.007)
box('Rear optical glass',(0,.783,1.37),(.10,.014,.072),blue,.005)
box('Rear neck vent well',(0,.59,.34),(.39,.16,.25),black,.015)
for k in range(4):
    box('Rear neck cooling blade %d'%k,(0,.689,.245+k*.055),(.35,.044,.018),edge,.003)

# Exported GLB must contain the physical seam geometry too. Keep the reusable
# path definitions in this source, then convert their evaluated curves to mesh.
bpy.ops.object.select_all(action='DESELECT')
curves=[o for o in root.children if o.type=='CURVE']
for obj in curves:obj.select_set(True)
if curves:
    bpy.context.view_layer.objects.active=curves[0]
    bpy.ops.object.convert(target='MESH')

# Macro calibration from the front/side body outlines. Front facial depth and
# the V-fin retain their coordinates. The occiput is shortened independently;
# upper helmet width/height taper without scaling the whole head flat.
for obj in root.children:
    if obj.type!='MESH':
        continue
    world=obj.matrix_world.copy();inverse=world.inverted()
    neck=obj.name.startswith('Neck')
    upper_shell=any(tag in obj.name for tag in
                    ('helmet course','volumetric visor','faceted temporal armor'))
    for vertex in obj.data.vertices:
        point=world@vertex.co
        if neck:
            point.y-=.245
            vertex.co=inverse@point
            continue
        if upper_shell and point.z>1.15:
            taper=max(0,min(1,(point.z-1.15)/.45))
            point.x*=1-.20*taper
            point.z=1.15+(point.z-1.15)*.80
        if obj.name.startswith('Crown swept spine'):
            if vertex.index%6>=2:
                point.z=1.15+(point.z-1.15)*.78
            elif point.y>-.20:
                blend=max(0,min(1,(point.y+.20)/.40))
                blend=blend*blend*(3-2*blend)
                point.z=1.15+(point.z-1.15)*(1-.15*blend)
        if point.y>0:
            point.y*=.80
        vertex.co=inverse@point
    obj.data.update()

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.eevee.use_gtao=True
scene.eevee.gtao_distance=.35
scene.eevee.gtao_factor=1.25
scene.eevee.use_soft_shadows=True
scene.eevee.taa_render_samples=128
scene.view_settings.view_transform='Filmic'
scene.view_settings.look='Medium High Contrast'
scene.view_settings.exposure=0
scene.view_settings.gamma=1
scene.render.resolution_x=1000
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.compression=30
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.20,.20,.20,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.5


def aim(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


for name,loc,power,size in [('Key',(-3,-4,6),380,4),('Fill',(4,-2,3),180,3),('Rim',(1,4,5),300,3)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
    obj.location=loc;aim(obj,(0,0,1))
data=bpy.data.cameras.new('Review camera')
camera=bpy.data.objects.new('Review camera',data)
scene.collection.objects.link(camera);scene.camera=camera
camera.data.type='ORTHO';camera.data.ortho_scale=2.5
views={'front':(0,-8,1.04),'three-quarter':(3,-8,2.2),'side':(8,0,1.04),
       'rear-three-quarter':(5,8,2.2),'back':(0,8,1.04),'top':(0,-.001,10)}
# Make the editable file open on a framed material-preview view, rather than the
# factory cube viewport. Nothing is hidden in the modeling workspace.
camera.location=views['three-quarter'];aim(camera,(0,0,1.04))
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            space=area.spaces.active
            space.region_3d.view_location=(0,0,1.03)
            space.region_3d.view_distance=4.7
            space.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
            space.region_3d.view_perspective='PERSP'
            space.lens=65
            space.shading.type='SOLID'
            space.shading.color_type='SINGLE'
            space.shading.single_color=(.65,.65,.65)
            space.overlay.show_floor=False
            space.overlay.show_extras=False
bpy.ops.object.select_all(action='DESELECT')
for obj in root.children:obj.select_set(True)
root.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(OUT/'freedom-head.glb'),use_selection=True,export_format='GLB')
camera.location=views['three-quarter'];aim(camera,(0,0,1.04))
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'freedom-head.blend'))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'freedom-head-red-armor-v19.blend'))
for name,loc in views.items():
    camera.location=loc;aim(camera,(0,0,1.04))
    scene.render.filepath=str(OUT/'renders'/(name+'.png'))
    bpy.ops.render.render(write_still=True)
clay=material('Review | neutral clay',(.40,.40,.40),0,.65)
scene.view_layers[0].material_override=clay
for obj in root.children:
    if obj.type=='MESH':
        obj.data.materials.clear();obj.data.materials.append(clay)
        for polygon in obj.data.polygons:
            polygon.material_index=0
for name in ('front','side','three-quarter'):
    camera.location=views[name];aim(camera,(0,0,1.04))
    scene.render.filepath=str(OUT/'renders'/('clay-'+name+'.png'))
    bpy.ops.render.render(write_still=True)
for obj in root.children:
    if 'V-fin' in obj.name or 'fin central arris' in obj.name:
        obj.hide_render=True
scene.render.film_transparent=True
scene.render.image_settings.color_mode='RGBA'
for name in ('front','side'):
    camera.location=views[name];aim(camera,(0,0,1.04))
    scene.render.filepath=str(OUT/'renders'/('silhouette-'+name+'.png'))
    bpy.ops.render.render(write_still=True)
manifest={'revision':19,'reference':'reference/head-six-views.png','coordinateSystem':'X right, -Y front, Z up',
          'partConstraints':'reference/part-constraints.json',
          'primaryReferenceView':'generated three-quarter (user selected)',
          'reviewCameraPositions':views,
          'macroCalibration':{'posteriorDepthScale':.80,'upperHelmetWidthScaleAtTop':.80,
                              'upperHelmetHeightScale':.80,'neckForwardOffset':.245,
                              'frontFacialDepthPreserved':True},
          'modelingUnitsPerReferencePixel':.005,'objects':len(root.children),
          'parts':[{'name':o.name,'type':o.type} for o in root.children],
          'views':list(views),'limitations':['Generated views are not exact orthographic measurements.',
                  'Rear/top details are inferred; live page integration is not yet performed.']}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('HEAD_BUILD_OK',len(root.children),'parts',OUT)
