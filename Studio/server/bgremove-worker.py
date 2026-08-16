# Background-removal worker. Reads {"in": path, "out": path} on stdin, writes
# a transparent PNG, prints {"ok": true} on stdout. Kept dumb on purpose —
# bgremove.js owns the lifecycle, this owns one image.
import json
import sys


def main():
    spec = json.loads(sys.stdin.read())
    from rembg import remove  # imported late so a broken install fails loudly here

    with open(spec["in"], "rb") as f:
        src = f.read()
    result = remove(src)
    with open(spec["out"], "wb") as f:
        f.write(result)
    print(json.dumps({"ok": True}))


if __name__ == "__main__":
    main()
