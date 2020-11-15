const express = require('express')
const server = express()
server.all('/', (request, res) => {
	res.send('Bot online.')
})

const keepAlive = () => {
	server.listen(3000, () => {
		console.log('Server is Ready!')
	})
}

module.exports = keepAlive
