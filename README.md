# 🎮 Game Web Store Demo

A web-based store system for online games, built with Astro and SQL Server. This is a **demonstration project** for educational purposes.

## ⚠️ Demo Notice

This is a **non-functional demo** that showcases the store and forum architecture only. Game server integration has been removed.

## 🛠️ Technologies

- **Astro** - Web framework
- **TypeScript** - Type safety
- **SQL Server** - Database
- **Tailwind CSS** - Styling

## 📁 What's Included

- User authentication and sessions
- Store item browsing and purchasing
- Credit system with transactions
- Purchase history tracking
- Forum with roles and moderation

## 🔧 Setup

```bash
# Install dependencies
npm install

# Setup database (run the DDL script)
sqlcmd -S localhost -U sa -P YourPassword -i database/store-schema.sql

# Configure environment
touch .env
# Edit .env with your credentials

# Run dev server
npm run dev
```

## 🎯 Integration Points

This demo shows the **store layer only**. To make it functional, you would need to:

1. Connect to your game's database
2. Implement account creation during registration
3. Add item delivery system after purchases
4. Load character data from game server
5. Implement game-specific features (leaderboards, etc.)

See inline comments in API files for integration suggestions.

## 📸 Screenshots
<img width="1481" height="1297" alt="image" src="https://github.com/user-attachments/assets/3a99d603-4be1-414e-a258-1d7f771cdd77" />
<img width="1178" height="1254" alt="image" src="https://github.com/user-attachments/assets/10959ac2-1890-4cf8-85f8-bb1f02915275" />
<img width="1320" height="943" alt="image" src="https://github.com/user-attachments/assets/5bc6d6d4-bc77-4936-a61a-fa30ebfea643" />
<img width="1487" height="1008" alt="image" src="https://github.com/user-attachments/assets/8f803804-b86c-4482-9cb8-6923a65529c7" />
<img width="1483" height="1188" alt="image" src="https://github.com/user-attachments/assets/a186721c-52bf-4a87-9970-acefbf576142" />
<img width="486" height="458" alt="image" src="https://github.com/user-attachments/assets/b71d73f2-fc7c-4891-8d5d-9f8a05ff830b" />
<img width="481" height="390" alt="image" src="https://github.com/user-attachments/assets/ca4ec8c1-3d31-4d63-93c6-082967e5a27b" />


## 📝 Note

This code is provided **as-is for educational purposes**. It is not production-ready and requires significant integration work to function with a real game server.

---

**Not affiliated with any specific game or company.**
