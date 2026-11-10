"""Regenerate the MySQL baseline metadata from the original SQLite migrations.

Only an in-memory database is used. Run with --check in CI; no hosted DB access.
"""
import json
import pathlib
import sqlite3
import sys

root = pathlib.Path(__file__).resolve().parent.parent
connection = sqlite3.connect(':memory:')
for migration in sorted((root / 'drizzle').glob('*.sql')):
    connection.executescript(migration.read_text(encoding='utf-8').replace('--> statement-breakpoint', ''))
tables = []
for (name,) in connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall():
    columns = [dict(zip(['cid', 'name', 'type', 'notnull', 'default', 'pk'], row)) for row in connection.execute(f'PRAGMA table_info("{name}")')]
    indexes = []
    for index in connection.execute(f'PRAGMA index_list("{name}")').fetchall():
        if index[3] == 'pk':
            continue
        indexes.append({'name': index[1], 'unique': bool(index[2]), 'columns': [row[2] for row in connection.execute(f'PRAGMA index_info("{index[1]}")')]})
    foreign_keys = [dict(zip(['id', 'seq', 'table', 'from', 'to', 'on_update', 'on_delete', 'match'], row)) for row in connection.execute(f'PRAGMA foreign_key_list("{name}")')]
    tables.append({'name': name, 'columns': columns, 'indexes': indexes, 'foreignKeys': foreign_keys})
output = json.dumps(tables, ensure_ascii=False, indent=2) + '\n'
destination = root / 'server/mysql-schema.json'
if '--check' in sys.argv:
    if destination.read_text(encoding='utf-8') != output:
        raise SystemExit('MySQL baseline is stale; review migrations and regenerate it')
else:
    destination.write_text(output, encoding='utf-8')
print(f'Checked {len(tables)} application tables')
