import "dotenv/config";
import { capitalize, InstallGlobalCommands } from "./utils.js";

// Simple test command
const SIM_COMMAND = {
  name: "sim",
  description: "Start the Simulation",
  type: 1,
};

// Command
const SETPRICE_COMMAND = {
  name: "setprice",
  description: "Set the current price",
  options: [
    {
      type: 10,
      name: "price",
      description: "Price to set",
      required: true,
    },
  ],
  type: 1, // CHAT_INPUT or slash command
};

const LEADERBOARD_COMMAND = {
  name: "leaderboard",
  description: "View the leaderboard",
  type: 1, // CHAT_INPUT or slash command
};

const CURRENT_POSITIONS_COMMAND = {
  name: "current_positions",
  description: "View the current positions",
  type: 1, // CHAT_INPUT or slash command
};

const ALL_COMMANDS = [SIM_COMMAND, SETPRICE_COMMAND, LEADERBOARD_COMMAND, CURRENT_POSITIONS_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
