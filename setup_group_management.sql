CREATE TABLE IF NOT EXISTS group_settings (
  id integer PRIMARY KEY DEFAULT 1,
  name text DEFAULT 'Global Chat',
  description text DEFAULT 'Welcome to the global chat room!',
  avatar_url text,
  owner_username text,
  admin_usernames text[] DEFAULT '{}'
);

INSERT INTO group_settings (id, name, description, owner_username) 
VALUES (1, 'Global Chat', 'Welcome to the global chat room!', 'mr saqib') 
ON CONFLICT (id) DO NOTHING;
