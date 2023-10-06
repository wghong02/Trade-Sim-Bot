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
  let leaderboard = "```\n🏆 Leaderboard (ticks):\n\n";

  playersArray.forEach((player, index) => {
    const form_profit = player.profit.toFixed(2);
    const num_trades = player.num_trades.toFixed(1);
    leaderboard += `${index + 1}. ${
      player.displayName
    } - Profit: ${form_profit}, Number of Trades: ${num_trades} \n`;  
  });
  leaderboard += "```";

  return leaderboard;
}

export function viewRules() {

  // Format the leaderboard
  let rule = "Submit your decision using the buttons below. If you want to hold your position, do not click on any buttons. \n\nUse the Green Buy button for longs and the Red Sell button for shorts. \n\nIf you want to double your position, open a long or short position first, and then click the Double button. You have 1 double each simulation.";

  rule += "\n\nYou can override your decision before the round ends.";

  return rule;
}


export function viewPositions(game) {
  // Get an array of the players
    // Start composing the message
  let message = '```\n Current open positions:\n';
  const current_price = game.stockPrice

  // For each player in the game
  for (const [playerName, playerData] of Object.entries(game.players)) {
    // If the player has an open position
    if (playerData.position) {
      // Add a line to the message for this player
      message += `${playerName}: ${playerData.position} position at ${playerData.enterPrice} `;
      if ((playerData.enterPrice < current_price && playerData.position == "long") || (playerData.enterPrice > current_price && playerData.position == "short")){
        message += `🟢\n`
      } else if ((playerData.enterPrice > current_price && playerData.position == "long") || (playerData.enterPrice < current_price && playerData.position == "short")){
        message += `🔴\n`
      } else {
        message += `⚪️\n`
      }
    }
  }

  // If no players have an open position
  if (message === 'Current open positions:\n') {
    message += 'No players have an open position.\n';
  }
  message += "```"

  return message;
}
