import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'db.sqlite3')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Step 1: Create a new table without the NOT NULL on passkey_hash
    cursor.execute("""
        CREATE TABLE skillshelf_user_new (
            id INTEGER PRIMARY KEY,
            password varchar(128) NOT NULL,
            last_login datetime,
            is_superuser bool NOT NULL,
            full_name varchar(200) NOT NULL,
            email varchar(254) NOT NULL UNIQUE,
            student_id varchar(50) NOT NULL,
            phone varchar(20) NOT NULL,
            gender varchar(20) NOT NULL,
            date_of_birth date,
            nationality varchar(100) NOT NULL,
            address TEXT NOT NULL,
            bio TEXT NOT NULL,
            profile_photo varchar(100),
            is_active bool NOT NULL,
            is_staff bool NOT NULL,
            date_joined datetime NOT NULL,
            passkey_hash varchar(128),
            doc_passcode varchar(4)
        );
    """)

    # Step 2: Copy all existing data
    cursor.execute("""
        INSERT INTO skillshelf_user_new
        SELECT
            id, password, last_login, is_superuser, full_name, email,
            student_id, phone, gender, date_of_birth, nationality, address,
            bio, profile_photo, is_active, is_staff, date_joined,
            passkey_hash, doc_passcode
        FROM skillshelf_user;
    """)

    # Step 3: Drop old table
    cursor.execute("DROP TABLE skillshelf_user;")

    # Step 4: Rename new table
    cursor.execute("ALTER TABLE skillshelf_user_new RENAME TO skillshelf_user;")

    conn.commit()
    print("Fixed! passkey_hash is now nullable.")

except Exception as e:
    conn.rollback()
    print(f"Error: {e}")

# Verify
cursor.execute("PRAGMA table_info(skillshelf_user);")
cols = cursor.fetchall()
print("\nUpdated columns:")
for col in cols:
    print(f"  {col[1]} | type: {col[2]} | notnull: {col[3]}")

conn.close()