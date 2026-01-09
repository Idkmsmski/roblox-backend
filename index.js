const express = require("express")
const app = express()

app.use(express.json())

let banned = []

app.post("/ban", (req, res) => {
  const { userid, secret } = req.body
  if (secret !== process.env.SECRET) return res.sendStatus(403)

  banned.push(userid)
  res.send("ok")
})

app.post("/checkbans", (req, res) => {
  if (req.body.secret !== process.env.SECRET) return res.sendStatus(403)

  const copy = [...banned]
  banned = []
  res.json(copy)
})

app.listen(process.env.PORT || 3000)
