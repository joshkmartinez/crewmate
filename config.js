require('dotenv').config()
module.exports = {
  prefix: '>',
  token: process.env.TOKEN,
  db: process.env.DB,
  statcord:process.env.STATCORD
};