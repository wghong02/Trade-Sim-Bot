import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from "discord-interactions";

import { capitalize } from "./utils.js";
import { viewLeaderboard, viewPositions, viewRules, calculateAllProfit, calculatePartialProfit } from "./basic_functions.js";


export function processInteraction(componentId, activeGames, channelId, displayName, res) {
      if (componentId.startsWith("buy")) {
      // User clicked "Buy" button
      // Add the user to the game's players if they aren't already in there
        if (!activeGames[channelId].players[displayName]) {
          activeGames[channelId].players[displayName] = {
            // Initialize properties
            position: "long",
            enterPrice: activeGames[channelId].stockPrice,
            profit: 0,
            numDouble: activeGames[channelId].numDouble,
            posDouble: 0,
            num_correct: 0,
            num_trades: 1,
            liquidated: false,
          };
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `You opened a long position at ${activeGames[channelId].stockPrice}`,
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          });
      } else if (activeGames[channelId].players[displayName].liquidated) {
        // Player is liquidated
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You are liquidated. Cannot participate in the trade sim. Please try again next time`,
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
          numDouble: activeGames[channelId].numDouble,
          posDouble: 0,
          num_correct: 0,
          num_trades: 1,
          liquidated: false,
        };
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You opened a short position at ${activeGames[channelId].stockPrice}`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (activeGames[channelId].players[displayName].liquidated) {
        // Player is liquidated
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You are liquidated. Cannot participate in the trade sim. Please try again next time`,
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
        const pointValue = activeGames[channelId].pointVal;
        let profitValue = calculateAllProfit(activeGames[channelId], displayName, true);
        profitValue *= pointValue
        
        const form_profit = profitValue.toFixed(2);
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
        const pointValue = activeGames[channelId].pointVal;
        let profitValue;
        profitValue = calculateAllProfit(activeGames[channelId], displayName, true);
        
        activeGames[channelId].players[displayName].position = "long";
        activeGames[channelId].players[displayName].enterPrice =
          activeGames[channelId].stockPrice;
        activeGames[channelId].players[displayName].num_trades += 1;
        
        profitValue *= pointValue;
        const form_profit = profitValue.toFixed(2);
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
        const pointValue = activeGames[channelId].pointVal;
        let profitValue;
        profitValue = calculateAllProfit(activeGames[channelId], displayName, true);
        
        activeGames[channelId].players[displayName].position = "short";
        activeGames[channelId].players[displayName].enterPrice =
          activeGames[channelId].stockPrice;
        activeGames[channelId].players[displayName].num_trades += 1;
        
        profitValue *= pointValue;
        const form_profit = profitValue.toFixed(2);
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
      } else if (activeGames[channelId].players[displayName]?.numDouble == 0) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You already used your double.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else if (activeGames[channelId].players[displayName]?.posDouble == 1) {
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
        activeGames[channelId].players[displayName].numDouble -- ;
        activeGames[channelId].players[displayName].posDouble ++ ;
        
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
      } else if (activeGames[channelId].players[displayName]?.posDouble != 1) {
        
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You are not currently in a double position. Cannot trim.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      } else {
        let profitValue;
        profitValue = calculatePartialProfit(activeGames[channelId], displayName)
        profitValue *= activeGames[channelId].pointVal

        const form_profit = profitValue.toFixed(2);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `You trimed your double position for a profit of ${form_profit}.`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    }
}

