require("./server")();

const { Client, MessageEmbed } = require("discord.js");
const axios = require("axios");
const Statcord = require("statcord.js");
const config = require("./config");
const commands = require("./help");

let bot = new Client({
  fetchAllMembers: true, // Remove this bot is in large servers.
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

bot.on("ready", async () => {
  console.log(`Logged in as ${bot.user.tag}.`);
  await statcord.autopost();
});
statcord.on("autopost-start", () => {
  console.log("Started statcord autopost.");
});

const startGameError =
  "A game of Among Us has been started yet.\nSend a game room code to start one!";
const userPermsError =
  "You need to be the game master or have manage message permissions in order run this command.";

//match, game command that returns a random game that has under 10 players
// list games with max players last, 7-9 first

bot.on("message", async (message) => {
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
        return m.edit(
          `Pong 🏓\nBot latency is ${
            m.createdTimestamp - message.createdTimestamp
          }ms. Discord API Latency is ${bot.ws.ping}ms`
        );

      case "help":
      case "h":
        let embed = new MessageEmbed()
          .setTitle("Crewmate Bot Commands")
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
            "Like Crewate?",
            "Please consider [upvoting Crewmate](https://discordbotlist.com/bots/crewmate-3698) :smiley:\nOr you can [invite the bot to your own server!](https://discord.com/oauth2/authorize?client_id=762721168741761075&permissions=4196416&scope=bot)"
          );

          embed.addField(
            "Need help?",
            "[Join the Crewmate Bot Support Server](https://discord.gg/aRA7WcX)"
          );
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
      case "remove":
        const endCode = args[0];
        let games = Object.values(await getGames());
        for (i = 0; i < games.length; i++) {
          if (
            games[i].guild === message.guild.id && endCode == null
              ? games[i].gamemaster === message.author.id //not given code
              : games[i].code === endCode //given code, code is for a specific game in the server
          ) {
            if (
              games[i].gamemaster === message.author.id ||
              message.channel
                .permissionsFor(message.member)
                .has("MANAGE_MESSAGES")
            ) {
              const gameCode = games[i].code;
              games.splice(i, 1);

              try {
                await endGame(games);
                return message.reply(
                  "The game, `" + gameCode + "`, has been ended."
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
            "Provide a game room code in order to start a game\nRun `>help start` for more information"
          );
        }
        return startGameCheck(message, args[0]);

      case "list":
      case "games":
        return listGames(message, false);

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
  let games = await getGames();
  games.push({
    guild: guild,
    channel: channel,
    "start-time": Math.floor(new Date().getTime() / 100 / 60 / 60), //hours
    gamemaster: gamemaster,
    code: code,
  });
  console.log(games);
  axios
    .put(config.db, games)
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

let existingOwnerCheck = async (message) => {
  let games = await getGames();
  for (i = 0; i < Object.values(games).length; i++) {
    if (Object.values(games)[i].gamemaster === message.author.id) {
      return true;
    }
  }
  return false;
};

let startGameCheck = async (message, code) => {
  if (isValidGameCode(code)) {
    let m = await message.reply(
      "`" +
        code +
        "` looks like an Among Us game room code.\n" +
        ((await existingOwnerCheck(message))
          ? "**You are already running a game of Among Us, if you continue, your old game will be overwritten.**\n\n"
          : "") +
        "**Would you like to save this code and start a game?**\n"
    );
    //check if game code in use by another game in the same server
    await m.react("✅"); //.then(await m.react("❌")); //maybe remove the no option?

    const timeout = setTimeout(async () => {
      try {
        await m.edit(
          "Timeout reached. The game, `" +
            code +
            "` will not be saved.\nIf this was a mistake, send the game code again.\nRun `>help` for more information."
        );
        return m.reactions.removeAll();
      } catch (e) {}
    }, 30000);

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
  for (i = 0; i < Object.values(games).length; i++) {
    if (Object.values(games)[i].gamemaster === message.author.id) {
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
            ".\nIf you are still " +
            (state ? "muted" : "unmuted") +
            " its because of a permissions error. Ensure that the bot role is above all other roles." +
            (!state ? "\n\n**If you are dead, be sure to mute yourself!**" : "")
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
  return listGames(message);
});

const listGames = async (message) => {
  const games = Object.values(await getGames());
  let gamesList = [];
  for (i = 0; i < games.length; i++) {
    if (games[i].guild === message.guild.id) {
      gamesList.push(games[i]);
    }
  }

  if (gamesList.length == 0) {
    return message.reply(startGameError);
  }

  const generateEmbed = async (start) => {
    const current = gamesList.slice(start, start + 5);

    const embed = new MessageEmbed()
      .setTitle(
        `Games ${start + 1}/${start + current.length} out of ${
          gamesList.length
        } in this server`
      )
      .setColor("#C0EFDB")
      .setFooter("Run `>help` for help with Crewmate");

    let computeField = async (g) => {
      let c, inv, pNum;
      try {
        c = (
          await (await bot.guilds.fetch(g.guild)).members.fetch(g.gamemaster)
        ).voice.channel;
        if (c) {
          inv = (await c.createInvite()).toString();
          pNum = c.members.size;
        }
      } catch (e) {} //gets thrown if member no longer is in guild
      return (
        "Gamemaster: <@" +
        g.gamemaster +
        ">\n" +
        (c
          ? "[Voice channel Invite](" + inv + ") (" + pNum + " players)"
          : "Gamemaster not in voice channel")
      );
    };

    await Promise.all(
      current.map(async (g) => {
        embed.addField(g.code, await computeField(g));
      })
    );

    return embed;
  };

  const author = message.author;

  message.channel.send(await generateEmbed(0)).then((message) => {
    if (gamesList.length <= 5) return;
    message.react("➡️");
    const collector = message.createReactionCollector(
      (reaction, user) =>
        ["⬅️", "➡️"].includes(reaction.emoji.name) && user.id === author.id,
      { time: 60000 }
    );

    let currentIndex = 0;
    collector.on("collect", (reaction) => {
      message.reactions.removeAll().then(async () => {
        reaction.emoji.name === "⬅️"
          ? (currentIndex -= 5)
          : (currentIndex += 5);
        message.edit(generateEmbed(currentIndex));
        if (currentIndex !== 0) await message.react("⬅️");
        if (currentIndex + 5 < gamesList.length) message.react("➡️");
      });
    });
  });
};

bot.login(config.token);
