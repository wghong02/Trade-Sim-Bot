import 'dotenv/config';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
};

// Command
const SETPRICE_COMMAND = {
  name: 'setprice',
  description: 'Set the current price',
  options: [
    {
      type: 10,
      name: 'price',
      description: 'Price to set',
      required: true
    },
  ],
  type: 1, // CHAT_INPUT or slash command
};

const LEADERBOARD_COMMAND = {
  name: 'leaderboard',
  description: 'View the leaderboard',
  type: 1, // CHAT_INPUT or slash command
};

const ALL_COMMANDS = [TEST_COMMAND, SETPRICE_COMMAND, LEADERBOARD_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);