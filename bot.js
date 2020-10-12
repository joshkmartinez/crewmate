require('./server')();

const { Client, MessageEmbed } = require("discord.js");
const axios = require("axios");
const Statcord = require("statcord.js");
const config = require("./config");
const commands = require("./help");

let bot = new Client({
  fetchAllMembers: true, // Remove this if the bot is in large guilds.
  presence: {
    status: "online",
    activity: {
      name: `for ${config.prefix}help`,
      type: "WATCHING",
    },
  },
});
const statcord = new Statcord.Client({
  key: config.statcord,
  client: bot,
});

//TODO: Change channel topic

bot.on("ready", async () => {
  console.log(`Logged in as ${bot.user.tag}.`);
  await statcord.autopost();
});
statcord.on("autopost-start", () => {
  console.log("Started statcord autopost.");
});

const startGameError =
  "A game of Among Us has not been started in this channel.\nSend a game code to start one!";
const userPermsError =
  "You need to be the game master or have manage message permissions in order run this command.";

bot.on("message", async (message) => {
  // Check for command
  if (message.content.startsWith(config.prefix)) {
    let args = message.content.slice(config.prefix.length).split(" ");
    let command = args.shift().toLowerCase();
    try {
      await statcord.postCommand(command, message.author.id);
    } catch (e) {
      console.log("Failed to post command stats to statcord");
    }
    switch (command) {
      case "ping":
      case "p":
        let m = await message.channel.send("Pong 🏓");
        return  m.edit(
          `Pong 🏓\nBot latency is ${
            m.createdTimestamp - message.createdTimestamp
          }ms. Discord API Latency is ${bot.ws.ping}ms`
        );

      /* Unless you know what you're doing, don't change this command. */
      case "help":
      case "h":
        let embed = new MessageEmbed()
          .setTitle("Among Us Bot Commands")
          .setColor("#C0EFDB")
          .setFooter(
            `Requested by: ${
              message.member
                ? message.member.displayName
                : message.author.username
            }`,
            message.author.displayAvatarURL()
          )
          .setThumbnail(bot.user.displayAvatarURL());
        if (!args[0]) {
          embed.setDescription(
            Object.keys(commands)
              .map(
                (command) =>
                  `\`${command.padEnd(
                    Object.keys(commands).reduce(
                      (a, b) => (b.length > a.length ? b : a),
                      ""
                    ).length
                  )}\` - ${commands[command].description}`
              )
              .join("\n")
          );
          embed.addField(
            "Please consider upvoting Crewmate :smiley:",
            "https://discordbotlist.com/bots/crewmate-3698"
          );
          embed.addField(
            "Bot invite link",
            "https://discord.com/oauth2/authorize?client_id=762721168741761075&permissions=4196416&scope=bot"
          );
          embed.addField("Support server invite", "https://discord.gg/aRA7WcX");
        } else {
          if (
            Object.keys(commands).includes(args[0].toLowerCase()) ||
            Object.keys(commands)
              .map((c) => commands[c].aliases || [])
              .flat()
              .includes(args[0].toLowerCase())
          ) {
            let command = Object.keys(commands).includes(args[0].toLowerCase())
              ? args[0].toLowerCase()
              : Object.keys(commands).find(
                  (c) =>
                    commands[c].aliases &&
                    commands[c].aliases.includes(args[0].toLowerCase())
                );
            embed.setTitle(`COMMAND - ${command}`);

            if (commands[command].aliases)
              embed.addField(
                "Command aliases",
                `\`${commands[command].aliases.join("`, `")}\``
              );
            embed
              .addField("DESCRIPTION", commands[command].description)
              .addField(
                "FORMAT",
                `\`\`\`${config.prefix}${commands[command].format}\`\`\``
              );
          } else {
            embed
              .setColor("RED")
              .setDescription(
                "This command does not exist. Please use the help command without specifying any commands to list them all."
              );
          }
        }
        return message.channel.send(embed);
      case "end":
      case "stop":
        let games = await getGames();
        for (i = 0; i < Object.keys(games).length; i++) {
          if (Object.keys(games)[i] === message.channel.id) {
            if (
              Object.values(games)[i].gamemaster === message.author.id ||
              message.channel
                .permissionsFor(message.member)
                .has("MANAGE_MESSAGES")
            ) {
              const gameCode = Object.values(games)[i].code;
              delete games[message.channel.id];
              try {
                await endGame(games);
                return message.reply(
                  "The game, `" +
                    gameCode +
                    "`, has been ended in this channel."
                );
              } catch (e) {
                return message.reply(
                  "Error ending game `" + gameCode + "`. Please try again."
                );
              }
            } else {
              return message.reply(userPermsError);
            }
          }
        }
        return message.reply(startGameError);
      case "start":
      case "s":
      case "begin":
        if (!isValidGameCode(args[0])) {
          return message.reply(
            "Provide a game code in order to start a game\nRun `>help start` for more information"
          );
        }
        return startGameCheck(message, args[0]);

      case "mute":
      case "m":
        return toggleVCMute(message);

      case "unmute":
      case "um":
        return toggleVCMute(message, false);
    }
  }
});

let isValidGameCode = (code) => {
  if (code == null) {
    return false;
  }
  for (let i = 0; i < code.length; i++) {
    if (!Boolean(code.charAt(i).match(/[a-zA-Z]/))) {
      return false;
    }
  }
  return code.length === 6 && code === code.toUpperCase();
};

let getGames = async () => {
  const response = await axios.get(config.db);
  return response.data;
};

let startGame = async (guild, channel, gamemaster, code) => {
  const games = await getGames();

  axios
    .put(config.db, {
      ...games,
      [channel]: {
        guild: guild,
        channel: channel,
        "start-time": Math.floor(new Date().getTime() / 100 / 60 / 60), //hours
        gamemaster: gamemaster,
        code: code,
      },
    })
    .then((response) => {
      //console.log(response.data);
    })
    .catch((error) => {
      console.log(error);
    });
};

let endGame = (games) => {
  axios
    .put(config.db, games)
    .then((response) => {
      //console.log(response.data);
    })
    .catch((error) => {
      console.log(error);
    });
};

let existingGameCheck = async (message) => {
  let games = await getGames();
  for (i = 0; i < Object.keys(games).length; i++) {
    if (Object.keys(games)[i] === message.channel.id) {
      return true;
    }
  }
  return false;
};

let startGameCheck = async (message, code) => {
  if (isValidGameCode(code)) {
    //check for an existing game
    if (await existingGameCheck(message)) {
      return message.reply(
        "`" +
          code +
          "` looks like an Among Us game code, but a game is already being played in this channel.\nMention <@762721168741761075> to find the current game code.\nIf this game is over, run `>end`. The game will automatically end after 3 hours if it is not ended manually."
      );
    }

    let m = await message.reply(
      "`" +
        code +
        "` looks like an Among Us game code.\nWould you save this code and start a game?"
    );
    await m.react("✅").then(await m.react("❌"));

    const timeout = setTimeout(async () => {
      try {
        await m.edit(
          "Timeout reached. The game, `" +
            code +
            "` will not be saved.\nIf this was a mistake, send the game code again. Run `>help` for more information."
        );
        return m.reactions.removeAll();
      } catch (e) {}
    }, 10000);

    m.awaitReactions(
      (reaction, user) => {
        if (reaction.emoji.name !== "✅" || user.id !== message.author.id) {
          return false;
        }
        return true;
      },
      { max: 1 }
    ).then(async () => {
      clearTimeout(timeout);
      try {
        await startGame(
          message.guild.id,
          message.channel.id,
          message.author.id,
          code
        );
        await m.edit(
          "The game, `" +
            code +
            "`, has been saved.\nJust got here? Mention <@" +
            bot.user.id +
            "> to find the current game code."
        );
      } catch {
        await m.edit(
          "The game, `" +
            code +
            "` has failed to save.\nPlease try again later."
        );
      }

      m.reactions.removeAll();
    });
  }
};

let toggleVCMute = async (message, state = true) => {
  let games = await getGames();
  for (i = 0; i < Object.keys(games).length; i++) {
    if (Object.keys(games)[i] === message.channel.id) {
      if (
        Object.values(games)[i].gamemaster === message.author.id ||
        message.channel.permissionsFor(message.member).has("MANAGE_MESSAGES")
      ) {
        const gameCode = Object.values(games)[i].code;
        if (message.member.voice.channel) {
          let channel = message.guild.channels.cache.get(
            message.member.voice.channel.id
          );
          for (const [memberID, member] of channel.members) {
            try {
              member.voice.setMute(state);
            } catch (e) {
              await message.channel.send(
                "Error " +
                  (state ? "muting" : "unmuting") +
                  " " +
                  member.mention
              );
            }
          }
        } else {
          return message.reply(
            "You need to be in a voice channel to run this command."
          );
        }
        return message.reply(
          "The members of the game, `" +
            gameCode +
            "`, have all been " +
            (state ? "muted" : "unmuted") +
            "\nIf you are still " +
            (state ? "muted" : "unmuted") +
            " its because of a permissions error. Ensure that the bot role is above all other roles."
        );
      } else {
        return message.reply(userPermsError);
      }
    }
  }
  return message.reply(startGameError);
};

bot.on("message", async (message) => {
  let code = message.content;
  if (isValidGameCode(code)) {
    try {
      await statcord.postCommand("CODE_START", message.author.id);
    } catch (e) {
      console.log("Failed to post command stats to statcord");
    }
  }
  await startGameCheck(message, code);
});

// send game code on mention
bot.on("message", async (message) => {
  if (!message.mentions.has(bot.user)) return;
  try {
    await statcord.postCommand("CODE_SEND", message.author.id);
  } catch (e) {
    console.log("Failed to post command stats to statcord");
  }
  const games = await getGames();
  for (i = 0; i < Object.keys(games).length; i++) {
    if (Object.keys(games)[i] === message.channel.id) {
      let msg =
        "A game is currently being played in this channel.\nUse the code `" +
        Object.values(games)[i].code +
        "` to join it!";
      if (Object.values(games)[i].gamemaster === message.author.id) {
        msg +=
          "\nYou are the game master of this game. To end this game, run `>end`.\nThe game will automatically end after 3 hours if it is not ended manually.";
      }
      return message.reply(msg);
    }
  }
  return message.reply(startGameError);
});

bot.login(config.token);
