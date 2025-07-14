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

const RULES_COMMAND = {
  name: "rules",
  description: "View the rules",
  type: 1, // CHAT_INPUT or slash command
};

const SETVALUE_COMMAND = {
  name: "set_value",
  description: "Set the value for 1 point",
  options: [
    {
      type: 10,
      name: "set_value",
      description: "Tick to set",
      required: true,
    },
  ],
  type: 1, // CHAT_INPUT or slash command
};

const SETDOUBLES_COMMAND = {
  name: "set_double",
  description: "Set number of doubles in the sim",
  options: [
    {
      type: 10,
      name: "set_double",
      description: "Double to set",
      required: true,
    },
  ],
  type: 1, // CHAT_INPUT or slash command
};

const CLOSE_ALL_COMMAND = {
  name: "close_all",
  description: "Close All Current Positions",
  type: 1, // CHAT_INPUT or slash command
};

const LIQUIDATION_THRESHOLD_COMMAND = {
  name: "liquidation_threshold",
  description: "Set the threshold for liquidation.",
  options: [
    {
      type: 10,
      name: "liquidation_threshold",
      description: "liquidation threshold",
      required: true,
    },
  ],
  type: 1,
};

const ALL_COMMANDS = [SIM_COMMAND, SETPRICE_COMMAND, SETDOUBLES_COMMAND, LEADERBOARD_COMMAND, CURRENT_POSITIONS_COMMAND, RULES_COMMAND, SETVALUE_COMMAND, CLOSE_ALL_COMMAND, LIQUIDATION_THRESHOLD_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
