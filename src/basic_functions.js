import { capitalize } from "./utils.js";

export function generateLeaderboard(game, pointValue) {
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
	const MESSAGE_HEADER = "```\n🏆 Leaderboard:\n\n";
	const MAX_PLAYERS_PER_MESSAGE = 20;
	const leaderboardMessages = [];

	for (let i = 0; i < playersArray.length; i += MAX_PLAYERS_PER_MESSAGE) {
		let groupMessage = MESSAGE_HEADER;

		for (
			let j = i;
			j < i + MAX_PLAYERS_PER_MESSAGE && j < playersArray.length;
			j++
		) {
			const player = playersArray[j];
			if (player.liquidated) {
				groupMessage += `${j + 1}. ${player.displayName} Liquidated \n`;
			} else {
				let profitValue = player.profit;
				profitValue *= pointValue;
				const form_profit = profitValue.toFixed(2);
				const num_trades = player.num_trades.toFixed(0);
				const win_rate = (
					(player.num_correct / player.num_trades) *
					100
				).toFixed(2);

				groupMessage += `${j + 1}. ${
					player.displayName
				} - Profit: ${form_profit}, Number of Trades: ${num_trades}, Win Rate: ${win_rate}% \n`;
			}
		}

		groupMessage += "```"; // close the code block
		leaderboardMessages.push(groupMessage);
	}

	return leaderboardMessages;
}

export async function sendLeaderboard(game, channel, pointValue) {
	const leaderboardMessages = generateLeaderboard(game, pointValue);

	// Helper function to send message for a group of players
	async function sendMessageForGroup(groupMessage) {
		try {
			await channel.send({
				content: groupMessage,
			});
		} catch (error) {
			console.error("Error sending leaderboard message group:", error);
		}
	}

	// Send all leaderboard messages
	for (const message of leaderboardMessages) {
		await sendMessageForGroup(message);
	}
}

// Keep the old function for backward compatibility
export async function viewLeaderboard(game, channel, pointValue) {
	await sendLeaderboard(game, channel, pointValue);
}

export function viewRules(req_body) {
	// Format the leaderboard
	let rule =
		"Submit your decision using the buttons below. If you want to hold your position, do not click on any buttons. \n\nUse the Green Buy button for longs and the Red Sell button for shorts. \n\nIf you want to double your position, open a long or short position first, and then click the Double button. You have 1 double each simulation.";

	rule += "\n\nYou can override your decision before the round ends.";

	return rule;
}

export async function viewPositions(game, channel) {
	const current_price = game.stockPrice;
	const playersEntries = Object.entries(game.players);

	// Constants
	const MESSAGE_HEADER = "```\nCurrent open positions:\n";
	const MAX_PLAYERS_PER_MESSAGE = 20;

	// Helper function to send message for a group of players
	async function sendMessageForGroup(groupMessage) {
		try {
			groupMessage += "```"; // close the code block
			await channel.send({
				content: groupMessage,
			});
		} catch (error) {
			console.error("Error sending message group:", error);
		}
	}

	// Create groups of players and send messages
	for (let i = 0; i < playersEntries.length; i += MAX_PLAYERS_PER_MESSAGE) {
		let groupMessage = MESSAGE_HEADER;

		for (
			let j = i;
			j < i + MAX_PLAYERS_PER_MESSAGE && j < playersEntries.length;
			j++
		) {
			const [playerName, playerData] = playersEntries[j];

			// If the player has an open position
			if (playerData.position) {
				// Add a line to the message for this player
				groupMessage += `${playerName}: ${playerData.position} position at ${playerData.enterPrice} `;
				if (
					(playerData.enterPrice < current_price &&
						playerData.position == "long") ||
					(playerData.enterPrice > current_price &&
						playerData.position == "short")
				) {
					groupMessage += `🟢\n`;
				} else if (
					(playerData.enterPrice > current_price &&
						playerData.position == "long") ||
					(playerData.enterPrice < current_price &&
						playerData.position == "short")
				) {
					groupMessage += `🔴\n`;
				} else {
					groupMessage += `⚪️\n`;
				}
			}
		}

		// Send the message for this group
		await sendMessageForGroup(groupMessage);
	}
}

export function calculateAllProfit(game, displayName, addProfit) {
	let profit = 0;
	if (game.players[displayName].position === "long") {
		profit = game.stockPrice - game.players[displayName].enterPrice;
	} else if (game.players[displayName].position === "short") {
		profit = game.players[displayName].enterPrice - game.stockPrice;
	}

	if (game.players[displayName].posDouble == 1) {
		if (addProfit) {
			game.players[displayName].posDouble = 0;
		}
		profit *= 2;
	}

	if (profit > 0 && addProfit) {
		game.players[displayName].num_correct++;
	}

	if (addProfit) {
		game.players[displayName].profit += profit;
		game.players[displayName].position = null;
		game.players[displayName].enterPrice = null;
	}
	return profit;
}

export function calculatePartialProfit(game, displayName) {
	let profit;
	if (game.players[displayName].position === "long") {
		profit = game.stockPrice - game.players[displayName].enterPrice;
	} else if (game.players[displayName].position === "short") {
		profit = game.players[displayName].enterPrice - game.stockPrice;
	}
	game.players[displayName].profit += profit;
	game.players[displayName].posDouble = 0;
	return profit;
}

export function processLiquidation(game) {
	const current_price = game.stockPrice;
	const playersEntries = Object.entries(game.players);
	const liquidationThreshold = -game.liquidationThreshold;

	playersEntries.forEach(([playerName, playerData]) => {
		let profit = calculateAllProfit(game, playerName, false);
		profit += game.players[playerName].profit;
		profit *= game.pointVal;

		if (profit < liquidationThreshold) {
			game.players[playerName].liquidated = true;
			game.players[playerName].profit = liquidationThreshold * 2;
			game.players[playerName].position = null;
			game.players[playerName].enterPrice = null;
		}
	});
}
