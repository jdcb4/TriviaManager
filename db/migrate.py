import os
import sqlite3
import psycopg2
import psycopg2.extras

PG_DSN = "postgresql://postgres:vuSGjbCmviCCMryVSgXAJxvuCOTQUCkT@mainline.proxy.rlwy.net:42899/railway"
SQLITE_PATH = os.path.join(os.path.dirname(__file__), "trivia.db")

PG_TO_SQLITE = {
    "integer": "INTEGER",
    "int": "INTEGER",
    "int2": "INTEGER",
    "int4": "INTEGER",
    "int8": "INTEGER",
    "bigint": "INTEGER",
    "smallint": "INTEGER",
    "serial": "INTEGER",
    "bigserial": "INTEGER",
    "smallserial": "INTEGER",
    "boolean": "TEXT",
    "bool": "TEXT",
    "float": "REAL",
    "float4": "REAL",
    "float8": "REAL",
    "double precision": "REAL",
    "real": "REAL",
    "numeric": "REAL",
    "decimal": "REAL",
    "money": "REAL",
    "text": "TEXT",
    "varchar": "TEXT",
    "character varying": "TEXT",
    "char": "TEXT",
    "character": "TEXT",
    "uuid": "TEXT",
    "json": "TEXT",
    "jsonb": "TEXT",
    "timestamp": "TEXT",
    "timestamp without time zone": "TEXT",
    "timestamp with time zone": "TEXT",
    "timestamptz": "TEXT",
    "date": "TEXT",
    "time": "TEXT",
    "time without time zone": "TEXT",
    "time with time zone": "TEXT",
    "interval": "TEXT",
    "bytea": "BLOB",
}

def map_type(pg_type: str) -> str:
    return PG_TO_SQLITE.get(pg_type.lower(), "TEXT")

def get_tables(pg_cur):
    pg_cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    return [row["table_name"] for row in pg_cur.fetchall()]

def get_columns(pg_cur, table: str):
    pg_cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """, (table,))
    return [(row["column_name"], row["data_type"]) for row in pg_cur.fetchall()]

def migrate():
    print(f"Connecting to PostgreSQL...")
    pg_conn = psycopg2.connect(PG_DSN)
    pg_cur = pg_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    print(f"Opening SQLite at {SQLITE_PATH}...")
    sq_conn = sqlite3.connect(SQLITE_PATH)
    sq_cur = sq_conn.cursor()

    tables = get_tables(pg_cur)
    print(f"Found {len(tables)} table(s): {', '.join(tables)}\n")

    for table in tables:
        columns = get_columns(pg_cur, table)
        col_defs = ", ".join(
            f'"{col}" {map_type(dtype)}' for col, dtype in columns
        )
        create_sql = f'CREATE TABLE IF NOT EXISTS "{table}" ({col_defs})'
        sq_cur.execute(create_sql)

        pg_cur.execute(f'SELECT * FROM "{table}"')
        rows = pg_cur.fetchall()

        if rows:
            col_names = [col for col, _ in columns]
            placeholders = ", ".join("?" * len(col_names))
            quoted_cols = ", ".join(f'"{c}"' for c in col_names)
            insert_sql = f'INSERT INTO "{table}" ({quoted_cols}) VALUES ({placeholders})'

            # Convert each RealDictRow to a tuple in column order, stringify complex types
            def to_tuple(row):
                vals = []
                for col in col_names:
                    v = row[col]
                    if isinstance(v, (dict, list, bool)):
                        vals.append(str(v))
                    else:
                        vals.append(v)
                return tuple(vals)

            sq_cur.executemany(insert_sql, [to_tuple(r) for r in rows])

        sq_conn.commit()
        print(f"  {table}: {len(rows)} row(s) migrated")

    pg_cur.close()
    pg_conn.close()
    sq_conn.close()
    print(f"\nDone. SQLite database saved to: {SQLITE_PATH}")

if __name__ == "__main__":
    migrate()
