from sqlalchemy import text
from db.database import engine, Base

for table_name, table in Base.metadata.tables.items():
    for column in table.columns:
        col_type = column.type.compile(engine.dialect)
        print(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column.name} {col_type};")
