import psycopg2
from psycopg2 import sql
import sys

# Database connection parameters
db_params = {
    "host": "localhost",
    "port": 5432,
    "user": "postgres",
    "password": "password",
    "database": "gaming_central_db"
}

def connect_to_db():
    """Connect to the PostgreSQL database and return connection object"""
    try:
        conn = psycopg2.connect(**db_params)
        print("Connected to the database successfully!")
        return conn
    except Exception as e:
        print(f"Error connecting to the database: {e}")
        return None

def get_tables(conn):
    """Get list of tables in the database"""
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        cursor.close()
        return [table[0] for table in tables]
    except Exception as e:
        print(f"Error getting tables: {e}")
        return []

def get_table_schema(conn, table_name):
    """Get schema for a specific table"""
    try:
        cursor = conn.cursor()
        cursor.execute(sql.SQL("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position;
        """), [table_name])
        schema = cursor.fetchall()
        cursor.close()
        return schema
    except Exception as e:
        print(f"Error getting schema for table {table_name}: {e}")
        return []

def get_functions(conn):
    """Get list of functions in the database"""
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_type = 'FUNCTION' AND routine_schema = 'public'
            ORDER BY routine_name;
        """)
        functions = cursor.fetchall()
        cursor.close()
        return [func[0] for func in functions]
    except Exception as e:
        print(f"Error getting functions: {e}")
        return []

def get_function_definition(conn, function_name):
    """Get definition for a specific function"""
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT pg_get_functiondef(pg_proc.oid)
            FROM pg_proc
            JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
            WHERE pg_namespace.nspname = 'public' AND pg_proc.proname = %s;
        """, [function_name])
        definition = cursor.fetchone()
        cursor.close()
        return definition[0] if definition else None
    except Exception as e:
        print(f"Error getting definition for function {function_name}: {e}")
        return None

def search_ai_referee_related(conn):
    """Search for tables and functions related to 'referee' or 'AI'"""
    try:
        cursor = conn.cursor()
        # Search in table names
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND 
                  (table_name ILIKE '%referee%' OR table_name ILIKE '%ai%')
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        
        # Search in function names
        cursor.execute("""
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_type = 'FUNCTION' AND routine_schema = 'public' AND
                  (routine_name ILIKE '%referee%' OR routine_name ILIKE '%ai%')
            ORDER BY routine_name;
        """)
        functions = cursor.fetchall()
        
        # Search in column names
        cursor.execute("""
            SELECT table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND 
                  (column_name ILIKE '%referee%' OR column_name ILIKE '%ai%')
            ORDER BY table_name, column_name;
        """)
        columns = cursor.fetchall()
        
        cursor.close()
        return {
            'tables': [t[0] for t in tables],
            'functions': [f[0] for f in functions],
            'columns': columns
        }
    except Exception as e:
        print(f"Error searching for AI referee related items: {e}")
        return {'tables': [], 'functions': [], 'columns': []}

def main():
    conn = connect_to_db()
    if not conn:
        sys.exit(1)
    
    try:
        print("\n=== Database Tables ===")
        tables = get_tables(conn)
        for table in tables:
            print(f"- {table}")
        
        print("\n=== Table Schemas ===")
        for table in tables:
            print(f"\nTable: {table}")
            schema = get_table_schema(conn, table)
            for column in schema:
                print(f"  - {column[0]}: {column[1]} (Nullable: {column[2]})")
        
        print("\n=== Database Functions ===")
        functions = get_functions(conn)
        for func in functions:
            print(f"- {func}")
        
        print("\n=== AI Referee Related Items ===")
        ai_items = search_ai_referee_related(conn)
        
        print("Related Tables:")
        for table in ai_items['tables']:
            print(f"- {table}")
        
        print("\nRelated Functions:")
        for func in ai_items['functions']:
            print(f"- {func}")
            definition = get_function_definition(conn, func)
            if definition:
                print(f"  Definition: {definition[:100]}...")
        
        print("\nRelated Columns:")
        for col in ai_items['columns']:
            print(f"- Table: {col[0]}, Column: {col[1]}")
    
    except Exception as e:
        print(f"Error exploring database: {e}")
    finally:
        conn.close()
        print("\nDatabase connection closed.")

if __name__ == "__main__":
    main()
