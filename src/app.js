import "dotenv/config";
import {
	InteractionType,
	InteractionResponseType,
	InteractionResponseFlags,
	MessageComponentTypes,
} from "discord-interactions";
import {
	viewLeaderboard,
	viewPositions,
	viewRules,
	calculateAllProfit,
	processLiquidation,
	generateLeaderboard,
} from "./basic_functions.js";
import { processInteraction } from "./major_functions.js";

import {
	Client,
	GatewayIntentBits,
	Partials,
	REST,
	Routes,
	Events,
} from "discord.js";

import { google } from "googleapis";
import fetch from "node-fetch";
import { GoogleAuth } from "google-auth-library";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.Channel],
});

client.login(process.env.DISCORD_TOKEN);

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};

// Register slash commands (if not already registered)
const commands = [
	{
		name: "sim",
		description: "Start a new simulation",
	},
	{
		name: "rules",
		description: "View the rules",
	},
	{
		name: "close_all",
		description: "Close all positions",
	},
	{
		name: "set_value",
		description: "Set the value for each point",
		options: [
			{
				name: "set_value",
				description: "Value for each point",
				type: 10,
				required: true,
			},
		],
	},
	{
		name: "set_double",
		description: "Set the number of doubles",
		options: [
			{
				name: "set_double",
				description: "Number of doubles",
				type: 10,
				required: true,
			},
		],
	},
	{
		name: "setprice",
		description: "Set the current price",
		options: [
			{
				name: "price",
				description: "Stock price (-100 to end sim)",
				type: 10,
				required: true,
			},
		],
	},
	{
		name: "leaderboard",
		description: "View the leaderboard",
	},
	{
		name: "current_positions",
		description: "View current positions",
	},
	{
		name: "liquidation_threshold",
		description: "Set the liquidation threshold",
		options: [
			{
				name: "liquidation_threshold",
				description: "Threshold value",
				type: 10,
				required: true,
			},
		],
	},
];

// Register commands on startup
client.once("ready", async () => {
	const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
	try {
		const appId = client.user.id;
		const guilds = await client.guilds.fetch();
		for (const [guildId] of guilds) {
			await rest.put(Routes.applicationGuildCommands(appId, guildId), {
				body: commands,
			});
		}
		console.log("Slash commands registered.");
	} catch (error) {
		console.error("Failed to register slash commands:", error);
	}
});

client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

	const channelId = interaction.channelId;
	const userId = interaction.user.id;
	const username = interaction.user.username;
	const discriminator = interaction.user.discriminator;
	const displayName = `${username}#${discriminator}`;

	if (interaction.isChatInputCommand()) {
		const { commandName, options } = interaction;
		console.log(
			`[COMMAND] ${commandName} used by ${displayName} in channel ${channelId}`
		);

		if (commandName === "sim") {
			await interaction.reply({
				content: "Click to start the simulation.",
				components: [
					{
						type: MessageComponentTypes.ACTION_ROW,
						components: [
							{
								type: 2,
								label: "Start Sim",
								style: 1,
								custom_id: "start_sim",
							},
						],
					},
				],
				flags: 64, // 64 = EPHEMERAL
			});
			return;
		}
		if (commandName === "rules") {
			const message = viewRules();
			await interaction.reply({ content: message });
			return;
		}
		if (commandName === "close_all") {
			if (!activeGames[channelId]) {
				await interaction.reply({
					content:
						"There is currently no active simulation. Use /sim to start a new simulation.",
					flags: 64,
				});
				return;
			}
			for (const displayName in activeGames[channelId].players) {
				if (activeGames[channelId].players[displayName].position) {
					calculateAllProfit(activeGames[channelId], displayName, true);
				}
			}
			await interaction.reply({ content: "All Current Positions are Closed." });
			return;
		}
		if (commandName === "set_value") {
			if (!activeGames[channelId]) {
				await interaction.reply({
					content:
						"There is currently no active simulation. Use /sim to start a new simulation.",
					flags: 64,
				});
				return;
			} else if (activeGames[channelId].ownerId !== userId) {
				await interaction.reply({
					content:
						"Only the user who started the simulation can set the point value.",
					flags: 64,
				});
				return;
			} else {
				const pointValue = options.getNumber("set_value");
				if (isNaN(pointValue) || pointValue < 0) {
					await interaction.reply({
						content: "Invalid point value. Please enter a valid number.",
						flags: 64,
					});
					return;
				} else {
					activeGames[channelId].pointVal = pointValue;
					await interaction.reply({
						content: `1 point is set to be ${pointValue}.
`,
						flags: 64,
					});
					return;
				}
			}
		}
		if (commandName === "set_double") {
			if (!activeGames[channelId]) {
				await interaction.reply({
					content:
						"There is currently no active simulation. Use /sim to start a new simulation.",
					flags: 64,
				});
				return;
			} else if (activeGames[channelId].ownerId !== userId) {
				await interaction.reply({
					content:
						"Only the user who started the simulation can set the number of doubles.",
					flags: 64,
				});
				return;
			} else {
				const numDouble = options.getNumber("set_double");
				if (isNaN(numDouble) || numDouble < 0) {
					await interaction.reply({
						content: "Invalid value. Please enter a valid number.",
						flags: 64,
					});
					return;
				} else {
					activeGames[channelId].numDouble = numDouble;
					await interaction.reply({
						content: `The number of doubles is ${numDouble}.
`,
						flags: 64,
					});
					return;
				}
			}
		}
		if (commandName === "setprice") {
			if (!activeGames[channelId]) {
				await interaction.reply({
					content:
						"There is currently no active simulation. Use /sim to start a new simulation.",
					flags: 64,
				});
				return;
			} else if (activeGames[channelId].ownerId !== userId) {
				await interaction.reply({
					content:
						"Only the user who started the simulation can set the price.",
					flags: 64,
				});
				return;
			} else {
				const price = options.getNumber("price");

				// Console log the current leaderboard before processing any logic
				console.log("=== CURRENT LEADERBOARD BEFORE SETPRICE ===");
				const currentLeaderboard = generateLeaderboard(
					activeGames[channelId],
					activeGames[channelId].pointVal
				);
				console.log("Leaderboard messages:", currentLeaderboard);
				console.log(
					"Current game state:",
					JSON.stringify(activeGames[channelId], null, 2)
				);
				console.log("=== END LEADERBOARD LOG ===");

				if (price === -100) {
					for (const displayName in activeGames[channelId].players) {
						const player = activeGames[channelId].players[displayName];
						const pointValue = activeGames[channelId].pointVal;
						calculateAllProfit(activeGames[channelId], displayName, true);
					}
					await interaction.reply({ content: "Simulation is over." });
					return;
				} else if (isNaN(price) || price < 0) {
					await interaction.reply({
						content: "Invalid stock price. Please enter a valid number.",
						flags: 64,
					});
					return;
				} else {
					activeGames[channelId].stockPrice = price;
					processLiquidation(activeGames[channelId]);
					const channel = await client.channels.fetch(channelId);
					await viewPositions(activeGames[channelId], channel);
					const timeoutDuration = 15000; // 15 seconds
					let remainingTime = timeoutDuration / 1000; // Convert to seconds
					const components = [
						{
							type: MessageComponentTypes.ACTION_ROW,
							components: [
								{ type: 2, style: 3, label: "Buy", custom_id: `buy_share` },
								{ type: 2, style: 4, label: "Sell", custom_id: `sell_share` },
								{ type: 2, style: 1, label: "Close", custom_id: `close` },
							],
						},
						{
							type: MessageComponentTypes.ACTION_ROW,
							components: [
								{ type: 2, style: 1, label: "Reverse", custom_id: `reverse` },
								{ type: 2, style: 1, label: "x2", custom_id: `double` },
								{ type: 2, style: 1, label: "Trim", custom_id: `trim` },
							],
						},
					];
					const message = await channel.send({
						content: `The current price is ${price}. What do you want to do? You have ${remainingTime} seconds to respond.`,
						components: components,
					});
					const intervalId = setInterval(async () => {
						remainingTime -= 2;
						if (remainingTime <= 0) {
							clearInterval(intervalId);
							message
								.edit({
									content: `The current price was ${price}. Time's up!`,
									components: [],
								})
								.catch(console.error);
							return;
						}
						await message
							.edit({
								content: `The current price is ${price}. What do you want to do? You have ${remainingTime} seconds to respond.`,
							})
							.catch(console.error);
					}, 2000);
					await interaction.reply({ content: "Loading...", ephemeral: true });
					return;
				}
			}
		}
		if (commandName === "leaderboard") {
			if (!activeGames[channelId]) {
				await interaction.reply({
					content:
						"There is currently no active simulation. Use /sim to start a new simulation.",
					flags: 64,
				});
				return;
			} else {
				let pointValue = activeGames[channelId].pointVal;
				const channel = await client.channels.fetch(channelId);
				await viewLeaderboard(activeGames[channelId], channel, pointValue);
				await interaction.reply({
					content: "Command Executed",
					ephemeral: true,
				});
				return;
			}
		}
		if (commandName === "current_positions") {
			if (!activeGames[channelId]) {
				await interaction.reply({
					content:
						"There is currently no active simulation. Use /sim to start a new simulation.",
					flags: 64,
				});
				return;
			} else {
				const channel = await client.channels.fetch(channelId);
				await viewPositions(activeGames[channelId], channel);
				await interaction.reply({
					content: "Command Executed",
					ephemeral: true,
				});
				return;
			}
		}
		if (commandName === "liquidation_threshold") {
			if (!activeGames[channelId]) {
				await interaction.reply({
					content:
						"There is currently no active simulation. Use /sim to start a new simulation.",
					flags: 64,
				});
				return;
			} else if (activeGames[channelId].ownerId !== userId) {
				await interaction.reply({
					content:
						"Only the user who started the simulation can set the threshold value.",
					flags: 64,
				});
				return;
			} else {
				const thresholdValue = options.getNumber("liquidation_threshold");
				if (isNaN(thresholdValue) || thresholdValue < 0) {
					await interaction.reply({
						content: "Invalid threshold value. Please enter a valid number.",
						flags: 64,
					});
					return;
				} else {
					activeGames[channelId].liquidationThreshold = thresholdValue;
					await interaction.reply({
						content: `The liquidation threshold is set to be ${thresholdValue}.
`,
						flags: 64,
					});
					return;
				}
			}
		}
	}

	if (interaction.isButton()) {
		const componentId = interaction.customId;
		console.log(
			`[BUTTON] ${componentId} pressed by ${displayName} in channel ${channelId}`
		);
		if (componentId === "start_sim") {
			const game = {
				players: {},
				stockPrice: 0,
				numDouble: 2,
				ownerId: userId,
				pointVal: 1,
				liquidationThreshold: 2500,
			};
			activeGames[channelId] = game;
			await interaction.reply({
				content:
					"Simulation started. Please use the /setprice command to set the current price and use the /set_value command to set the value for each point.",
				ephemeral: true,
			});
			return;
		} else {
			// Delegate to processInteraction for other buttons
			await processInteraction(
				componentId,
				activeGames,
				channelId,
				displayName,
				interaction
			);
			return;
		}
	}
});

// --- Keep-alive HTTP server for platforms like Replit/Heroku ---
import express from "express";
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
	res.send("Bot is running!");
});

app.listen(PORT, () => {
	console.log(`Keep-alive server listening on port ${PORT}`);
});
