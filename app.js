import "dotenv/config";
import express from "express";
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from "discord-interactions";
import {
  VerifyDiscordRequest,
  getRandomEmoji,
  DiscordRequest,
} from "./utils.js";
import { viewLeaderboard, viewPositions, viewRules } from "./game.js";

import { Client, GatewayIntentBits } from 'discord.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.login(process.env.DISCORD_TOKEN);

client.on('ready', () => {
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
    if (name === "settick") {
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
              "Only the user who started the simulation can set the tick value.",
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else {
        const username = req.body.member.user.username;
        const discriminator = req.body.member.user.discriminator;
        const displayName = `${username}#${discriminator}`;

        const tickOption = options.find((option) => option.name === "tick");
        if (tickOption) {
          const tick = parseFloat(tickOption.value);
          if (isNaN(tick) || tick < 0) {
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: "Invalid tick value. Please enter a valid number.",
                flags: InteractionResponseFlags.EPHEMERAL,
              },
            });
          } else {
            activeGames[channelId].tick_val = tick;
            return res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `1 tick is set to be ${tick}.`,
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
              const tick = activeGames[channelId].tick_val

              let profit;
              if (activeGames[channelId].players[displayName].position === "long") {
                profit =
                  activeGames[channelId].stockPrice -
                  activeGames[channelId].players[displayName].enterPrice;
              } else {
                profit =
                  activeGames[channelId].players[displayName].enterPrice -
                  activeGames[channelId].stockPrice;
              }

              if (activeGames[channelId].players[displayName].double == 1) {
                activeGames[channelId].players[displayName].double = 0;
                profit *= 2;
                    }
              profit = profit/tick;
              activeGames[channelId].players[displayName].profit += profit;
              activeGames[channelId].players[displayName].position = null;
              activeGames[channelId].players[displayName].enterPrice = null;      
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

            // Send a response indicating the price has been updated.
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
                ],
              },
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: 2,
                    style: 1,
                    label: "Trim",
                    custom_id: `trim`,
                  },
                ],
              },
            ];
            
            const channel = await client.channels.fetch(channelId);
            
            const message = await channel.send({
                content: `The current price is ${price}. What do you want to do?`,
                components: components,
            })
            
            setTimeout(() => {
              message.edit({
                components: [], // Set components to an empty array to remove buttons
              }).catch(console.error); // Log errors to console
            }, 15000);
            
            return res.send({
              type: 4,
              data: {
                content: 'Loading...',
                flags: InteractionResponseFlags.EPHEMERAL,
              },
            });

            // Send response
            // return res.send({
            //   type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            //   data: {
            //     content: `The current price is ${price}. What do you want to do?`,
            //     components: [
            //       {
            //         type: MessageComponentTypes.ACTION_ROW,
            //         components: components,
            //       },
            //     ],
            //   },
            // });
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
        // There's an active game, so generate and send the leaderboard
        const message = viewLeaderboard(activeGames[channelId]);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: message,
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
        // There's an active game, so generate and send the leaderboard
        const message = viewPositions(activeGames[channelId]);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: message,
          },
        });
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
        ownerId: req.body.member.user.id,
        tick_val: 1,
      };
      activeGames[channelId] = game;

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content:
            "Simulation started. Please use the /setprice command to set the current price.",
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    } else if (componentId.startsWith("buy")) {
      // User clicked "Buy" button
      // Add the user to the game's players if they aren't already in there
      if (!activeGames[channelId].players[displayName]) {
        activeGames[channelId].players[displayName] = {
          // Initialize properties
          position: "long",
          enterPrice: activeGames[channelId].stockPrice,
          profit: 0,
          double: 2,
          num_trades: 1,
        };
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You opened a long position at ${activeGames[channelId].stockPrice}`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (activeGames[channelId].players[displayName]?.position) {
        // Player already has a position
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You already have a position open. Please close it before opening a new one.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else {
        activeGames[channelId].players[displayName].position = "long";
        activeGames[channelId].players[displayName].enterPrice =
          activeGames[channelId].stockPrice;
        activeGames[channelId].players[displayName].num_trades += 1;
        // Player has no position
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You opened a long position at ${activeGames[channelId].stockPrice}`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    } else if (componentId.startsWith("sell")) {
      // User clicked "Sell" button
      // Add the user to the game's players if they aren't already in there
      if (!activeGames[channelId].players[displayName]) {
        activeGames[channelId].players[displayName] = {
          // Initialize properties
          position: "short",
          enterPrice: activeGames[channelId].stockPrice,
          profit: 0,
          double: 2,
          num_trades: 1,
        };
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You opened a short position at ${activeGames[channelId].stockPrice}`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (activeGames[channelId].players[displayName]?.position) {
        // Player already has a position
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You already have a position open. Please close it before opening a new one.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else {
        activeGames[channelId].players[displayName].position = "short";
        activeGames[channelId].players[displayName].enterPrice =
          activeGames[channelId].stockPrice;
        activeGames[channelId].players[displayName].num_trades += 1;
        // Player has no position
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You opened a short position at ${activeGames[channelId].stockPrice}`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    } else if (componentId.startsWith("close")) {
      // User clicked "Close" button
      if (
        !activeGames[channelId].players[displayName] ||
        !activeGames[channelId].players[displayName]?.position
      ) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You do not currently have a position. Cannot close.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else {
        const tick = activeGames[channelId].tick_val
        
        let profit;
        if (activeGames[channelId].players[displayName].position === "long") {
          profit =
            activeGames[channelId].stockPrice -
            activeGames[channelId].players[displayName].enterPrice;
        } else {
          profit =
            activeGames[channelId].players[displayName].enterPrice -
            activeGames[channelId].stockPrice;
        }

        if (activeGames[channelId].players[displayName].double == 1) {
          activeGames[channelId].players[displayName].double = 0;
          profit *= 2;
        }
        
        profit = profit/tick;
        activeGames[channelId].players[displayName].profit += profit;
        activeGames[channelId].players[displayName].position = null;
        activeGames[channelId].players[displayName].enterPrice = null;

        const form_profit = profit.toFixed(2);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You closed your position for a profit of ${form_profit}.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    } else if (componentId.startsWith("reverse")) {
      // User clicked "Reverse" button
      // Give error message if they aren't already in the game
      if (!activeGames[channelId].players[displayName]) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You do not currently have a position. Cannot reverse.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (
        // Plyaer already has a short position
        activeGames[channelId].players[displayName]?.position === "short"
      ) {
        const tick = activeGames[channelId].tick_val
        let profit =
          activeGames[channelId].players[displayName].enterPrice -
          activeGames[channelId].stockPrice;

        if (activeGames[channelId].players[displayName].double == 1) {
          activeGames[channelId].players[displayName].double = 0;
          profit *= 2;
        }
        
        profit = profit/tick;
        activeGames[channelId].players[displayName].profit += profit;
        activeGames[channelId].players[displayName].position = "long";
        activeGames[channelId].players[displayName].enterPrice =
          activeGames[channelId].stockPrice;

        const form_profit = profit.toFixed(2);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You reversed your short position for a long position. The profit from your previous short position is ${form_profit}.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (
        activeGames[channelId].players[displayName]?.position === "long"
      ) {
        const tick = activeGames[channelId].tick_val
        let profit =
          activeGames[channelId].stockPrice -
          activeGames[channelId].players[displayName].enterPrice;

        if (activeGames[channelId].players[displayName].double == 1) {
          activeGames[channelId].players[displayName].double = 0;
          profit *= 2;
        }

        profit = profit/tick;
        activeGames[channelId].players[displayName].profit += profit;
        activeGames[channelId].players[displayName].position = "short";
        activeGames[channelId].players[displayName].enterPrice =
          activeGames[channelId].stockPrice;

        const form_profit = profit.toFixed(2);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You reversed your long position for a short position. The profit from your previous long position is ${form_profit}.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You do not currently have a position. Cannot reverse.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    } else if (componentId.startsWith("double")) {
      // User clicked "double" button
      // Give error message if they aren't already in the game
      if (!activeGames[channelId].players[displayName] || !activeGames[channelId].players[displayName]?.position) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You do not currently have a position. Cannot double.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (activeGames[channelId].players[displayName]?.double == 0) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You already used your double.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (activeGames[channelId].players[displayName]?.double == 1) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You are in a double position already.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else {
        // User has a position and double is enabled
        activeGames[channelId].players[displayName].enterPrice = 
          (activeGames[channelId].players[displayName].enterPrice+activeGames[channelId].stockPrice)/2;
        activeGames[channelId].players[displayName].double = 1;
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You have doubled your ${activeGames[channelId].players[displayName]?.position} position at an average price of ${activeGames[channelId].players[displayName]?.enterPrice}.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    } else if (componentId.startsWith("trim")) {
      // User clicked "Trim" button
      if (
        !activeGames[channelId].players[displayName] ||
        !activeGames[channelId].players[displayName]?.position
      ) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You do not currently have a position. Cannot trim.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (activeGames[channelId].players[displayName]?.double != 1) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You are not currently in a double position. Cannot trim.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else {
        let profit;
        const tick = activeGames[channelId].tick_val
        if (activeGames[channelId].players[displayName].position === "long") {
          profit =
            activeGames[channelId].stockPrice -
            activeGames[channelId].players[displayName].enterPrice;
        } else {
          profit =
            activeGames[channelId].players[displayName].enterPrice -
            activeGames[channelId].stockPrice;
        }
        
        profit = profit/tick;
        activeGames[channelId].players[displayName].profit += profit;
        activeGames[channelId].players[displayName].double = 0;

        const form_profit = profit.toFixed(2);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You trimed your double position for a profit of ${form_profit}.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    }
    
    
    //   else if (componentId.startsWith("leaderboard")) {
    //   // User clicked "leaderboard" button
    //   if (!activeGames[channelId]) {
    //     // There's no active game for this user
    //     return res.send({
    //       type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    //       data: {
    //         content:
    //           "There is currently no active simulation. Use /sim to start a new simulation.",
    //         flags: InteractionResponseFlags.EPHEMERAL,
    //       },
    //     });
    //   } else {
    //     // There's an active game, so generate and send the leaderboard
    //     const message = viewLeaderboard(activeGames[channelId]);
    //     return res.send({
    //       type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    //       data: {
    //         content: message,
    //       },
    //     });
    //   }
    // }
  }
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
