# Builds two models for the jump off the roof:
#   chute.glb  - a canopy with lines and a harness bar
#   city.glb   - a block of rooftops to fall towards
import bpy, math, os, random
D=bpy.data; C=bpy.context
OUT=os.path.dirname(os.path.abspath(__file__))

def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough=.8, metal=0.0, emit=None, alpha=1.0):
    m=D.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*rgb,1)
    b.inputs['Roughness'].default_value=rough
    b.inputs['Metallic'].default_value=metal
    if emit:
        b.inputs['Emission Color'].default_value=(*emit,1)
        b.inputs['Emission Strength'].default_value=1.2
    if alpha<1.0:
        b.inputs['Alpha'].default_value=alpha; m.blend_method='BLEND'
    return m

def export(name):
    bpy.ops.object.select_all(action='SELECT')
    p=os.path.join(OUT,name)
    bpy.ops.export_scene.gltf(filepath=p, export_format='GLB', export_apply=True, export_yup=True)
    return p, os.path.getsize(p)

# ── the parachute ───────────────────────────────────────────────────────────
fresh()
CAN=mat('canopy',(0.85,0.30,0.18),.85)
CAN2=mat('canopy_dark',(0.13,0.14,0.19),.85)
CORD=mat('cord',(0.75,0.76,0.80),.6)

# a canopy: half a sphere squashed, with a vent at the top
bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=20, ring_count=10, location=(0,0,0))
c=C.object; c.name='canopy'
import bmesh
me=c.data
bm=bmesh.new(); bm.from_mesh(me)
for v in list(bm.verts):
    if v.co.z < 0.02: bm.verts.remove(v)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(me); bm.free()
c.scale=(1.9,1.9,1.05); bpy.ops.object.transform_apply(scale=True)
c.data.materials.append(CAN)
# gores: a few darker panels so it does not read as a plain dome
bpy.ops.mesh.primitive_cylinder_add(radius=1.92, depth=0.02, vertices=20, location=(0,0,0.55))
g=C.object; g.name='band'; g.data.materials.append(CAN2)

# the lines down to a harness bar
for i in range(10):
    a=i/10*math.tau
    x,y=math.cos(a)*1.65, math.sin(a)*1.65
    bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=2.4, vertices=6, location=(x*0.5,y*0.5,-1.0))
    L=C.object; L.name='line%d'%i
    L.rotation_euler=(math.atan2(math.hypot(x,y)*0.9, 2.2)* (1 if True else 1), 0, 0)
    # aim each line from the skirt to the bar under the middle
    L.rotation_euler=(0,0,0)
    L.location=(x*0.55, y*0.55, -1.05)
    dz=2.2; dx=-x*0.55; dy=-y*0.55
    L.rotation_euler=(math.atan2(math.hypot(dx,dy),dz)*0, 0, 0)
    L.data.materials.append(CORD)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0,0,-2.2))
bar=C.object; bar.name='bar'; bar.scale=(0.5,0.06,0.05); bpy.ops.object.transform_apply(scale=True)
bar.data.materials.append(CORD)
bpy.ops.object.select_all(action='SELECT')
C.view_layer.objects.active=D.objects['canopy']
bpy.ops.object.join(); C.object.name='Chute'
p1,s1=export('chute.glb'); print('CHUTE', p1, s1, len(C.object.data.vertices))

# ── the city below ──────────────────────────────────────────────────────────
fresh()
random.seed(7)
DARK=mat('block',(0.07,0.08,0.11),.95)
ROOF=mat('roof',(0.10,0.11,0.14),.9)
LIT =mat('window',(1.0,0.78,0.42),.4,emit=(1.0,0.72,0.32))
STREET=mat('street',(0.04,0.045,0.06),1.0)

bpy.ops.mesh.primitive_plane_add(size=120, location=(0,0,-30))
C.object.name='ground'; C.object.data.materials.append(STREET)

for i in range(46):
    x=random.uniform(-46,46); y=random.uniform(-46,46)
    if abs(x)<7 and abs(y)<7: continue          # keep the middle clear to fall through
    w=random.uniform(3.2,7.5); d=random.uniform(3.2,7.5); h=random.uniform(6,26)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x,y,-30+h/2))
    b=C.object; b.name='b%d'%i; b.scale=(w,d,h); bpy.ops.object.transform_apply(scale=True)
    b.data.materials.append(DARK)
    # a lit face on some of them, a plane just proud of one wall
    if random.random()<0.75:
        s=random.choice([(0,d/2+0.05,0,0),(0,-d/2-0.05,0,math.pi),(w/2+0.05,0,math.pi/2,0),(-w/2-0.05,0,-math.pi/2,0)])
        bpy.ops.mesh.primitive_plane_add(size=1, location=(x+s[0], y+s[1], -30+h*random.uniform(.35,.8)))
        pl=C.object; pl.name='w%d'%i
        pl.rotation_euler=(math.pi/2, 0, s[2] if s[2] else s[3])
        pl.scale=(w*0.62 if s[0]==0 else d*0.62, h*random.uniform(0.10,0.28), 1)
        bpy.ops.object.transform_apply(rotation=True, scale=True)
        pl.data.materials.append(LIT)

bpy.ops.object.select_all(action='SELECT')
C.view_layer.objects.active=D.objects['ground']
bpy.ops.object.join(); C.object.name='City'
p2,s2=export('city.glb'); print('CITY', p2, s2, len(C.object.data.vertices))
