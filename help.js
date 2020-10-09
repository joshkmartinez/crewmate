module.exports = {
  'help': {
    description: 'Shows the list of commands or help on specified command.',
    format: 'help [command-name]'
  },
  'ping': {
    description: 'Checks connectivity with discord\'s servers.',
    format: 'ping'
  },
  'end': {
    aliases: ['stop'],
    description: 'Ends the Among Us game in the channel.',
    format: 'ends'
  }
}