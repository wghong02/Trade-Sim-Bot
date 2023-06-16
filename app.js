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
import { viewLeaderboard } from "./game.js";

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

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
    if (name === "setprice") {
      const userId = req.body.member.user.id;
      
        if (!activeGames[userId]) {
    // There's no active game for this user
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "There is currently no active simulation. Use /sim to start a new simulation.",
            },
          });
        }
      const username = req.body.member.user.username;
      const discriminator = req.body.member.user.discriminator;
      const displayName = `${username}#${discriminator}`;

      const priceOption = options.find((option) => option.name === "price");
      if (priceOption) {
        const price = parseFloat(priceOption.value);
        if (price === -100) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "Simulation is over. Click to view the leaderboard ",
              components: [
                {
                  type: MessageComponentTypes.ACTION_ROW,
                  components: [
                    {
                      type: 2,
                      label: "View Leaderboard",
                      style: 1,
                      custom_id: "leaderboard",
                    },
                  ],
                },
              ],
            },
          });
        } else if (isNaN(price) || price < 0) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "Invalid stock price. Please enter a valid number.",
            },
          });
        } else {
          activeGames[userId].stockPrice = price;

          // Send a response indicating the price has been updated.
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `The current price is ${price}. Do you want to buy or sell?`,
              components: [
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
                  ],
                },
              ],
            },
          });
        }
      }
    }
    if (name === "leaderboard") {
      // leaderboard command
      const userId = req.body.member.user.id;
      if (!activeGames[userId]) {
        // There's no active game for this user
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              "There is currently no active simulation. Use /sim to start a new simulation.",
          },
        });
      } else {
        // There's an active game, so generate and send the leaderboard
        const message = viewLeaderboard(activeGames[userId]);
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
    const userId = req.body.member.user.id;
    const username = req.body.member.user.username;
    const discriminator = req.body.member.user.discriminator;
    const displayName = `${username}#${discriminator}`;

    if (componentId === "start_sim") {
      // Start a new game
      const game = {
        players: {},
        stockPrice: 0,
      };
      activeGames[userId] = game;

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
      if (!activeGames[userId].players[displayName]) {
        activeGames[userId].players[displayName] = {
          // Initialize properties
          position: "long",
          enterPrice: activeGames[userId].stockPrice,
          profit: 0,
        };
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You opened a long position at ${activeGames[userId].stockPrice}`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (
        activeGames[userId].players[displayName]?.position === "short"
      ) {
        const profit =
          activeGames[userId].players[displayName].enterPrice -
          activeGames[userId].stockPrice;
        activeGames[userId].players[displayName].profit += profit;
        activeGames[userId].players[displayName].position = null;
        activeGames[userId].players[displayName].enterPrice =
          activeGames[userId].stockPrice;

        const form_profit = profit.toFixed(2);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You covered your short position for a profit of ${form_profit}.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (
        activeGames[userId].players[displayName]?.position === "long"
      ) {
        // Player already has a long position
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You already have a long position open.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else {
        activeGames[userId].players[displayName].position = "long";
        activeGames[userId].players[displayName].enterPrice =
          activeGames[userId].stockPrice;
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You opened a long position at ${activeGames[userId].stockPrice}`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    } else if (componentId.startsWith("sell")) {
      // User clicked "Sell" button
      // Add the user to the game's players if they aren't already in there
      if (!activeGames[userId].players[displayName]) {
        activeGames[userId].players[displayName] = {
          // Initialize properties
          position: "short",
          enterPrice: activeGames[userId].stockPrice,
          profit: 0,
        };
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You opened a short position at ${activeGames[userId].stockPrice}`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (
        activeGames[userId].players[displayName]?.position === "long"
      ) {
        const profit =
          activeGames[userId].stockPrice -
          activeGames[userId].players[displayName].enterPrice;
        activeGames[userId].players[displayName].profit += profit;
        activeGames[userId].players[displayName].position = null;
        activeGames[userId].players[displayName].enterPrice =
          activeGames[userId].stockPrice;

        const form_profit = profit.toFixed(2);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You sold your long position for a profit of ${form_profit}.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (
        activeGames[userId].players[displayName]?.position === "short"
      ) {
        // Player already has a short position
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You already have a short position open.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else {
        activeGames[userId].players[displayName].position = "short";
        activeGames[userId].players[displayName].enterPrice =
          activeGames[userId].stockPrice;
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You opened a short position at ${activeGames[userId].stockPrice}`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    } else if (componentId.startsWith("leaderboard")) {
      // User clicked "Sell" button
      if (!activeGames[userId]) {
        // There's no active game for this user
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content:
              "There is currently no active simulation. Use /sim to start a new simulation.",
          },
        });
      } else {
        // There's an active game, so generate and send the leaderboard
        const message = viewLeaderboard(activeGames[userId]);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: message,
          },
        });
      }
    }
  }
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
