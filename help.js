module.exports = {
  help: {
    aliases: ["h"],
    description: "Shows the list of commands or help on a specified command.",
    format: "help [command-name]",
  },
  ping: {
    aliases: ["p"],
    description: "Measures the bot's latency.",
    format: "ping",
  },
  games: {
    aliases: ["list", "@Crewmate"],
    description: "Lists all the Among Us games in the server.",
    format: "games",
  },

  start: {
    aliases: ["begin", "s"],
    description: "Starts an Among Us game.",
    format: "start [game-code]",
  },
  end: {
    aliases: ["stop","remove"],
    description: "Ends the an Among Us game.",
    format: "ends [game-code] (optional)",
  },
  mute: {
    aliases: ["m"],
    description: "Mutes everyone that is in voice channel of the game master.",
    format: "mute",
  },
  unmute: {
    aliases: ["um"],
    description:
      "Unmutes everyone that is in voice channel of the game master.",
    format: "unmute",
  },
};
