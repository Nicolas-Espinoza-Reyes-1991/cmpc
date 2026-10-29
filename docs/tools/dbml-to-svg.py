#!/usr/bin/env python3
"""Genera docs/erd.svg a partir de docs/erd.dbml.

Entiende solo el subconjunto de DBML que usa este proyecto (tablas, columnas con
[pk, not null, null, unique], Indexes y Ref). Sin dependencias: Python 3.

Uso:
    python docs/tools/dbml-to-svg.py                # escribe docs/erd.svg
    python docs/tools/dbml-to-svg.py --json         # imprime el modelo leído (para comprobarlo)
"""
import json
import re
import sys
from html import escape
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent
SOURCE = DOCS / "erd.dbml"
TARGET = DOCS / "erd.svg"

# Posición (x, y) de cada tabla; las no listadas se colocan en una fila inferior.
LAYOUT = {
    "authors": (40, 40),
    "publishers": (40, 250),
    "genres": (40, 460),
    "books": (540, 40),
    "users": (1040, 40),
    "audit_logs": (1040, 250),
}
WIDTH = 300
ROW_H = 22
HEADER_H = 32
PAD = 10


def parse(text):
    """Devuelve {'tables': {nombre: [columnas]}, 'refs': [...]}."""
    text = re.sub(r"//[^\n]*", "", text)
    tables = {}
    for match in re.finditer(r"Table\s+(\w+)\s*\{(.*?)\n\}", text, re.S):
        name, body = match.group(1), match.group(2)
        # Lo que va después de Indexes/Note no son columnas.
        body = re.split(r"\n\s*(?:Indexes|Note)\b", body)[0]
        columns = []
        for line in body.strip().splitlines():
            col = re.match(r'\s*(\w+)\s+("[^"]+"|\w+)\s*(?:\[(.*)\])?\s*$', line)
            if not col:
                continue
            attrs = (col.group(3) or "")
            flags = [a.strip() for a in re.split(r",\s*(?![^()]*\))", attrs)]
            columns.append({
                "name": col.group(1),
                "type": col.group(2).strip('"'),
                "pk": "pk" in flags,
                "unique": "unique" in flags,
                "nullable": "null" in flags,
            })
        tables[name] = columns
    refs = [
        {"from": m.group(1), "to": m.group(2), "on_delete": (m.group(3) or "").strip()}
        for m in re.finditer(
            r"Ref[^:]*:\s*(\w+\.\w+)\s*>\s*(\w+\.\w+)\s*(?:\[delete:\s*([\w ]+?)[,\]])?", text
        )
    ]
    return {"tables": tables, "refs": refs}


def table_box(name, columns, refs):
    fk_columns = {r["from"] for r in refs}
    height = HEADER_H + ROW_H * len(columns) + PAD
    return height, fk_columns


def svg(model):
    tables, refs = model["tables"], model["refs"]
    positions, boxes = {}, {}
    fallback_x = 40
    for name, columns in tables.items():
        x, y = LAYOUT.get(name, (fallback_x, 700))
        if name not in LAYOUT:
            fallback_x += WIDTH + 40
        height, fks = table_box(name, columns, refs)
        positions[name] = (x, y)
        boxes[name] = (height, fks)

    total_w = max(x for x, _ in positions.values()) + WIDTH + 240
    total_h = max(y + boxes[n][0] for n, (_, y) in positions.items()) + 40

    def anchor(ref, side):
        table, column = ref.split(".")
        x, y = positions[table]
        index = [c["name"] for c in tables[table]].index(column)
        cy = y + HEADER_H + ROW_H * index + ROW_H / 2
        return (x + WIDTH if side == "right" else x), cy

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_w}" height="{total_h}" '
        f'viewBox="0 0 {total_w} {total_h}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13">',
        "<title>Modelo relacional de CMPC Libros</title>",
        '<rect width="100%" height="100%" fill="#ffffff"/>',
    ]

    # Relaciones primero, para que queden debajo de las tablas.
    for ref in refs:
        a_table, b_table = ref["from"].split(".")[0], ref["to"].split(".")[0]
        # La columna foránea sale por el lado que mira a la otra tabla.
        a_side = "left" if positions[a_table][0] > positions[b_table][0] else "right"
        b_side = "right" if a_side == "left" else "left"
        x1, y1 = anchor(ref["from"], a_side)
        x2, y2 = anchor(ref["to"], b_side)
        if positions[a_table][0] == positions[b_table][0]:
            # Tablas en la misma columna: la relación rodea por el lado derecho.
            a_side = b_side = "right"
            x1, y1 = anchor(ref["from"], "right")
            x2, y2 = anchor(ref["to"], "right")
            bulge = x1 + 70
            out.append(
                f'<path d="M{x1} {y1} C{bulge} {y1} {bulge} {y2} {x2} {y2}" fill="none" stroke="#64748b" stroke-width="1.5"/>'
            )
            out.append(f'<text x="{x1 + 6}" y="{y1 - 6}" fill="#334155" font-size="12">N</text>')
            out.append(f'<text x="{x2 + 6}" y="{y2 - 6}" fill="#334155" font-size="12">1</text>')
            if ref["on_delete"]:
                out.append(
                    f'<text x="{bulge - 8}" y="{(y1 + y2) / 2}" fill="#64748b" font-size="11">'
                    f'ON DELETE {escape(ref["on_delete"].upper())}</text>'
                )
            continue
        mid = (x1 + x2) / 2
        out.append(
            f'<path d="M{x1} {y1} C{mid} {y1} {mid} {y2} {x2} {y2}" fill="none" stroke="#64748b" stroke-width="1.5"/>'
        )
        out.append(f'<text x="{x1 + (-14 if a_side == "left" else 6)}" y="{y1 - 6}" fill="#334155" font-size="12">N</text>')
        out.append(f'<text x="{x2 + (6 if b_side == "right" else -12)}" y="{y2 - 6}" fill="#334155" font-size="12">1</text>')
        if ref["on_delete"]:
            out.append(
                f'<text x="{mid - 52}" y="{(y1 + y2) / 2 - 6}" fill="#64748b" font-size="11">'
                f'ON DELETE {escape(ref["on_delete"].upper())}</text>'
            )

    for name, columns in tables.items():
        x, y = positions[name]
        height, fks = boxes[name]
        out.append(f'<g transform="translate({x},{y})">')
        out.append(f'<rect width="{WIDTH}" height="{height}" rx="6" fill="#f8fafc" stroke="#334155" stroke-width="1.5"/>')
        out.append(f'<path d="M0 6 a6 6 0 0 1 6 -6 H{WIDTH - 6} a6 6 0 0 1 6 6 V{HEADER_H} H0 Z" fill="#1e3a8a"/>')
        out.append(f'<text x="{PAD}" y="21" fill="#ffffff" font-weight="600" font-size="14">{escape(name)}</text>')
        for i, col in enumerate(columns):
            ty = HEADER_H + ROW_H * i + 16
            marks = []
            if col["pk"]:
                marks.append("PK")
            if f"{name}.{col['name']}" in fks:
                marks.append("FK")
            if col["unique"]:
                marks.append("UQ")
            if not col["nullable"] and not col["pk"]:
                marks.append("NN")
            out.append(f'<text x="{PAD}" y="{ty}" fill="#0f172a">{escape(col["name"])}</text>')
            out.append(f'<text x="{PAD + 118}" y="{ty}" fill="#475569">{escape(col["type"])}</text>')
            out.append(f'<text x="{WIDTH - PAD}" y="{ty}" text-anchor="end" fill="#1d4ed8" font-size="11">{" ".join(marks)}</text>')
        out.append("</g>")

    legend_y = total_h - 22
    out.append(
        f'<text x="40" y="{legend_y}" fill="#64748b" font-size="11">PK clave primaria · FK clave foránea · '
        "UQ único · NN no nulo · N:1 muchos a uno. Fuente: docs/erd.dbml</text>"
    )
    out.append("</svg>")
    return "\n".join(out) + "\n"


def main():
    model = parse(SOURCE.read_text(encoding="utf-8"))
    if "--json" in sys.argv:
        print(json.dumps(model, ensure_ascii=False, indent=1))
        return
    TARGET.write_text(svg(model), encoding="utf-8", newline="\n")
    print(f"{TARGET.relative_to(DOCS.parent)}: {len(model['tables'])} tablas, {len(model['refs'])} relaciones")


if __name__ == "__main__":
    main()
