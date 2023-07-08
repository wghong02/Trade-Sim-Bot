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


export function viewPositions(game) {
  // Get an array of the players
    // Start composing the message
  let message = '```\n Current open positions:\n';

  // For each player in the game
  for (const [playerName, playerData] of Object.entries(game.players)) {
    // If the player has an open position
    if (playerData.position) {
      // Add a line to the message for this player
      message += `${playerName}: ${playerData.position} position at ${playerData.enterPrice} \n`;
    }
  }

  // If no players have an open position
  if (message === 'Current open positions:\n') {
    message += 'No players have an open position.\n';
  }
  message += "```"

  return message;
}