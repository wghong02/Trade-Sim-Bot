# Trade-Sim-Bot
A discord Trading Simulation Bot

This is a discord Trading Simulation Bot, build to help traders backtest their strategies and improve from their mistakes.

### Setup the bot

First clone the project:
```
git clone https://github.com/GilbertHong2/Trade-Sim-Bot.git
```

Then navigate to its directory and install dependencies:
```
cd discord-example-app
npm install
```
### Get app credentials

App ID (`APP_ID`), bot token (`DISCORD_TOKEN`), and public key (`PUBLIC_KEY`) are needed for the bot to function properly. The corresponding credentials should be included in the .env file.

Fetching credentials is covered in detail in the [getting started guide](https://discord.com/developers/docs/getting-started).

> 🔑 Environment variables can be added to the `.env` file in Glitch or when developing locally, and in the Secrets tab in Replit (the lock icon on the left).

### Install slash commands

In order to install the slash command functions, you need to use the `register` command configured in `package.json` to activate it:

```
npm run register
```

### Run the app

After your credentials are added, you can the app locally:

```
node app.js
```

and then you should be able to access the bot in your server.

### Bot commands:

#### sim

The simulation command. Use "/sim" in the channel to use the bot to start a simulation. After calling the command, you need to click a button named "Start Sim" to start the simulation.

Note that if you start a new simulation when the old one is not finished, the old one will be deleted. 

Typically the session would preserve as

#### setprice

Use this command to set the price of the stock each turn. Everytime a number is put in, the bot would send a message in the channel to ask the players if they want to "Buy" or "Sell" their positions. If the player does not wish to do anything to their position, simply ignore the buttons.

Note that only one share/position is allowed for each player at a time. If you wish to formally conclude the simulation, please enter the price -100. Then it would show the leaderboard at the end.

#### leaderboard

Use this command to view the leaderboard of all players.