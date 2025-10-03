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


## 📝 Note

This code is provided **as-is for educational purposes**. It is not production-ready and requires significant integration work to function with a real game server.

---

**Not affiliated with any specific game or company.**
