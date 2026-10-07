import bpy, math, os
D=bpy.data; C=bpy.context
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough=.8, metal=0.0, emit=None):
    m=D.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*rgb,1)
    b.inputs['Roughness'].default_value=rough
    b.inputs['Metallic'].default_value=metal
    if emit:
        b.inputs['Emission Color'].default_value=(*emit,1)
        b.inputs['Emission Strength'].default_value=1.0
    return m

CANVAS=mat('canvas',(0.17,0.37,0.62),.85)
APRON =mat('apron',(0.10,0.13,0.20),.9)
SKIRT =mat('skirt',(0.06,0.07,0.11),.95)
POST  =mat('post',(0.13,0.14,0.17),.45,.6)
PAD_R =mat('pad_red',(0.62,0.12,0.13),.75)
PAD_B =mat('pad_blue',(0.13,0.28,0.68),.75)
PAD_W =mat('pad_white',(0.82,0.82,0.86),.75)
STEEL =mat('steel',(0.35,0.37,0.42),.35,.9)
STEP  =mat('step',(0.12,0.13,0.17),.85)

def box(name, sx,sy,sz, x,y,z, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x,y,z))
    o=C.object; o.name=name; o.scale=(sx,sy,sz); bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(m); return o

def cyl(name, r,h, x,y,z, m, rx=0.0, ry=0.0, verts=16):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=(x,y,z))
    o=C.object; o.name=name; o.rotation_euler=(rx,ry,0)
    bpy.ops.object.transform_apply(rotation=True)
    o.data.materials.append(m); return o

# Blender is Z-up; the game is Y-up. Build in Z-up and let the exporter convert.
# The canvas surface sits at z=0 so nothing in the game has to move.
R=2.60          # post centres, matching the rope code
HALF=2.95       # canvas half-width, a little proud of the posts

# the canvas, and the apron it sits on
box('canvas', HALF*2, HALF*2, 0.06, 0,0,-0.03, CANVAS)
box('apron',  HALF*2+0.30, HALF*2+0.30, 0.16, 0,0,-0.14, APRON)
# the skirt hanging down the sides, out of sight below the floor but there when the camera drops
for i,(dx,dy,sx,sy) in enumerate([(0,HALF+0.16,HALF*2+0.32,0.02),(0,-(HALF+0.16),HALF*2+0.32,0.02),
                                  (HALF+0.16,0,0.02,HALF*2+0.32),(-(HALF+0.16),0,0.02,HALF*2+0.32)]):
    box('skirt%d'%i, sx,sy,0.90, dx,dy,-0.67, SKIRT)

# four posts, their pads and the tie-downs
PADS={( R, R):PAD_R, (-R, R):PAD_B, ( R,-R):PAD_W, (-R,-R):PAD_R}
for (px,py),pm in PADS.items():
    cyl('post_%d_%d'%(px,py), 0.055, 1.98, px,py, 0.99, POST)
    cyl('pad_%d_%d'%(px,py), 0.135, 1.56, px,py, 0.85, pm, verts=18)
    cyl('cap_%d_%d'%(px,py), 0.075, 0.10, px,py, 1.99, STEEL)
    # turnbuckles: three little steel eyes where the ropes tie on
    for h in (0.62,1.12,1.62):
        s=0.16
        cyl('tb_%d_%d_%d'%(px,py,int(h*100)), 0.035, 0.16,
            px-(s if px>0 else -s)*0.0, py, h, STEEL, rx=math.pi/2)

# steps up to the apron on the two aisle sides
for i,(sx,sy,rot) in enumerate([(0, HALF+0.55, 0),(0, -(HALF+0.55), 0)]):
    for k in range(3):
        box('step_%d_%d'%(i,k), 1.30, 0.34, 0.22, sx, sy+(0.34*k if sy>0 else -0.34*k), -0.22-0.22*k, STEP)

# join it into one object so the game loads a single mesh
bpy.ops.object.select_all(action='SELECT')
C.view_layer.objects.active=D.objects['canvas']
bpy.ops.object.join()
C.object.name='Ring'

out=os.path.join(os.path.dirname(bpy.data.filepath) or '/tmp/claude-0/-home-user-app/2e16fdcf-b87c-5b5f-9f1c-fd657246bedf/scratchpad/blend','ring.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True)
me=C.object.data
print('RING tris', len(me.loop_triangles) if me.loop_triangles else sum(len(p.vertices)-2 for p in me.polygons), 'verts', len(me.vertices))
print('OUT', out, os.path.getsize(out))
