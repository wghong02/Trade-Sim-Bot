import { capitalize } from "./utils.js";

export function viewLeaderboard(game) {
  // Get an array of the players
  const playersArray = Object.keys(game.players).map((displayName) => {
    return {
      displayName: displayName,
      ...game.players[displayName],
    };
  });

  // Sort the players by profit in descending order
  playersArray.sort((a, b) => b.profit - a.profit);

  // Format the leaderboard
  let leaderboard = "```\n🏆 Leaderboard:\n\n";

  playersArray.forEach((player, index) => {
    const form_profit = player.profit.toFixed(2);
    leaderboard += `${index + 1}. ${
      player.displayName
    } - Profit: ${form_profit}\n`;
  });
  leaderboard += "```";

  return leaderboard;
}
