require('./server')()

require("dotenv").config();
const {Client, MessageEmbed} = require('discord.js')
const axios = require('axios')
const Statcord = require('statcord.js')
const blapi = require('blapi')
const config = require('./config')
const commands = require('./help')

const bot = new Client({
	presence: {
		status: 'online',
		activity: {
			name: `for ${config.prefix}help`,
			type: 'WATCHING'
		}
	}
})
const statcord = new Statcord.Client({
	key: config.statcord,
	client: bot
})

bot.on('ready', async () => {
	console.log(
		`${bot.user.tag} is now online in ` + bot.guilds.cache.size + ' guilds.'
	)
	await statcord.autopost()

	const botListAPIKeys = {
		'top.gg': process.env.topgg_token,
		'arcane-center.xyz': process.env.arcane_center_token,
		'botlist.space': process.env.botlistspace_token,
		'botsfordiscord.com': process.env.botsfordiscord_token,
		'discord.bots.gg': process.env.discordbotsgg_token,
		'discord.boats': process.env.discordboats_token,
		"discordbotlist.com":process.env.discordbotlistcom_token,
	}

	blapi.handle(bot, botListAPIKeys, 60)
})
statcord.on('autopost-start', () => {
	console.log('Started statcord autopost.')
})

const startGameError =
	'A game of Among Us has been started yet.\nSend a game room code to start one!'
const userPermsError =
	'You need to be the game master or have manage message permissions in order run this command.'
const reactionError =
	'Error. The bot needs add reactions permissions in order to operate.\nPlease grant those permissions and try again.'

// Same code in same guild, don't start game
// allow owner to overwrite old game
// match, game command that returns a random game that has under 10 players
// list games with max players last, 7-9 first

bot.on('message', async (message) => {
	if (message.author.bot) return
	if (message.content.startsWith(config.prefix)) {
		const args = message.content.slice(config.prefix.length).split(' ')
		const command = args.shift().toLowerCase()
		try {
			await statcord.postCommand(command, message.author.id)
		} catch {
			console.log('Failed to post command stats to statcord')
		}

		switch (command) {
			case 'ping':
			case 'p':
				const m = await message.channel.send('Pong 🏓')
				return m.edit(
					`Pong 🏓\nBot latency is ${
						m.createdTimestamp - message.createdTimestamp
					}ms. Discord API Latency is ${bot.ws.ping}ms`
				)

			case 'help':
			case 'h':
				const embed = new MessageEmbed()
					.setTitle('Crewmate Bot Commands')
					.setColor('#C0EFDB')
					.setFooter(
						`Requested by: ${
							message.member
								? message.member.displayName
								: message.author.username
						}`,
						message.author.displayAvatarURL()
					)
					.setThumbnail(bot.user.displayAvatarURL())
				if (!args[0]) {
					embed.setDescription(
						Object.keys(commands)
							.map(
								(command) =>
									`\`${command.padEnd(
										Object.keys(commands).reduce(
											(a, b) => (b.length > a.length ? b : a),
											''
										).length
									)}\` - ${commands[command].description}`
							)
							.join('\n')
					)
					embed.addField(
						'Like Crewmate?',
						'Consider [upvoting Crewmate](https://top.gg/bot/762721168741761075/vote)\n[Inviting the bot to your own server!](https://discord.com/oauth2/authorize?client_id=762721168741761075&permissions=4196416&scope=bot)\nOr [support development on patreon!](https://www.patreon.com/jokur) :smiley:'
					)

					embed.addField(
						'Need help?',
						'[Join the Crewmate Bot Support Server](https://discord.gg/aRA7WcX)'
					)
				} else if (
					Object.keys(commands).includes(args[0].toLowerCase()) ||
					Object.keys(commands)
						.map((c) => commands[c].aliases || [])
						.flat()
						.includes(args[0].toLowerCase())
				) {
					const command = Object.keys(commands).includes(args[0].toLowerCase())
						? args[0].toLowerCase()
						: Object.keys(commands).find(
								(c) =>
									commands[c].aliases &&
									commands[c].aliases.includes(args[0].toLowerCase())
						  )
					embed.setTitle(`COMMAND - ${command}`)

					if (commands[command].aliases)
						embed.addField(
							'Command aliases',
							`\`${commands[command].aliases.join('`, `')}\``
						)
					embed
						.addField('DESCRIPTION', commands[command].description)
						.addField(
							'FORMAT',
							`\`\`\`${config.prefix}${commands[command].format}\`\`\``
						)
				} else {
					embed
						.setColor('RED')
						.setDescription(
							'This command does not exist. Please use the help command without specifying any commands to list them all.'
						)
				}

				return message.channel.send(embed)

			case 'end':
			case 'stop':
			case 'remove':
				let endCode = args[0]
				endCode != null ? (endCode = endCode.toUpperCase()) : null
				const games = Object.values(await getGames())
				for (i = 0; i < games.length; i++) {
					if (
						games[i].guild === message.guild.id && endCode == null
							? games[i].gamemaster === message.author.id // Not given code
							: games[i].code === endCode // Given code, code is for a specific game in the server
					) {
						if (
							games[i].gamemaster === message.author.id ||
							config.ownerID === message.author.id ||
							message.channel
								.permissionsFor(message.member)
								.has('MANAGE_MESSAGES')
						) {
							const gameCode = games[i].code
							games.splice(i, 1)

							try {
								await endGame(games)
								return message.reply(
									'The game, `' + gameCode + '`, has been ended.'
								)
							} catch {
								return message.reply(
									'Error ending game `' + gameCode + '`. Please try again.'
								)
							}
						} else {
							return message.reply(userPermsError)
						}
					}
				}

				return message.reply(startGameError)

			case 'start':
			case 's':
			case 'begin':
				let code = args[0]
				code != null ? (code = code.toUpperCase()) : null
				if (!isValidGameCode(code)) {
					return message.reply(
						'Provide a game room code in order to start a game\nRun `>help start` for more information'
					)
				}

				return startGameCheck(message, code)

			case 'list':
			case 'games':
				return listGames(message, false)

			case 'mute':
			case 'm':
				return toggleVCMute(message)

			case 'unmute':
			case 'um':
				return toggleVCMute(message, false)

			case 'stats':
				return message.channel.send((await getGames()).length + ' live games')
		}
	}
})

const isValidGameCode = (code) => {
	if (code == null) {
		return false
	}

	for (let i = 0; i < code.length; i++) {
		if (!code.charAt(i).match(/[a-zA-Z]/)) {
			return false
		}
	}

	return code.length === 6 && code === code.toUpperCase()
}

const getGames = async () => {
	const response = await axios.get(config.db)
	return response.data
}

const startGame = async (guild, channel, gamemaster, code) => {
	const games = await getGames()
	games.push({
		guild,
		channel,
		'start-time': Math.floor(Date.now() / 100 / 60 / 60), // Hours
		gamemaster,
		code
	})
	axios
		.put(config.db, games)
		.then((response) => {
			// Console.log(response.data);
		})
		.catch((error) => {
			console.log(error)
		})
}

const endGame = (games) => {
	axios
		.put(config.db, games)
		.then((response) => {
			// Console.log(response.data);
		})
		.catch((error) => {
			console.log(error)
		})
}

const existingOwnerCheck = async (message) => {
	const games = await getGames()
	for (i = 0; i < Object.values(games).length; i++) {
		if (Object.values(games)[i].gamemaster === message.author.id) {
			return true
		}
	}

	return false
}

const startGameCheck = async (message, code) => {
	if (!isValidGameCode(code)) {
		return
	}

	const intro = '`' + code + '` looks like an Among Us game room code.\n'

	if (await existingOwnerCheck(message)) {
		return message.reply(
			intro +
				'**You are already running a game of Among Us.**\nEnd your old game [`>end`] if you would like to start a new one. (You might be running a game in a different server)'
		)
	}

	const m = await message.reply(
		intro + '**Would you like to save this code and start a game?**\n'
	)
	// Check if game code in use by another game in the same server
	try {
		await m.react('✅') // .then(await m.react("❌")); //maybe remove the no option?
	} catch {
		return message.reply(reactionError)
	}

	const timeout = setTimeout(async () => {
		try {
			await m.edit(
				'Timeout reached. The game, `' +
					code +
					'` will not be saved.\nIf this was a mistake, send the game code again.\nRun `>help` for more information.'
			)
			return m.reactions.removeAll()
		} catch {}
	}, 30000)

	m.awaitReactions(
		(reaction, user) => {
			if (reaction.emoji.name !== '✅' || user.id !== message.author.id) {
				return false
			}

			return true
		},
		{max: 1}
	).then(async () => {
		clearTimeout(timeout)
		try {
			await startGame(
				message.guild.id,
				message.channel.id,
				message.author.id,
				code
			)
			await m.edit(
				'The game, `' +
					code +
					'`, has been saved.\nJust got here? Mention <@' +
					bot.user.id +
					'> to find the current game code.'
			)
		} catch {
			await m.edit(
				'The game, `' + code + '` has failed to save.\nPlease try again later.'
			)
		}

		m.reactions.removeAll()
	})
}

const toggleVCMute = async (message, state = true) => {
	const games = await getGames()
	for (i = 0; i < Object.values(games).length; i++) {
		if (Object.values(games)[i].gamemaster === message.author.id) {
			if (
				Object.values(games)[i].gamemaster === message.author.id ||
				message.channel.permissionsFor(message.member).has('MANAGE_MESSAGES')
			) {
				const gameCode = Object.values(games)[i].code
				if (message.member.voice.channel) {
					const channel = message.guild.channels.cache.get(
						message.member.voice.channel.id
					)
					for (const [memberID, member] of channel.members) {
						try {
							member.voice.setMute(state)
						} catch {
							await message.channel.send(
								'Error ' +
									(state ? 'muting' : 'unmuting') +
									' ' +
									member.mention
							)
						}
					}
				} else {
					return message.reply(
						'You need to be in a voice channel to run this command.'
					)
				}

				return message.reply(
					'The members of the game, `' +
						gameCode +
						'`, have all been ' +
						(state ? 'muted' : 'unmuted') +
						'.\nIf you are still ' +
						(state ? 'muted' : 'unmuted') +
						' its because of a permissions error. Ensure that the bot role is above all other roles.' +
						(!state ? '\n\n**If you are dead, be sure to mute yourself!**' : '')
				)
			}

			return message.reply(userPermsError)
		}
	}

	return message.reply(startGameError)
}

bot.on('message', async (message) => {
	if (message.author.bot) return
	const code = message.content
	if (isValidGameCode(code)) {
		try {
			await statcord.postCommand('CODE_START', message.author.id)
		} catch {
			console.log('Failed to post command stats to statcord')
		}
	}

	await startGameCheck(message, code)
})

// Send game code on mention
bot.on('message', async (message) => {
	if (message.author.bot) return
	if (!message.mentions.has(bot.user)) return
	try {
		await statcord.postCommand('CODE_SEND', message.author.id)
	} catch {
		console.log('Failed to post command stats to statcord')
	}

	return listGames(message)
})

const listGames = async (message) => {
	const games = Object.values(await getGames())
	const gamesList = []
	for (i = 0; i < games.length; i++) {
		if (games[i].guild === message.guild.id) {
			gamesList.push(games[i])
		}
	}

	if (gamesList.length === 0) {
		return message.reply(startGameError)
	}

	// TODO: add game caching here
	const generateEmbed = async (start) => {
		const current = gamesList.slice(start, start + 5)

		const embed = new MessageEmbed()
			.setTitle(
				`Games ${start + 1}/${start + current.length} out of ${
					gamesList.length
				} in this server`
			)
			.setColor('#C0EFDB')
			.setFooter('Run `>help` for help with Crewmate')

		const computeField = async (g) => {
			let c
			let inv
			let pNumber
			try {
				c = (
					await (await bot.guilds.fetch(g.guild)).members.fetch(g.gamemaster)
				).voice.channel
				if (c) {
					inv = (await c.createInvite()).toString()
					pNumber = c.members.size
				}
			} catch {
				// Gets thrown if member no longer is in guild
			}

			return (
				'Gamemaster: <@' +
				g.gamemaster +
				'>\n' +
				(c
					? '[Voice channel Invite](' + inv + ') (' + pNumber + ' players)'
					: 'Gamemaster not in voice channel')
			)
		}

		await Promise.all(
			current.map(async (g) => {
				embed.addField(g.code, await computeField(g))
			})
		)

		return embed
	}

	const author = message.author

	message.channel.send(await generateEmbed(0)).then(async (message) => {
		if (gamesList.length <= 5) return
		try {
			await message.react('➡️')
		} catch {
			return message.reply(reactionError)
		}

		const collector = message.createReactionCollector(
			(reaction, user) =>
				['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === author.id,
			{time: 60000}
		)

		let currentIndex = 0
		collector.on('collect', async (reaction) => {
			await message.edit('↻ Loading games and generating vc channel invites...')
			message.reactions.removeAll().then(async () => {
				reaction.emoji.name === '⬅️' ? (currentIndex -= 5) : (currentIndex += 5)
				await message.edit(await generateEmbed(currentIndex))
				await message.edit('')
				if (currentIndex !== 0) await message.react('⬅️')
				if (currentIndex + 5 < gamesList.length) message.react('➡️')
			})
		})
	})
}

bot.login(config.token)
