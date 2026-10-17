"""The "APU ISLAM" bulb-marquee billboard.

Letters are spelled in light bulbs on a 5x7 dot-matrix grid. Runtime contract: root `billboard`; one node per
letter, `letter_0` ... `letter_7`, each holding its bulbs (material `billboard_bulb`, cloned per letter at
runtime so letters can flicker independently).
"""

import math

from lib import kit

FONT = {
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "I": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
}


def build(layout):
    bb = layout["BILLBOARD"]
    x0, _, z0 = bb["position"]
    rot = bb["rotationY"]
    navy = kit.mat("billboard_back", "#1b2233", roughness=0.55)
    brass = kit.mat("billboard_brass", "#c39545", roughness=0.3, metallic=1.0)
    steel = kit.mat("billboard_steel", "#3a4049", roughness=0.45, metallic=0.8)
    bulb = kit.mat("billboard_bulb", "#fff3d6", roughness=0.25, emission="#ffcc70", strength=2.5)
    socket = kit.mat("billboard_socket", "#7d6a4a", roughness=0.5, metallic=0.6)

    text = bb["text"]
    pitch = 0.4
    cols = len(text) * 6 - 1
    width = cols * pitch + 1.6
    board_bottom = 5.6
    board_h = 7 * pitch + 1.4
    root = kit.group("billboard", x0, 0, z0, rot)

    # Board, frame, and posts are built around the origin, then parented to the rotated root.
    static = [
        kit.box("board", width, board_h, 0.3, 0, board_bottom, 0, navy, bevel=0.08),
        kit.box("frame_top", width + 0.4, 0.25, 0.45, 0, board_bottom + board_h, 0, brass, bevel=0.06),
        kit.box("frame_bottom", width + 0.4, 0.25, 0.45, 0, board_bottom - 0.25, 0, brass, bevel=0.06),
        kit.box("catwalk", width, 0.1, 1.0, 0, board_bottom - 0.6, -0.55, steel),
    ]
    for side in (-1, 1):
        static.append(kit.box(f"frame_side{side}", 0.25, board_h + 0.5, 0.45, side * (width / 2 + 0.1), board_bottom - 0.25, 0, brass, bevel=0.06))
    for px in (-width / 3, width / 3):
        static.append(kit.box(f"post{px}", 0.5, board_bottom, 0.5, px, 0, -0.2, steel, bevel=0.05))
        for k in range(3):
            static.append(kit.box(f"rung{px}_{k}", 0.9, 0.1, 0.1, px, 1.4 + k * 1.4, -0.2, steel))
        static.append(kit.box(f"footing{px}", 1.4, 0.4, 1.4, px, 0, -0.2, kit.mat("concrete", "#a9a59c", roughness=0.9), bevel=0.08))
    board = kit.join(static, "billboard_board")
    kit.parent(board, root, keep_transform=False)

    letter_index = 0
    left = -(cols - 1) * pitch / 2
    top = board_bottom + 0.7 + 6 * pitch
    for slot, ch in enumerate(text):
        if ch == " ":
            continue
        rows = FONT[ch]
        letter = kit.group(f"letter_{letter_index}")
        kit.parent(letter, root, keep_transform=False)
        bulbs = []
        for r, row in enumerate(rows):
            for c, cell in enumerate(row):
                if cell != "#":
                    continue
                bx = left + (slot * 6 + c) * pitch
                by = top - r * pitch
                bulbs.append(kit.sphere(f"bulb{letter_index}_{r}_{c}", 0.13, bx, by, 0.24, bulb, segments=12, rings=8))
                bulbs.append(kit.cylinder(f"socket{letter_index}_{r}_{c}", 0.09, 0.08, bx, by, 0.17, socket, vertices=8, axis="z"))
        mesh = kit.join(bulbs, f"letter_{letter_index}_bulbs")
        kit.parent(mesh, letter, keep_transform=False)
        letter_index += 1
