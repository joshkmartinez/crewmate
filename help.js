module.exports = {
  'help': {
    description: 'Shows the list of commands or help on a specified command.',
    format: 'help [command-name]'
  },
  'ping': {
    description: 'Measures connectivity with discord\'s servers.',
    format: 'ping'
  },
  'end': {
    aliases: ['stop'],
    description: 'Ends the current Among Us game in the channel.',
    format: 'ends'
  },
  'start': {
    aliases: ['begin'],
    description: 'Starts an Among Us game in the current channel.',
    format: 'start [game-code]'
  },
  'mute': {
    aliases: ['unmute'],
    description: 'Mutes/Unmutes everyone that is in voice channel of the game master.',
    format: 'mute'
  }
}