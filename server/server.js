import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'

import axios from 'axios'


import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const { writeFile, readFile, unlink } = require("fs").promises

const Root = () => ''

try {
  // eslint-disable-next-line import/no-unresolved
  // ;(async () => {
  //   const items = await import('../dist/assets/js/root.bundle')
  //   console.log(JSON.stringify(items))

  //   Root = (props) => <items.Root {...props} />
  //   console.log(JSON.stringify(items.Root))
  // })()
  console.log(Root)
} catch (ex) {
  console.log(' run yarn build:prod to enable ssr')
}

let connections = []

const headers = (req, res, next) => {
  res.set('x-skillcrucial-user', 'be4b8e46-04db-4947-9dde-e69216b5f16c');  
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  next()  
}

const port = process.env.PORT || 8090
const server = express()

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  headers,
  cookieParser()
]

const readWrite = () => {
  return readFile(`${__dirname}/test.json`, { encoding: "utf8" })
    .then( txt => JSON.parse(txt))
    .catch ( async () => {
      const users = await axios(`https://jsonplaceholder.typicode.com/users`). then( usr => usr.data)
      writeFile(`${__dirname}/test.json`, JSON.stringify(users), { encoding: "utf8" })
      return users
    })
}

const write = (newUsers) => {
  return writeFile(`${__dirname}/test.json`, JSON.stringify(newUsers), { encoding: "utf8" })
}

middleware.forEach((it) => server.use(it))

server.get('/api/v1/users/', async (req, res) => {
  const text = await readWrite()
  res.json(text)
})

server.post('/api/v1/users', async (req, res) => {
  const newUser = req.body
  const users = await readWrite()
  // const lastUserId = users[users.length - 1].id + 1
  const usersSort = users.sort(users.id)
  const lastUserId = usersSort[usersSort.length - 1]. id+1
  const newUsers = [ ... users, {...newUser, id: lastUserId}]
  write(newUsers)
  res.json({status: 'success', id: lastUserId})
})

server.patch('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const users = await readWrite()
  const addInfoUser = users.find(item => item.id === +userId)
  const newFields = { ...addInfoUser, ...req.body }
  const list = users.reduce((acc,rec) => {
    return rec.id === +userId ? [...acc, newFields] : [...acc, rec]
  },[])
  write(list)
  res.json({ status: 'success', id: userId })
})

server.delete('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const users = await readWrite()
  const filterUsers = users.filter(it => it.id !== +userId)
  write(filterUsers)
  res.json({ status: 'success', id: userId })
})

server.delete('/api/v1/users/', async (req,res) => {
  unlink(`${__dirname}/test.json`)
  res.json( { status: 'delete' })
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})



const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial - Become an IT HERO'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)
