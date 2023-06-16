import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from 'discord-interactions';
import { VerifyDiscordRequest, getRandomEmoji, DiscordRequest } from './utils.js';
// import { getShuffledOptions, getResult } from './game.js';



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
app.post('/interactions', async function (req, res) {
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

    // "test" command
    if (name === 'test') {
      const userId = req.body.member.user.id;

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Click to start the simulation.',
          flags: InteractionResponseFlags.EPHEMERAL,
          components: [{
            type: MessageComponentTypes.ACTION_ROW,
            components: [
              {
                type: 2,
                label: 'Start Sim',
                style: 1,
                custom_id: 'start_sim'
              }
            ]
          }]
        },
      });
    }
    if (name === 'setprice') {
      const userId = req.body.member.user.id;
      const priceOption = options.find(option => option.name === 'price');
      if (priceOption) {
        const price = parseFloat(priceOption.value);
        if (price === -100){
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'Simulation is over. Click to view the leaderboard',
              components: [{
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: 2,
                    label: 'View Leaderboard',
                    style: 1,
                    custom_id: 'leaderboard'
                  }
                ]
              }]
            },
          });
        }
        if (!isNaN(price) || price < 0) {
          activeGames[userId].stockPrice = price;
          activeGames[userId].waitingForPrice = false;

          // Send a response indicating the price has been updated.
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Stock price set to ${price}.`,
            },
          });
        } else {
          // Invalid price entered.
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'Invalid stock price. Please enter a valid number.',
            },
          });
        }
      }
    }
  }
  
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const componentId = data.custom_id;
    const userId = req.body.member.user.id;

    if (componentId === 'start_sim') {
      // If a game already exists for this user, end it
      if (activeGames[userId]) {
        delete activeGames[userId];
      }

      // Start a new game
      const game = {
        players: {},
        stockPrice: 0
      };
      activeGames[userId] = game;

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'Simulation started. Please use the /setprice command to set the current price.',
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
      
    } else if (componentId.startsWith('buy')) {
      // User clicked "Buy" button
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `${userId} bought a position`,
        },
      });
    } else if (componentId.startsWith('sell')) {
      // User clicked "Sell" button
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `${userId} sold a position`,
        },
      });
    } else if (componentId.startsWith('leaderboard')) {
      // User clicked "Sell" button
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `${userId} is viewing the leaderboard`,
        },
      });
    }
  }
});    


app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
