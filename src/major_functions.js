import { InteractionResponseFlags } from "discord-interactions";

import { capitalize } from "./utils.js";
import {
	viewLeaderboard,
	viewPositions,
	viewRules,
	calculateAllProfit,
	calculatePartialProfit,
} from "./basic_functions.js";

export async function processInteraction(
	componentId,
	activeGames,
	channelId,
	displayName,
	interaction
) {
	// Check if the game exists for this channel
	if (!activeGames[channelId]) {
		await interaction.reply({
			content:
				"There is currently no active simulation in this channel. Please start a new simulation with /sim.",
			flags: InteractionResponseFlags.EPHEMERAL,
		});
		return;
	}
	// BUY BUTTON
	if (componentId.startsWith("buy")) {
		if (!activeGames[channelId].players[displayName]) {
			activeGames[channelId].players[displayName] = {
				position: "long",
				enterPrice: activeGames[channelId].stockPrice,
				profit: 0,
				numDouble: activeGames[channelId].numDouble,
				posDouble: 0,
				num_correct: 0,
				num_trades: 1,
				liquidated: false,
			};
			await interaction.reply({
				content: `You opened a long position at ${activeGames[channelId].stockPrice}`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else if (activeGames[channelId].players[displayName].liquidated) {
			await interaction.reply({
				content: `You are liquidated. Cannot participate in the trade sim. Please try again next time`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else if (activeGames[channelId].players[displayName]?.position) {
			await interaction.reply({
				content: `You already have a position open. Please close it before opening a new one.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else {
			activeGames[channelId].players[displayName].position = "long";
			activeGames[channelId].players[displayName].enterPrice =
				activeGames[channelId].stockPrice;
			activeGames[channelId].players[displayName].num_trades += 1;
			await interaction.reply({
				content: `You opened a long position at ${activeGames[channelId].stockPrice}`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		}
	}
	// SELL BUTTON
	if (componentId.startsWith("sell")) {
		if (!activeGames[channelId].players[displayName]) {
			activeGames[channelId].players[displayName] = {
				position: "short",
				enterPrice: activeGames[channelId].stockPrice,
				profit: 0,
				numDouble: activeGames[channelId].numDouble,
				posDouble: 0,
				num_correct: 0,
				num_trades: 1,
				liquidated: false,
			};
			await interaction.reply({
				content: `You opened a short position at ${activeGames[channelId].stockPrice}`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else if (activeGames[channelId].players[displayName].liquidated) {
			await interaction.reply({
				content: `You are liquidated. Cannot participate in the trade sim. Please try again next time`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else if (activeGames[channelId].players[displayName]?.position) {
			await interaction.reply({
				content: `You already have a position open. Please close it before opening a new one.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else {
			activeGames[channelId].players[displayName].position = "short";
			activeGames[channelId].players[displayName].enterPrice =
				activeGames[channelId].stockPrice;
			activeGames[channelId].players[displayName].num_trades += 1;
			await interaction.reply({
				content: `You opened a short position at ${activeGames[channelId].stockPrice}`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		}
	}
	// CLOSE BUTTON
	if (componentId.startsWith("close")) {
		if (
			!activeGames[channelId].players[displayName] ||
			!activeGames[channelId].players[displayName]?.position
		) {
			await interaction.reply({
				content: `You do not currently have a position. Cannot close.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else {
			const pointValue = activeGames[channelId].pointVal;
			let profitValue = calculateAllProfit(
				activeGames[channelId],
				displayName,
				true
			);
			profitValue *= pointValue;
			const form_profit = profitValue.toFixed(2);
			await interaction.reply({
				content: `You closed your position for a profit of ${form_profit}.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		}
	}
	// REVERSE BUTTON
	if (componentId.startsWith("reverse")) {
		if (!activeGames[channelId].players[displayName]) {
			await interaction.reply({
				content: `You do not currently have a position. Cannot reverse.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else if (
			activeGames[channelId].players[displayName]?.position === "short"
		) {
			const pointValue = activeGames[channelId].pointVal;
			let profitValue = calculateAllProfit(
				activeGames[channelId],
				displayName,
				true
			);
			activeGames[channelId].players[displayName].position = "long";
			activeGames[channelId].players[displayName].enterPrice =
				activeGames[channelId].stockPrice;
			activeGames[channelId].players[displayName].num_trades += 1;
			profitValue *= pointValue;
			const form_profit = profitValue.toFixed(2);
			await interaction.reply({
				content: `You reversed your short position for a long position. The profit from your previous short position is ${form_profit}.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else if (
			activeGames[channelId].players[displayName]?.position === "long"
		) {
			const pointValue = activeGames[channelId].pointVal;
			let profitValue = calculateAllProfit(
				activeGames[channelId],
				displayName,
				true
			);
			activeGames[channelId].players[displayName].position = "short";
			activeGames[channelId].players[displayName].enterPrice =
				activeGames[channelId].stockPrice;
			activeGames[channelId].players[displayName].num_trades += 1;
			profitValue *= pointValue;
			const form_profit = profitValue.toFixed(2);
			await interaction.reply({
				content: `You reversed your long position for a short position. The profit from your previous long position is ${form_profit}.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else {
			await interaction.reply({
				content: `You do not currently have a position. Cannot reverse.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		}
	}
	// DOUBLE BUTTON
	if (componentId.startsWith("double")) {
		if (
			!activeGames[channelId].players[displayName] ||
			!activeGames[channelId].players[displayName]?.position
		) {
			await interaction.reply({
				content: `You do not currently have a position. Cannot double.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else if (activeGames[channelId].players[displayName]?.numDouble == 0) {
			await interaction.reply({
				content: `You already used your double.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else if (activeGames[channelId].players[displayName]?.posDouble == 1) {
			await interaction.reply({
				content: `You are in a double position already.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else {
			activeGames[channelId].players[displayName].enterPrice =
				(activeGames[channelId].players[displayName].enterPrice +
					activeGames[channelId].stockPrice) /
				2;
			activeGames[channelId].players[displayName].numDouble--;
			activeGames[channelId].players[displayName].posDouble++;
			await interaction.reply({
				content: `You have doubled your ${activeGames[channelId].players[displayName]?.position} position at an average price of ${activeGames[channelId].players[displayName]?.enterPrice}.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		}
	}
	// TRIM BUTTON
	if (componentId.startsWith("trim")) {
		if (
			!activeGames[channelId].players[displayName] ||
			!activeGames[channelId].players[displayName]?.position
		) {
			await interaction.reply({
				content: `You do not currently have a position. Cannot trim.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else if (activeGames[channelId].players[displayName]?.posDouble != 1) {
			await interaction.reply({
				content: `You are not currently in a double position. Cannot trim.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		} else {
			let profitValue = calculatePartialProfit(
				activeGames[channelId],
				displayName
			);
			profitValue *= activeGames[channelId].pointVal;
			const form_profit = profitValue.toFixed(2);
			await interaction.reply({
				content: `You trimed your double position for a profit of ${form_profit}.`,
				flags: InteractionResponseFlags.EPHEMERAL,
			});
			return;
		}
	}
}
