export const prerender = false;
import type { APIRoute } from 'astro';

// 🎮 GAME INTEGRATION REMOVED FOR DEMO
// In a real implementation, you would:
// 1. Import worldPool from '../../../lib/db'
// 2. Query character statistics from game database
// 3. Return real leaderboard data

// Demo leaderboards moved to GET function below

export const GET: APIRoute = async ({ params }) => {
    const { type } = params;

    // Demo leaderboard data
    const demoLeaderboards = {
        playtime: [
            { character_name: "KnightMaster", stat_value: 15420 },
            { character_name: "ShadowMage", stat_value: 12890 },
            { character_name: "HolyPriest", stat_value: 11250 },
            { character_name: "DragonSlayer", stat_value: 10800 },
            { character_name: "StormArcher", stat_value: 9560 }
        ],
        level: [
            { character_name: "EpicWarrior", stat_value: 135 },
            { character_name: "MysticSage", stat_value: 132 },
            { character_name: "BladeDancer", stat_value: 128 },
            { character_name: "FireMage", stat_value: 125 },
            { character_name: "IceSorceress", stat_value: 123 }
        ],
        gold: [
            { character_name: "TradeMaster", stat_value: 50000000 },
            { character_name: "GoldFarmer", stat_value: 35000000 },
            { character_name: "MerchantKing", stat_value: 28000000 },
            { character_name: "RichPlayer", stat_value: 22000000 },
            { character_name: "WealthyOne", stat_value: 18000000 }
        ],
        kills: [
            { character_name: "PvPMaster", stat_value: 2840 },
            { character_name: "WarLord", stat_value: 2156 },
            { character_name: "BattleKing", stat_value: 1987 },
            { character_name: "CombatPro", stat_value: 1743 },
            { character_name: "FightClub", stat_value: 1598 }
        ]
    };

    if (!type || !demoLeaderboards[type as keyof typeof demoLeaderboards]) {
        return new Response(JSON.stringify({
            ok: false,
            error: 'Invalid leaderboard type'
        }), { status: 400 });
    }

    // 🎮 GAME INTEGRATION POINT:
    // In a real implementation, you would:
    // 1. Connect to world database using worldPool
    // 2. Execute appropriate query based on leaderboard type
    // 3. Return real character statistics from game database
    
    console.log(`📊 Demo: Returning mock ${type} leaderboard data`);

    const players = demoLeaderboards[type as keyof typeof demoLeaderboards];

    return new Response(JSON.stringify({
        ok: true,
        players
    }), { headers: { 'Content-Type': 'application/json' } });
};