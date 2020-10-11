const { Client, MessageEmbed } = require("discord.js");
const axios = require("axios");
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

bot.on("ready", () => console.log(`Logged in as ${bot.user.tag}.`));

bot.on("message", async (message) => {
  // Check for command
  if (message.content.startsWith(config.prefix)) {
    let args = message.content.slice(config.prefix.length).split(" ");
    let command = args.shift().toLowerCase();

    switch (command) {
      case "ping":
        let msg = await message.reply("Pinging...");
        await msg.edit(
          `Pong 🏓\nMessage round-trip took ${
            Date.now() - msg.createdTimestamp
          }ms.`
        );
        break;

      /* Unless you know what you're doing, don't change this command. */
      case "help":
        let embed = new MessageEmbed()
          .setTitle("Amoung Us Bot Commmands")
          .setColor("#123456")
          .setFooter(
            `Requested by: ${
              message.member
                ? message.member.displayName
                : message.author.username
            }`,
            message.author.displayAvatarURL()
          )
          .setThumbnail(bot.user.displayAvatarURL());
        if (!args[0])
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
        else {
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
        message.channel.send(embed);
        break;
    }
  }
});

let allLetters = (input) => {
  for (let i = 0; i < input.length; i++) {
    if (!Boolean(input.charAt(i).match(/[a-zA-Z]/))) {
      return false;
    }
  }
  return true;
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
      console.log(response.data);
    })
    .catch((error) => {
      console.log(error);
    });
};

let endGame = (input) => {};

bot.on("message", async (message) => {
  let code = message.content;
  if (code.length == 6 && code == code.toUpperCase() && allLetters(code)) {
    let m = await message.reply(
      "`" +
        code +
        "` looks like an Among Us game code.\nWould you save this code and start a game?"
    );
    await m.react("✅").then(await m.react("❌"));

    const timeout = setTimeout(() => {
      try {
        m.edit("Timeout reached. The game, `" + code + "` will not be saved.");
        m.reactions.removeAll();
      } catch {}
    }, 30000);

    m.awaitReactions(
      (reaction, user) => {
        if (reaction.emoji.name !== "✅" || user.id !== message.author.id) {
          return false;
        }
        return true;
      },
      { max: 1, time: 30000 }
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
            "` has been saved.\nJust got here? Mention <@" +
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
});

// send game code on mention
bot.on("message", async (message) => {
  if (!message.mentions.has(bot.user)) return;
  const games = await getGames();
  for (i = 0; i < Object.keys(games).length; i++) {
    if (Object.keys(games)[i] === message.channel.id) {
      let msg =
        "A game is currently being played in this channel.\nUse the code `" +
        Object.values(games)[i].code +
        "` to join it!";
      if (Object.values(games)[i].gamemaster === message.author.id) {
        msg +=
          "\nYou are the game master of this game. To end this game, send `>end`.\nThe game will automatically end after 3 hours if it is not ended manually.";
      }
      return message.reply(msg);
    }
  }
});

bot.login(config.token);
