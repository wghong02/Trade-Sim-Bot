import "dotenv/config";
import express from "express";
import {
	InteractionType,
	InteractionResponseType,
	InteractionResponseFlags,
	MessageComponentTypes,
} from "discord-interactions";
import { VerifyDiscordRequest } from "./utils.js";
import {
	viewLeaderboard,
	viewPositions,
	viewRules,
	calculateAllProfit,
	processLiquidation,
} from "./basic_functions.js";
import { processInteraction } from "./major_functions.js";

import { Client, GatewayIntentBits } from "discord.js";
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.login(process.env.DISCORD_TOKEN);

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

app.get("/", (req, res) => {
	res.send("The Trade Sim Bot is live!");
});

// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post("/interactions", async function (req, res) {
	console.log("Received interaction:", req.body);

	// Interaction type and data
	const { type, id, data } = req.body;

	/**
	 * Handle verification requests
	 */
	if (type === InteractionType.PING) {
		return res.send({ type: InteractionResponseType.PONG });
	}

	// handle commands
	if (type === InteractionType.APPLICATION_COMMAND) {
		const { name, options } = data;

		// "sim" command
		if (name === "sim") {
			return res.send({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: "Click to start the simulation.",
					flags: InteractionResponseFlags.EPHEMERAL,
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
				},
			});
		}
		if (name === "rules") {
			const message = viewRules();
			return res.send({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: message,
				},
			});
		}
		if (name === "close_all") {
			const userId = req.body.member.user.id;
			const channelId = req.body.channel_id;
			const pointValue = activeGames[channelId].pointVal;

			for (const displayName in activeGames[channelId].players) {
				if (activeGames[channelId].players[displayName].position) {
					calculateAllProfit(activeGames[channelId], displayName, true);
				}
			}
			return res.send({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content: "All Current Positions are Closed.",
				},
			});
		}
		if (name === "set_value") {
			const userId = req.body.member.user.id;
			const channelId = req.body.channel_id;

			if (!activeGames[channelId]) {
				// There's no active game for this channel
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content:
							"There is currently no active simulation. Use /sim to start a new simulation.",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			} else if (activeGames[channelId].ownerId !== userId) {
				// The user trying to set the price is not the owner of the game
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content:
							"Only the user who started the simulation can set the point value.",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			} else {
				const username = req.body.member.user.username;
				const discriminator = req.body.member.user.discriminator;
				const displayName = `${username}#${discriminator}`;

				const point_option = options.find(
					(option) => option.name === "set_value"
				);
				if (point_option) {
					const pointValue = parseFloat(point_option.value);
					if (isNaN(pointValue) || pointValue < 0) {
						return res.send({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content: "Invalid point value. Please enter a valid number.",
								flags: InteractionResponseFlags.EPHEMERAL,
							},
						});
					} else {
						activeGames[channelId].pointVal = pointValue;
						return res.send({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content: `1 point is set to be ${pointValue}.`,
								flags: InteractionResponseFlags.EPHEMERAL,
							},
						});
					}
				}
			}
		}

		if (name === "set_double") {
			const userId = req.body.member.user.id;
			const channelId = req.body.channel_id;

			if (!activeGames[channelId]) {
				// There's no active game for this channel
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content:
							"There is currently no active simulation. Use /sim to start a new simulation.",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			} else if (activeGames[channelId].ownerId !== userId) {
				// The user trying to set the price is not the owner of the game
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content:
							"Only the user who started the simulation can set the number of doubles.",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			} else {
				const username = req.body.member.user.username;
				const discriminator = req.body.member.user.discriminator;
				const displayName = `${username}#${discriminator}`;

				const num_option = options.find(
					(option) => option.name === "set_double"
				);
				if (num_option) {
					const numDouble = parseFloat(num_option.value);
					if (isNaN(numDouble) || numDouble < 0) {
						return res.send({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content: "Invalid value. Please enter a valid number.",
								flags: InteractionResponseFlags.EPHEMERAL,
							},
						});
					} else {
						activeGames[channelId].numDouble = numDouble;
						return res.send({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content: `The number of doubles is ${numDouble}.`,
								flags: InteractionResponseFlags.EPHEMERAL,
							},
						});
					}
				}
			}
		}

		if (name === "setprice") {
			const userId = req.body.member.user.id;
			const channelId = req.body.channel_id;

			if (!activeGames[channelId]) {
				// There's no active game for this channel
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content:
							"There is currently no active simulation. Use /sim to start a new simulation.",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			} else if (activeGames[channelId].ownerId !== userId) {
				// The user trying to set the price is not the owner of the game
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content:
							"Only the user who started the simulation can set the price.",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			} else {
				const username = req.body.member.user.username;
				const discriminator = req.body.member.user.discriminator;
				const displayName = `${username}#${discriminator}`;

				const priceOption = options.find((option) => option.name === "price");
				if (priceOption) {
					const price = parseFloat(priceOption.value);
					if (price === -100) {
						for (const displayName in activeGames[channelId].players) {
							const player = activeGames[channelId].players[displayName];
							const pointValue = activeGames[channelId].pointVal;

							calculateAllProfit(activeGames[channelId], displayName, true);
						}
						return res.send({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content: "Simulation is over.",
							},
						});
					} else if (isNaN(price) || price < 0) {
						return res.send({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content: "Invalid stock price. Please enter a valid number.",
								flags: InteractionResponseFlags.EPHEMERAL,
							},
						});
					} else {
						activeGames[channelId].stockPrice = price;

						const components = [
							{
								type: MessageComponentTypes.ACTION_ROW,
								components: [
									{
										type: 2,
										style: 3,
										label: "Buy",
										custom_id: `buy_share`,
									},
									{
										type: 2,
										style: 4,
										label: "Sell",
										custom_id: `sell_share`,
									},
									{
										type: 2,
										style: 1,
										label: "Close",
										custom_id: `close`,
									},
								],
							},
							{
								type: MessageComponentTypes.ACTION_ROW,
								components: [
									{
										type: 2,
										style: 1,
										label: "Reverse",
										custom_id: `reverse`,
									},
									{
										type: 2,
										style: 1,
										label: "x2",
										custom_id: `double`,
									},
									{
										type: 2,
										style: 1,
										label: "Trim",
										custom_id: `trim`,
									},
								],
							},
						];

						processLiquidation(activeGames[channelId]);

						const channel = await client.channels.fetch(channelId);
						await viewPositions(activeGames[channelId], channel);

						const timeoutDuration = 15000; // 15 seconds
						let remainingTime = timeoutDuration / 1000; // Convert to seconds

						const message = await channel.send({
							content: `The current price is ${price}. What do you want to do? You have ${remainingTime} seconds to respond.`,
							components: components,
						});

						// Update the message every 3 seconds
						const intervalId = setInterval(async () => {
							remainingTime -= 2; // Subtract five seconds

							// If no time is remaining, clear the interval, remove the buttons, and exit the function
							if (remainingTime <= 0) {
								clearInterval(intervalId);
								message
									.edit({
										content: `The current price was ${price}. Time's up!`,
										components: [], // Set components to an empty array to remove buttons
									})
									.catch(console.error); // Log errors to console
								return;
							}

							// Edit the message to show the updated remaining time
							await message
								.edit({
									content: `The current price is ${price}. What do you want to do? You have ${remainingTime} seconds to respond.`,
								})
								.catch(console.error); // Log errors to console
						}, 2000); // Run every 2 seconds

						return res.send({
							type: 4,
							data: {
								content: "Loading...",
								flags: InteractionResponseFlags.EPHEMERAL,
							},
						});
					}
				}
			}
		}

		if (name === "leaderboard") {
			// leaderboard command
			const userId = req.body.member.user.id;
			const channelId = req.body.channel_id;

			if (!activeGames[channelId]) {
				// There's no active game for this channel
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content:
							"There is currently no active simulation. Use /sim to start a new simulation.",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			} else {
				let pointValue = activeGames[channelId].pointVal;
				// There's an active game, so generate and send the leaderboard

				const channel = await client.channels.fetch(channelId);
				if (!channel) {
					throw new Error("Channel not found");
				}

				await viewLeaderboard(activeGames[channelId], channel, pointValue);

				// Acknowledge the interaction with a hidden response
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Command Executed",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			}
		}
		if (name === "current_positions") {
			// User use "current positions" command
			const userId = req.body.member.user.id;
			const channelId = req.body.channel_id;
			if (!activeGames[channelId]) {
				// There's no active game for this channel
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content:
							"There is currently no active simulation. Use /sim to start a new simulation.",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			} else {
				// There's an active game, so generate and send the positions
				const channel = await client.channels.fetch(channelId);
				if (!channel) {
					throw new Error("Channel not found");
				}

				await viewPositions(activeGames[channelId], channel);

				// Acknowledge the interaction with a hidden response
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content: "Command Executed",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			}
		}
		if (name === "liquidation_threshold") {
			const userId = req.body.member.user.id;
			const channelId = req.body.channel_id;

			if (!activeGames[channelId]) {
				// There's no active game for this channel
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content:
							"There is currently no active simulation. Use /sim to start a new simulation.",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			} else if (activeGames[channelId].ownerId !== userId) {
				// The user trying to set the price is not the owner of the game
				return res.send({
					type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
					data: {
						content:
							"Only the user who started the simulation can set the threshold value.",
						flags: InteractionResponseFlags.EPHEMERAL,
					},
				});
			} else {
				const username = req.body.member.user.username;
				const discriminator = req.body.member.user.discriminator;
				const displayName = `${username}#${discriminator}`;

				const threshold = options.find(
					(option) => option.name === "liquidation_threshold"
				);
				if (threshold) {
					const thresholdValue = parseFloat(threshold.value);
					if (isNaN(thresholdValue) || thresholdValue < 0) {
						return res.send({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content:
									"Invalid threshold value. Please enter a valid number.",
								flags: InteractionResponseFlags.EPHEMERAL,
							},
						});
					} else {
						activeGames[channelId].liquidationThreshold = thresholdValue;
						return res.send({
							type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
							data: {
								content: `The liquidation threshold is set to be ${thresholdValue}.`,
								flags: InteractionResponseFlags.EPHEMERAL,
							},
						});
					}
				}
			}
		}
	}

	if (type === InteractionType.MESSAGE_COMPONENT) {
		const componentId = data.custom_id;
		const channelId = req.body.channel_id;
		const userId = req.body.member.user.id;
		const username = req.body.member.user.username;
		const discriminator = req.body.member.user.discriminator;
		const displayName = `${username}#${discriminator}`;

		if (componentId === "start_sim") {
			// Start a new game
			const game = {
				players: {},
				stockPrice: 0,
				numDouble: 2,
				ownerId: req.body.member.user.id,
				pointVal: 1,
				liquidationThreshold: 2500,
			};
			activeGames[channelId] = game;

			return res.send({
				type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
				data: {
					content:
						"Simulation started. Please use the /setprice command to set the current price and use the /set_value command to set the value for each point.",
					flags: InteractionResponseFlags.EPHEMERAL,
				},
			});
		} else {
			processInteraction(componentId, activeGames, channelId, displayName, res);
		}
		//     else if (componentId.startsWith("buy")) {
		//       // User clicked "Buy" button
		//       // Add the user to the game's players if they aren't already in there
		//       if (!activeGames[channelId].players[displayName]) {
		//         activeGames[channelId].players[displayName] = {
		//           // Initialize properties
		//           position: "long",
		//           enterPrice: activeGames[channelId].stockPrice,
		//           profit: 0,
		//           numDouble: 2,
		//           posDouble: 0,
		//           num_correct: 0,
		//           num_trades: 1,
		//         };
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You opened a long position at ${activeGames[channelId].stockPrice}`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else if (activeGames[channelId].players[displayName]?.position) {
		//         // Player already has a position
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You already have a position open. Please close it before opening a new one.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else {
		//         activeGames[channelId].players[displayName].position = "long";
		//         activeGames[channelId].players[displayName].enterPrice =
		//           activeGames[channelId].stockPrice;
		//         activeGames[channelId].players[displayName].num_trades += 1;
		//         // Player has no position
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You opened a long position at ${activeGames[channelId].stockPrice}`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       }
		//     } else if (componentId.startsWith("sell")) {
		//       // User clicked "Sell" button
		//       // Add the user to the game's players if they aren't already in there
		//       if (!activeGames[channelId].players[displayName]) {
		//         activeGames[channelId].players[displayName] = {
		//           // Initialize properties
		//           position: "short",
		//           enterPrice: activeGames[channelId].stockPrice,
		//           profit: 0,
		//           numDouble: 2,
		//           posDouble: 0,
		//           num_correct: 0,
		//           num_trades: 1,
		//         };
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You opened a short position at ${activeGames[channelId].stockPrice}`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else if (activeGames[channelId].players[displayName]?.position) {
		//         // Player already has a position
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You already have a position open. Please close it before opening a new one.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else {
		//         activeGames[channelId].players[displayName].position = "short";
		//         activeGames[channelId].players[displayName].enterPrice =
		//           activeGames[channelId].stockPrice;
		//         activeGames[channelId].players[displayName].num_trades += 1;
		//         // Player has no position
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You opened a short position at ${activeGames[channelId].stockPrice}`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       }
		//     } else if (componentId.startsWith("close")) {
		//       // User clicked "Close" button
		//       if (
		//         !activeGames[channelId].players[displayName] ||
		//         !activeGames[channelId].players[displayName]?.position
		//       ) {
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You do not currently have a position. Cannot close.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else {
		//         const pointValue = activeGames[channelId].pointVal;
		//         let profitValue = calculateAllProfit(activeGames, channelId, displayName);
		//         profitValue *= pointValue

		//         const form_profit = profitValue.toFixed(2);
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You closed your position for a profit of ${form_profit}.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       }
		//     } else if (componentId.startsWith("reverse")) {
		//       // User clicked "Reverse" button
		//       // Give error message if they aren't already in the game
		//       if (!activeGames[channelId].players[displayName]) {
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You do not currently have a position. Cannot reverse.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else if (
		//         // Plyaer already has a short position
		//         activeGames[channelId].players[displayName]?.position === "short"
		//       ) {
		//         const pointValue = activeGames[channelId].pointVal;
		//         let profitValue;
		//         profitValue = calculateAllProfit(activeGames, channelId, displayName);

		//         activeGames[channelId].players[displayName].position = "long";
		//         activeGames[channelId].players[displayName].enterPrice =
		//           activeGames[channelId].stockPrice;
		//         activeGames[channelId].players[displayName].num_trades += 1;

		//         profitValue *= pointValue;
		//         const form_profit = profitValue.toFixed(2);
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You reversed your short position for a long position. The profit from your previous short position is ${form_profit}.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else if (
		//         activeGames[channelId].players[displayName]?.position === "long"
		//       ) {
		//         const pointValue = activeGames[channelId].pointVal;
		//         let profitValue;
		//         profitValue = calculateAllProfit(activeGames, channelId, displayName);

		//         activeGames[channelId].players[displayName].position = "short";
		//         activeGames[channelId].players[displayName].enterPrice =
		//           activeGames[channelId].stockPrice;
		//         activeGames[channelId].players[displayName].num_trades += 1;

		//         profitValue *= pointValue;
		//         const form_profit = profitValue.toFixed(2);
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You reversed your long position for a short position. The profit from your previous long position is ${form_profit}.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else {
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You do not currently have a position. Cannot reverse.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       }
		//     } else if (componentId.startsWith("double")) {
		//       // User clicked "double" button
		//       // Give error message if they aren't already in the game
		//       if (!activeGames[channelId].players[displayName] || !activeGames[channelId].players[displayName]?.position) {
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You do not currently have a position. Cannot double.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else if (activeGames[channelId].players[displayName]?.numDouble == 0) {
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You already used your double.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else if (activeGames[channelId].players[displayName]?.posDouble == 1) {
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You are in a double position already.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else {
		//         // User has a position and double is enabled
		//         activeGames[channelId].players[displayName].enterPrice =
		//           (activeGames[channelId].players[displayName].enterPrice+activeGames[channelId].stockPrice)/2;
		//         activeGames[channelId].players[displayName].numDouble -- ;
		//         activeGames[channelId].players[displayName].posDouble ++ ;

		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You have doubled your ${activeGames[channelId].players[displayName]?.position} position at an average price of ${activeGames[channelId].players[displayName]?.enterPrice}.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       }
		//     } else if (componentId.startsWith("trim")) {
		//       // User clicked "Trim" button
		//       if (
		//         !activeGames[channelId].players[displayName] ||
		//         !activeGames[channelId].players[displayName]?.position
		//       ) {
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You do not currently have a position. Cannot trim.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else if (activeGames[channelId].players[displayName]?.posDouble != 1) {

		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You are not currently in a double position. Cannot trim.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       } else {
		//         let profitValue;
		//         profitValue = calculatePartialProfit(activeGames, channelId, displayName)
		//         profitValue *= activeGames[channelId].pointVal

		//         const form_profit = profitValue.toFixed(2);
		//         return res.send({
		//           type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		//           data: {
		//             content: `You trimed your double position for a profit of ${form_profit}.`,
		//             flags: InteractionResponseFlags.EPHEMERAL,
		//           },
		//         });
		//       }
		//     }
	}
});

app.listen(PORT, () => {
	console.log("Listening on port", PORT);
});
